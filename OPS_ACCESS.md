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

## Путь проекта на VPS

- Project dir: `/home/user1/EventBudjet`

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
