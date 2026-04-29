# OPS_ACCESS.md

Короткая памятка по доступам и управлению продом для этого проекта.

## Рабочий доступ к VPS

- Cloud.ru VM name: `wedding-vps`
- VPS public IP: `185.50.203.2`
- Рабочий SSH user: `user1`
- Локальный SSH private key path: `~/.ssh/cloudru.key`
- Команда входа:

```bash
ssh -o IdentitiesOnly=yes -i ~/.ssh/cloudru.key user1@185.50.203.2
```

## Дополнительный VPS для Telegram SOCKS5

- Provider: `Aeza`
- Location: `Sweden`
- VPS public IP: `89.22.227.133`
- SSH user: `root`
- SSH auth: password (хранится вне git)
- Назначение: только исходящий SOCKS5 для Telegram API, чтобы бот на Cloud.ru не терял связь с `api.telegram.org`
- Сервис: `danted`, порт `1080`
- Ограничение доступа: к SOCKS5 допускается только Cloud.ru VPS IP `185.50.203.2`

## Путь проекта на VPS

- Project dir: `/home/user1/EventBudjet`

## Дополнительные handoff документы

- env template: [.env.example](./.env.example)
- secrets map: [docs/SECRETS_INVENTORY.md](./docs/SECRETS_INVENTORY.md)
- migration checklist: [docs/MIGRATION_CHECKLIST.md](./docs/MIGRATION_CHECKLIST.md)
- backup/restore: [docs/BACKUP_RESTORE.md](./docs/BACKUP_RESTORE.md)

## Управление сервисами на VPS

`user1` работает с Docker через `sudo`.

Проверка статуса:

```bash
cd /home/user1/EventBudjet
sudo docker compose ps
```

Логи бота:

```bash
cd /home/user1/EventBudjet
sudo docker compose logs --tail=200 bot
```

Перезапуск бота:

```bash
cd /home/user1/EventBudjet
sudo docker compose up -d bot
```

## Telegram через SOCKS5 (текущая prod-схема)

- Бот использует прокси через env-переменную `BOT_TELEGRAM_PROXY_URL`.
- Значение задается в `/home/user1/EventBudjet/.env` на Cloud.ru VPS.
- В коде прокси подхватывается в `bot/main.py` через `AiohttpSession(proxy=...)`.
- Если прокси недоступен, бот может стартовать с ошибками сети Telegram.

Проверка, что прокси активен:

```bash
cd /home/user1/EventBudjet
sudo docker compose logs --tail=100 bot
```

В логах должно быть:

- `telegram_proxy_enabled`
- `telegram_connection_ready`
- `Run polling`

## Рабочая схема дальше

Локальный код и продовый код должны быть одинаковыми по структуре. `docker-compose.yml` в репозитории хранится полный, включая `bot`.

Но рабочая практика такая:

- локально поднимать только:

```bash
docker compose up -d frontend backend postgres nginx
```

- локально не поднимать `bot`, чтобы не ловить Telegram polling conflict;
- на VPS поднимать полный проект из `/home/user1/EventBudjet`.

## Базовый деплой-поток

1. Меняем код локально.
2. Проверяем локально без `bot`.
3. Коммитим и пушим в GitHub.
4. Деплоим одной командой:

```bash
npm run deploy:vps
```

5. Проверяем логи:

```bash
npm run logs:vps
```

## Важные текущие факты

- `docker-compose.yml` локально и на VPS снова совпадают по структуре.
- Бот на VPS работает на новом токене.
- Локально `bot` не запускать. Для локальной проверки поднимать только `frontend backend postgres nginx`.

## Гарантированный фикс при постоянном Conflict

1. Выпустить новый токен в BotFather (`/token`).
2. Обновить `TELEGRAM_BOT_TOKEN` в `/home/user1/EventBudjet/.env`.
3. Перезапустить bot:

```bash
cd /home/user1/EventBudjet
sudo docker compose up -d bot
sudo docker compose logs --tail=100 bot
```

## Где смотреть SSH-параметры в Cloud.ru

- `wedding-vps` -> `Настройки авторизации`
- Там сейчас логин VM: `user1` и привязанный SSH public key.

## Безопасность

- Не хранить в git приватные ключи и реальные токены.
- Если приватный ключ/токен попадал в переписку, ротация обязательна.
