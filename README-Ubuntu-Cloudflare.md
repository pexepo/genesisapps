# Простой деплой на Ubuntu + Cloudflare Tunnel

Эта схема запускает бота как системную службу и публикует сайт на своём домене
через Cloudflare Tunnel. Порты 80, 443 и 8080 открывать не нужно: туннель сам
создаёт исходящее защищённое соединение с Cloudflare и выдаёт HTTPS.

## Что понадобится

- VPS с Ubuntu 22.04 или 24.04, 1 ГБ RAM и SSH-доступом;
- домен, добавленный в Cloudflare и имеющий статус **Active**;
- существующее приложение и бот в Discord Developer Portal;
- поддомен для формы, например `apply.example.com`.

В командах ниже замени `apply.example.com` на свой адрес.

## 1. Подготовь Discord

В [Discord Developer Portal](https://discord.com/developers/applications):

1. Открой приложение бота.
2. В **Bot** включи **Server Members Intent**.
3. В **OAuth2 -> General -> Redirects** добавь точный адрес:

   ```text
   https://apply.example.com/auth/callback
   ```

4. Сохрани изменения и скопируй **Client ID** и **Client Secret**.
5. На сервере Discord подними роль бота выше всех ролей, которые он выдаёт.

Боту нужны права View Channels, Send Messages, Create Public Threads, Send
Messages in Threads, Manage Threads и Manage Roles.

## 2. Установи проект на Ubuntu

Подключись к VPS:

```bash
ssh root@IP_СЕРВЕРА
```

Установи пакеты и создай отдельного пользователя:

```bash
apt update && apt upgrade -y
apt install -y git python3 python3-venv ca-certificates curl ufw
adduser --system --group --home /opt/genesis genesis
```

Склонируй проект и установи зависимости:

```bash
git clone https://github.com/pexepo/genesisapps.git /opt/genesis/app
chown -R genesis:genesis /opt/genesis
sudo -u genesis python3 -m venv /opt/genesis/venv
sudo -u genesis /opt/genesis/venv/bin/pip install --upgrade pip
sudo -u genesis /opt/genesis/venv/bin/pip install -r /opt/genesis/app/requirements.txt
```

## 3. Заполни `.env`

```bash
sudo -u genesis cp /opt/genesis/app/.env.example /opt/genesis/app/.env
nano /opt/genesis/app/.env
```

Заполни Discord-токен, ID канала и ролей. Для хостинга обязательно проверь эти
строки:

```dotenv
HOST=127.0.0.1
PORT=8080
STATE_FILE=/opt/genesis/data/submissions.json
TRUST_PROXY=1

DISCORD_CLIENT_ID=ID_ПРИЛОЖЕНИЯ
DISCORD_CLIENT_SECRET=СЕКРЕТ_OAUTH
DISCORD_REDIRECT_URI=https://apply.example.com/auth/callback

SESSION_SECRET=СЛУЧАЙНЫЙ_СЕКРЕТ
SHARED_SECRET=ДРУГОЙ_СЛУЧАЙНЫЙ_СЕКРЕТ
```

Два разных секрета можно получить двумя запусками команды:

```bash
openssl rand -hex 32
```

Подготовь хранилище и закрой доступ к `.env`:

```bash
mkdir -p /opt/genesis/data
chown -R genesis:genesis /opt/genesis/data
chmod 600 /opt/genesis/app/.env
```

`.env` не хранится в Git и не должен отправляться на GitHub.

## 4. Сделай автозапуск бота

Открой файл службы:

```bash
nano /etc/systemd/system/genesis.service
```

Вставь:

```ini
[Unit]
Description=Genesis Discord application bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=genesis
Group=genesis
WorkingDirectory=/opt/genesis/app
EnvironmentFile=/opt/genesis/app/.env
ExecStart=/opt/genesis/venv/bin/python /opt/genesis/app/bot.py
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/genesis/data

[Install]
WantedBy=multi-user.target
```

Запусти службу:

```bash
systemctl daemon-reload
systemctl enable --now genesis
systemctl status genesis --no-pager
curl http://127.0.0.1:8080/health
```

В ответе `/health` должен быть статус `ready`. Логи бота:

```bash
journalctl -u genesis -f
```

## 5. Подключи домен через Cloudflare — самый простой способ

1. Открой [Cloudflare Dashboard](https://dash.cloudflare.com/) и выбери
   **Zero Trust**.
2. Открой **Networks -> Tunnels** (в некоторых версиях панели раздел называется
   **Networks -> Connectors -> Cloudflare Tunnels**).
3. Нажми **Create a tunnel**, выбери **Cloudflared**, назови туннель `genesis`.
4. Выбери **Debian**, архитектуру своего VPS (`64-bit` обычно означает `amd64`).
5. Cloudflare покажет команды установки коннектора. Скопируй и выполни их на VPS
   целиком. Последняя команда выглядит примерно так:

   ```bash
   cloudflared service install ДЛИННЫЙ_ТОКЕН_ИЗ_CLOUDFLARE
   ```

   Токен никому не отправляй и не добавляй в Git.

6. Когда коннектор получит статус **Healthy**, открой вкладку **Published
   application routes** или **Public Hostname** и добавь маршрут:

   - **Subdomain:** `apply`
   - **Domain:** `example.com`
   - **Type / Service:** `HTTP`
   - **URL:** `localhost:8080`

7. Сохрани маршрут. Cloudflare сам создаст DNS-запись и HTTPS-сертификат.

Проверь:

```text
https://apply.example.com/health
https://apply.example.com/
```

После этого проверь вход через Discord. Redirect в Discord и
`DISCORD_REDIRECT_URI` должны посимвольно совпадать с публичным callback URL.

Официальные инструкции Cloudflare: [создание remotely-managed
tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)
и [публикация приложения](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/).

## 6. Закрой лишние порты

Туннелю нужен только исходящий доступ. Оставь снаружи только SSH:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw enable
ufw status
```

Не открывай порт 8080. Бот слушает его только на `127.0.0.1`, а Cloudflare
Tunnel обращается к нему локально.

## 7. Если VPS не подключается к Discord

Cloudflare Tunnel публикует сайт, но не заменяет исходящее соединение бота с
Discord. Проверь его на VPS:

```bash
curl -I https://discord.com/api/v10/gateway
```

Если запрос блокируется или зависает, потребуется HTTP(S) CONNECT-прокси в
регионе, где Discord доступен. В `.env` добавь:

```dotenv
OUTBOUND_PROXY=http://HOST:PORT
PROXY_USERNAME=ЛОГИН
PROXY_PASSWORD=ПАРОЛЬ
```

Прокси должен поддерживать долгие WebSocket CONNECT-соединения. После изменения:

```bash
systemctl restart genesis
journalctl -u genesis -n 100 --no-pager
```

## Обновление проекта

`.env` и данные заявок не затрагиваются обычным обновлением:

```bash
git -C /opt/genesis/app pull --ff-only
sudo -u genesis /opt/genesis/venv/bin/pip install -r /opt/genesis/app/requirements.txt
systemctl restart genesis
curl http://127.0.0.1:8080/health
```

Полезная диагностика:

```bash
systemctl status genesis cloudflared --no-pager
journalctl -u genesis -n 100 --no-pager
journalctl -u cloudflared -n 100 --no-pager
```
