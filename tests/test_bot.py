import os
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

os.environ.setdefault("DISCORD_TOKEN", "test-token")
os.environ.setdefault("FORUM_CHANNEL_ID", "1")
os.environ.setdefault("REVIEWER_ROLE_ID", "2")
os.environ.setdefault("SHARED_SECRET", "test-shared-secret")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

import bot


class SubmissionStoreTests(unittest.IsolatedAsyncioTestCase):
    async def test_daily_claim_blocks_both_account_and_ip_and_persists(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.json"
            store = bot.SubmissionStore(path)

            first = await store.claim_daily("account-a", "ip-a")
            self.assertIsNotNone(first)
            self.assertIsNone(await store.claim_daily("account-a", "ip-b"))
            self.assertIsNone(await store.claim_daily("account-b", "ip-a"))
            self.assertIsNotNone(await store.claim_daily("account-b", "ip-b"))

            reloaded = bot.SubmissionStore(path)
            self.assertIsNone(await reloaded.claim_daily("account-a", "ip-c"))

    async def test_failed_submission_claim_can_be_released(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = bot.SubmissionStore(Path(tmp) / "state.json")
            claim = await store.claim_daily("account-a", "ip-a")
            await store.release_claim(claim)
            self.assertIsNotNone(await store.claim_daily("account-a", "ip-a"))

    async def test_expired_claim_is_pruned(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = bot.SubmissionStore(Path(tmp) / "state.json")
            store._daily_claims = [{
                "id": "old",
                "applicant_id": "account-a",
                "ip_hash": "ip-a",
                "at": time.time() - 100,
            }]
            with patch.object(bot, "APPLICATION_COOLDOWN", 10):
                self.assertIsNotNone(await store.claim_daily("account-a", "ip-a"))


class SessionAndNetworkTests(unittest.TestCase):
    def setUp(self):
        self.client = bot.FormsBot()

    def test_signed_session_rejects_tampering_and_expiry(self):
        user = {"id": "123", "username": "artist", "iat": int(time.time())}
        signed = self.client._sign_session(user)
        request = SimpleNamespace(cookies={bot.SESSION_COOKIE: signed})
        self.assertEqual(self.client._read_session(request)["id"], "123")

        tampered = signed[:-1] + ("A" if signed[-1] != "A" else "B")
        self.assertIsNone(
            self.client._read_session(
                SimpleNamespace(cookies={bot.SESSION_COOKIE: tampered})
            )
        )

        expired = self.client._sign_session(
            {"id": "123", "username": "artist", "iat": int(time.time()) - 20}
        )
        with patch.object(bot, "SESSION_MAX_AGE", 10):
            self.assertIsNone(
                self.client._read_session(
                    SimpleNamespace(cookies={bot.SESSION_COOKIE: expired})
                )
            )

    def test_proxy_headers_are_only_trusted_when_enabled(self):
        request = SimpleNamespace(
            headers={
                "CF-Connecting-IP": "203.0.113.9",
                "X-Forwarded-For": "198.51.100.4, 127.0.0.1",
            },
            remote="127.0.0.1",
        )
        with patch.object(bot, "TRUST_PROXY", False):
            self.assertEqual(self.client._client_ip(request), "127.0.0.1")
        with patch.object(bot, "TRUST_PROXY", True):
            self.assertEqual(self.client._client_ip(request), "203.0.113.9")


class ThreadStatusTests(unittest.IsolatedAsyncioTestCase):
    async def test_accept_does_not_rename_thread(self):
        class FakeThread:
            name = "Genesis unit application - artist"
            parent = None

            def __init__(self):
                self.edited = False

            async def edit(self, **kwargs):
                self.edited = True

        client = bot.FormsBot()
        thread = FakeThread()
        await client._apply_status(thread, accepted=True, role_name="Motion")
        self.assertFalse(thread.edited)

    async def test_decline_does_not_rename_thread(self):
        class FakeThread:
            name = "Genesis unit application - artist"
            parent = None

            def __init__(self):
                self.edited = False

            async def edit(self, **kwargs):
                self.edited = True

        client = bot.FormsBot()
        thread = FakeThread()
        await client._apply_status(thread, accepted=False, role_name=None)
        self.assertFalse(thread.edited)


class WebsiteApplicationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.client = bot.FormsBot()
        self.client.store = bot.SubmissionStore(Path(self.tmp.name) / "state.json")
        self.client.is_ready = Mock(return_value=True)
        self.thread = SimpleNamespace(id=99, guild=SimpleNamespace())
        self.client.create_forum_post = AsyncMock(return_value=self.thread)
        self.client._assign_applicant_role = AsyncMock()
        self.payload = {
            "hp": "",
            "form_title": "Genesis unit application",
            "responses": [
                {"question": "Discord account", "answer": "123"},
                {"question": "Editing software", "answer": "After Effects"},
            ],
        }

    async def asyncTearDown(self):
        self.tmp.cleanup()

    def request(self, payload=None):
        request = SimpleNamespace(
            headers={},
            remote="203.0.113.10",
            cookies={},
        )
        request.json = AsyncMock(return_value=payload or self.payload)
        return request

    async def test_verified_account_and_ip_can_only_submit_once(self):
        session = {"id": "123", "username": "artist", "iat": int(time.time())}
        self.client._read_session = Mock(return_value=session)
        with patch.object(bot, "OAUTH_ENABLED", True):
            first = await self.client.handle_apply(self.request())
            second = await self.client.handle_apply(self.request())

        self.assertEqual(first.status, 200)
        self.assertEqual(second.status, 429)
        self.assertIn('"daily_limit"', second.text)
        record = self.client.store.get(99)
        self.assertEqual(record["applicant_id"], "123")
        self.assertEqual(record["applicant"], "123")
        post = self.client.create_forum_post.await_args.args[0]
        self.assertEqual(post["responses"][0]["answer"], "@artist")

    async def test_oauth_enabled_rejects_missing_session(self):
        self.client._read_session = Mock(return_value=None)
        with patch.object(bot, "OAUTH_ENABLED", True):
            response = await self.client.handle_apply(self.request())
        self.assertEqual(response.status, 401)
        self.client.create_forum_post.assert_not_awaited()

    async def test_honeypot_is_silently_discarded(self):
        payload = dict(self.payload, hp="https://spam.example")
        response = await self.client.handle_apply(self.request(payload))
        self.assertEqual(response.status, 200)
        self.client.create_forum_post.assert_not_awaited()


class ConfigurationTests(unittest.TestCase):
    def test_first_three_role_choices_grant_core_role(self):
        values = {
            "ROLE_CHOICE_1_ID": "11",
            "ROLE_CHOICE_2_ID": "12",
            "ROLE_CHOICE_3_ID": "13",
            "ROLE_CHOICE_4_ID": "14",
        }
        with patch.dict(os.environ, values, clear=False):
            choices = bot._load_role_choices()
        self.assertEqual(
            [choice["grants_core_role"] for choice in choices],
            [True, True, True, False],
        )


class TranslationTests(unittest.TestCase):
    def test_target_language_flips_between_russian_and_english(self):
        self.assertEqual(bot.translation_target("Всем привет, коллаб в пятницу"), "en")
        self.assertEqual(bot.translation_target("New collab starts Friday"), "ru")
        self.assertEqual(bot.translation_target("Collab в пятницу, rules в ветке"), "en")
        self.assertEqual(bot.translation_target("🔥 123"), "ru")

    def test_parse_reads_translation_with_or_without_language(self):
        self.assertEqual(bot.parse_translation([["Привет всем.\nПравила в ветке.", "en"]]), "Привет всем.\nПравила в ветке.")
        self.assertEqual(bot.parse_translation(["Привет"]), "Привет")

    def test_message_text_includes_embeds(self):
        field = SimpleNamespace(name="When", value="Friday")
        embed = SimpleNamespace(title="Collab", description="Join us", fields=[field])
        message = SimpleNamespace(content="", embeds=[embed])
        self.assertEqual(bot.message_text(message), "Collab\n\nJoin us\n\nWhen\nFriday")


if __name__ == "__main__":
    unittest.main()
