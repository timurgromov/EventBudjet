# SECRETS_INVENTORY.md

Этот файл нужен для быстрого handoff новому агенту или при переносе на другой VPS.

В git не хранятся реальные значения секретов. Здесь хранится только карта:

- что существует;
- где это используется;
- где это лежит;
- как это ротировать.

## Правило безопасности

- Не коммитить реальные токены, пароли, приватные ключи и сертификаты.
- Если секрет светился в чате, логах или коммите, его нужно перевыпустить.
- Источник кода: GitHub.
- Источник секретов: защищенное хранилище, локальная машина владельца или `.env` на VPS.

## Инвентарь секретов и доступов

| Что | Где используется | Где хранится сейчас | Как получить / обновить |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | `backend`, `bot` | `/home/user1/EventBudjet/.env` на VPS | Через BotFather: `/token` |
| `ADMIN_API_TOKEN` | `backend` admin API | `/home/user1/EventBudjet/.env` на VPS | Сгенерировать новый случайный токен и заменить в `.env` |
| `BOT_ADMIN_CHAT_ID` | `bot` admin notifications | `/home/user1/EventBudjet/.env` на VPS | Определяется по целевому Telegram чату/группе |
| `MINI_APP_URL` | `bot` start button | `/home/user1/EventBudjet/.env` на VPS | Обновить при смене домена mini app |
| `BOT_TELEGRAM_PROXY_URL` | `bot` Telegram API transport | `/home/user1/EventBudjet/.env` на Cloud.ru VPS | Формат: `socks5://<user>:<password>@<host>:<port>`, обновить при ротации прокси |
| `POSTGRES_DB` | `postgres`, `backend`, `bot` | `/home/user1/EventBudjet/.env` на VPS | Меняется только при явной смене БД |
| `POSTGRES_USER` | `postgres`, `backend`, `bot` | `/home/user1/EventBudjet/.env` на VPS | Меняется только при явной ротации |
| `POSTGRES_PASSWORD` | `postgres`, `backend`, `bot` | `/home/user1/EventBudjet/.env` на VPS | Ротация пароля в `.env` и перезапуск сервисов |
| `~/.ssh/cloudru.key` | SSH доступ на текущий VPS | Только на локальной машине владельца | Не хранить в репозитории; при утрате выдать новый ключ |
| SSH пароль/ключ SOCKS5 VPS (`89.22.227.133`) | Админ-доступ к текущему SOCKS5-хосту | Только у владельца (внешний менеджер паролей) | При утечке: ротация SSH-пароля/ключей и hardening входа |
| TLS certs for `calcul.timurgromov.ru` | `nginx` HTTPS | `/etc/letsencrypt/live/calcul.timurgromov.ru/` на VPS | Выпустить заново certbot/Let’s Encrypt при переносе |

## Обязательные env для проекта

Смотри шаблон в [../.env.example](../.env.example).

Критичные переменные:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_API_TOKEN`
- `BOT_ADMIN_CHAT_ID`
- `MINI_APP_URL`
- `BOT_TELEGRAM_PROXY_URL`

## Текущая сеть Telegram (prod)

- Бот работает на Cloud.ru VPS (`185.50.203.2`), но Telegram API вызывает через SOCKS5 на VPS `89.22.227.133:1080`.
- На SOCKS5 VPS поднят `danted`.
- Доступ к SOCKS5 ограничен IP источника `185.50.203.2`.
- В git не хранить логин/пароль SOCKS5; хранить только в `.env` на Cloud.ru VPS.
- Старый proxy VPS `38.180.158.190` можно держать только как временный rollback, пока не принято решение о деcommission.

## Быстрая ротация Telegram bot token

1. Выпустить новый токен в BotFather.
2. Обновить `TELEGRAM_BOT_TOKEN` в `/home/user1/EventBudjet/.env`.
3. Перезапустить сервисы:

```bash
cd /home/user1/EventBudjet
sudo docker compose up -d backend bot
sudo docker compose logs --tail=100 bot
```

## Что новый агент должен знать сразу

- Рабочий доступ и команды: [../OPS_ACCESS.md](../OPS_ACCESS.md)
- Постоянный deploy flow: [../DEPLOY_WORKFLOW.md](../DEPLOY_WORKFLOW.md)
- Быстрый runbook по VPS: [../VPS_RUNBOOK.md](../VPS_RUNBOOK.md)
- План переноса: [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)
- Backup/restore: [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)
