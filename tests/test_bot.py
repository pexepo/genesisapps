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


class UploadTests(unittest.IsolatedAsyncioTestCase):
    MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64

    async def asyncSetUp(self):
        from aiohttp import FormData, web
        from aiohttp.test_utils import TestClient, TestServer

        self.FormData = FormData
        self.tmp = tempfile.TemporaryDirectory()
        self.patches = [
            patch.object(bot, "OAUTH_ENABLED", True),
            patch.object(bot, "UPLOAD_DIR", Path(self.tmp.name)),
            patch.object(bot, "SITE_URL", "https://example.test"),
        ]
        for p in self.patches:
            p.start()
        self.client = bot.FormsBot()
        self.client._read_session = Mock(return_value={"id": "42", "username": "artist"})
        app = web.Application()
        app.router.add_post("/upload", self.client.handle_upload)
        app.router.add_get("/v/{name}", self.client.handle_video)
        self.http = TestClient(TestServer(app))
        await self.http.start_server()

    async def asyncTearDown(self):
        await self.http.close()
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def form(self, data, filename="edit.mp4"):
        form = self.FormData()
        form.add_field("file", data, filename=filename, content_type="video/mp4")
        return form

    async def test_upload_returns_playable_link(self):
        resp = await self.http.post("/upload", data=self.form(self.MP4))
        body = await resp.json()
        self.assertEqual(resp.status, 200, body)
        self.assertTrue(body["url"].startswith("https://example.test/v/"))
        name = body["url"].rsplit("/", 1)[1]
        self.assertRegex(name, bot.UPLOAD_NAME_RE)

        video = await self.http.get(f"/v/{name}")
        self.assertEqual(video.status, 200)
        self.assertEqual(video.headers["Content-Type"], "video/mp4")
        self.assertEqual(await video.read(), self.MP4)

    async def test_upload_rejects_disguised_file_and_anonymous_users(self):
        resp = await self.http.post("/upload", data=self.form(b"<html><script>x</script></html>"))
        self.assertEqual(resp.status, 415)
        resp = await self.http.post("/upload", data=self.form(self.MP4, filename="edit.exe"))
        self.assertEqual(resp.status, 415)
        self.assertEqual(list(Path(self.tmp.name).iterdir()), [])

        self.client._read_session = Mock(return_value=None)
        resp = await self.http.post("/upload", data=self.form(self.MP4))
        self.assertEqual(resp.status, 401)

    async def test_upload_enforces_size_and_daily_limit(self):
        with patch.object(bot, "UPLOAD_MAX_BYTES", 32):
            resp = await self.http.post("/upload", data=self.form(self.MP4))
        self.assertEqual(resp.status, 413)
        self.assertEqual(list(Path(self.tmp.name).iterdir()), [])

        with patch.object(bot, "UPLOAD_PER_USER_DAY", 1):
            first = await self.http.post("/upload", data=self.form(self.MP4))
            second = await self.http.post("/upload", data=self.form(self.MP4))
        self.assertEqual((first.status, second.status), (200, 429))

    async def test_expired_video_is_hidden_and_cleaned_up(self):
        resp = await self.http.post("/upload", data=self.form(self.MP4))
        name = (await resp.json())["url"].rsplit("/", 1)[1]
        path = Path(self.tmp.name) / name
        old = time.time() - bot.UPLOAD_TTL - 60
        os.utime(path, (old, old))

        self.assertEqual((await self.http.get(f"/v/{name}")).status, 404)
        self.assertEqual(bot.cleanup_uploads(Path(self.tmp.name), time.time()), 1)
        self.assertFalse(path.exists())

    async def test_video_route_rejects_path_tricks(self):
        for name in ["..%2Fstate.json", "abc.mp4", "x" * 22 + ".html"]:
            self.assertEqual((await self.http.get(f"/v/{name}")).status, 404)


class DecisionMessageTests(unittest.TestCase):
    def test_message_follows_application_language(self):
        with patch.object(bot, "SITE_URL", "https://example.test"):
            ru = bot.decision_dm(True, "Motion", "ru")
            en = bot.decision_dm(False, None, "en")
            both = bot.decision_dm(False, None, None)
        self.assertIn("принята", ru)
        self.assertIn("**Motion**", ru)
        self.assertNotIn("accepted", ru)
        self.assertIn("declined", en)
        self.assertIn("https://example.test", en)
        self.assertIn("отклонена", both)
        self.assertIn("declined", both)

    def test_owners_config_skips_malformed_entries(self):
        owners = bot.parse_owners("1|owner|https://a.test, bad, 2|co-owner|https://b.test")
        self.assertEqual([o["id"] for o in owners], ["1", "2"])
        self.assertEqual(owners[1]["role"], "co-owner")

    def test_video_signatures(self):
        self.assertTrue(bot.sniff_video(UploadTests.MP4[:16], "mp4"))
        self.assertTrue(bot.sniff_video(b"\x1a\x45\xdf\xa3" + b"\x00" * 12, "webm"))
        self.assertFalse(bot.sniff_video(b"<!doctype html>", "mp4"))
        self.assertFalse(bot.sniff_video(UploadTests.MP4[:16], "webm"))


class NotifyApplicantTests(unittest.IsolatedAsyncioTestCase):
    async def test_dm_failure_is_reported_not_raised(self):
        import discord

        member = SimpleNamespace(send=AsyncMock(side_effect=discord.Forbidden(Mock(status=403), "closed")))
        client = bot.FormsBot()
        client._resolve_member = AsyncMock(return_value=member)
        note = await client._notify_applicant(object(), {"applicant_id": "5", "lang": "ru"}, True, "Motion")
        self.assertIn("DMs are closed", note)

        member.send = AsyncMock()
        note = await client._notify_applicant(object(), {"applicant_id": "5", "lang": "ru"}, True, "Motion")
        self.assertIn("notified", note)
        self.assertIn("принята", member.send.await_args.args[0])


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
