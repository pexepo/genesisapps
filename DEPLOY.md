# Genesis on the Oskolok VPS

Site: https://genesisunitapps.lol · VPS 185.166.153.240 (shared with oskolok.lol, Ubuntu 24.04, Python 3.12).
Nginx terminates HTTP(S) and proxies to `bot.py` on `127.0.0.1:8080`. The bot reaches Discord directly (no outbound proxy needed).

## Where things live

- `/opt/genesis/app` — code (owned by root, read-only for the service). `.env` there is a symlink to the env file.
- `/etc/genesis/genesis.env` — secrets and settings (`root:genesis`, 640). Differs from local `.env` only in `HOST=127.0.0.1`, `TRUST_PROXY=1`, `STATE_FILE=/var/lib/genesis/submissions.json`.
- `/var/lib/genesis/submissions.json` — application state (cooldowns, thread statuses).
- `/opt/genesis/venv` — Python dependencies.
- `genesis.service` — systemd, user `genesis`, restarts on failure.
- `/etc/nginx/sites-available/genesis` — server block; ACME webroot `/var/www/genesis-acme`. Nginx is 1.24: use `listen 443 ssl http2`, not `http2 on`.
- Let's Encrypt cert `genesisunitapps.lol` (webroot), renewed by `certbot.timer`; the shared deploy hook reloads nginx. DNS is in Cloudflare (grey cloud); `www` has no record yet.

SSH: `ssh -i ~/.ssh/oskolok_deploy_ed25519 -o IdentitiesOnly=yes root@185.166.153.240`.

## Update the code

From the repo root on the Mac:

```sh
T=$(mktemp -d) && git archive HEAD | tar -x -C "$T" && chmod 755 "$T"
rsync -a --delete --exclude .env -e "ssh -i ~/.ssh/oskolok_deploy_ed25519 -o IdentitiesOnly=yes" "$T/" root@185.166.153.240:/opt/genesis/app/
ssh -i ~/.ssh/oskolok_deploy_ed25519 -o IdentitiesOnly=yes root@185.166.153.240 \
  'chown -R root:root /opt/genesis/app && ln -sfn /etc/genesis/genesis.env /opt/genesis/app/.env && systemctl restart genesis && sleep 5 && curl -s 127.0.0.1:8080/health'
```

Bump `?v=` on `styles.css` / `app.js` in `web/index.html` when they change, or browsers keep the old copy for a day.

## Seasonal theme

`web/assets/theme.js` switches the Halloween theme on from Oct 20 to Nov 2 (visitor's local time) and back off by itself. Preview with `?theme=halloween` or `?theme=base`. The pre-Halloween design is tagged `design-base-2026-10`.

## Check

```sh
systemctl status genesis --no-pager
journalctl -u genesis -n 100 --no-pager
curl -s http://127.0.0.1:8080/health   # {"status": "ready", ...}
```

Only one copy of the bot may run with this token, otherwise applications are posted twice.

## Remove

```sh
systemctl disable --now genesis && rm /etc/systemd/system/genesis.service /etc/nginx/sites-enabled/genesis && systemctl reload nginx
```

Data stays in `/var/lib/genesis` until deleted by hand.
