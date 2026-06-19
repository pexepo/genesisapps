# Подключение своего домена

Бот слушает на порту `8080`. Чтобы открыть сайт-форму на красивом домене
(например `genesis.example.com`) и сразу по **HTTPS**, выбери один из путей ниже —
под свою ситуацию.

| Путь | Когда выбирать | HTTPS | Белый IP / порты |
|------|----------------|-------|------------------|
| **A. Cloudflare Tunnel** | бот крутится на твоём **домашнем ПК** | автоматически | не нужны |
| **B. VPS + Caddy** | бот на **сервере** (24/7) | автоматически | нужен открытый 80/443 |
| **C. Платный ngrok** | уже сидишь на ngrok и не хочешь возиться | да | не нужны |

> Во всех случаях бот (`python bot.py`) должен быть запущен. Домен лишь
> «прокидывает» публичный адрес на локальный порт `8080`.

---

## Путь A — Cloudflare Tunnel (рекомендую для домашнего ПК)

Бесплатно, без белого IP и проброса портов, HTTPS «из коробки». Нужен только
аккаунт Cloudflare и твой домен.

### 1. Подключить домен к Cloudflare
1. Зарегистрируйся на <https://dash.cloudflare.com> → **Add a site** → введи свой домен.
2. Cloudflare покажет **два nameserver'а** (вида `xxx.ns.cloudflare.com`).
3. Зайди в панель регистратора, **где покупал домен**, и замени там nameservers на
   выданные Cloudflare. Применяется обычно за минуты (иногда до суток).
4. Дождись в Cloudflare статуса домена **Active**.

### 2. Установить cloudflared
- **macOS:** `brew install cloudflared` (или бинарь с сайта Cloudflare).
- **Windows:** скачай `cloudflared.exe` со страницы загрузок Cloudflare Tunnel.

### 3. Создать туннель
```bash
cloudflared tunnel login                 # откроется браузер → выбери свой домен → Authorize
cloudflared tunnel create genesis        # создаст туннель и файл-ключ <UUID>.json
cloudflared tunnel route dns genesis genesis.ТВОЙ-домен.com
```

### 4. Запустить
Быстрый вариант (бот уже запущен в соседнем окне):
```bash
cloudflared tunnel run --url http://localhost:8080 genesis
```
Открой `https://genesis.ТВОЙ-домен.com` — увидишь форму по HTTPS. 🎉

### 5. (Опционально) постоянный конфиг + автозапуск
Файл `config.yml` (рядом с ключом туннеля):
```yaml
tunnel: genesis
credentials-file: /полный/путь/к/<UUID>.json
ingress:
  - hostname: genesis.ТВОЙ-домен.com
    service: http://localhost:8080
  - service: http_status:404
```
Запуск: `cloudflared tunnel run genesis`.
Автозапуск как служба: `cloudflared service install` (поднимется сам после перезагрузки).

> ПК выключен — сайт недоступен. Нужен режим 24/7 → переходи на путь B (VPS).

---

## Путь B — VPS + Caddy (сервер, 24/7)

Если бот уже развёрнут на VPS (см. **README.md → «Шаг 5. Деплой на VPS»**), домен
подключается через DNS-запись и reverse-proxy **Caddy** с авто-HTTPS.

### 1. DNS-запись у регистратора
Создай запись:
- Тип **A**, имя `genesis` (или `@` — для корня домена), значение — **IP твоего VPS**.

(Если DNS ведёшь через Cloudflare — поставь «серое облачко» = *DNS only*, чтобы
сертификат выпускал сам Caddy.)

### 2. Установить Caddy
По официальной инструкции: <https://caddyserver.com/docs/install>. Например на Ubuntu —
пакетом `caddy`.

### 3. Caddyfile
Открой `/etc/caddy/Caddyfile` и впиши:
```
genesis.example.com {
    reverse_proxy localhost:8080
}
```
Caddy сам получит и будет продлевать сертификат Let's Encrypt (нужны открытые порты
**80** и **443**).

### 4. Перезагрузить и закрыть бота наружу
```bash
sudo systemctl reload caddy
```
В `.env` бота можно поставить `HOST=127.0.0.1` — тогда наружу смотрит только Caddy,
а бот доступен лишь локально. Открой `https://genesis.example.com`.

> Не забудь открыть порты 80 и 443 в фаерволе VPS (`ufw allow 80,443/tcp`).

---

## Путь C — платный ngrok с фиксированным доменом

Если уже пользуешься ngrok: на платном тарифе можно закрепить домен в дашборде ngrok
и запускать так:
```bash
ngrok http 8080 --domain=genesis.example.com
```
Бесплатный тариф постоянный домен не даёт (адрес меняется при каждом запуске).

---

## После подключения

- Раздавай заявителям красивую ссылку `https://твой-домен`.
- Если параллельно используешь Google Forms — обнови в `apps_script.gs`
  `BOT_URL` на `https://твой-домен/submit`.
- Проверка здоровья: `https://твой-домен/health` → `{"status":"ready", ...}`.
