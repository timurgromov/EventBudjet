# MIGRATION_CHECKLIST.md

Чеклист для переноса проекта на новый VPS или для быстрого поднятия новой рабочей площадки.

## Когда нужен этот файл

- перенос на новый VPS;
- аварийное восстановление;
- запуск второго окружения;
- подключение зарубежного VPS под `SOCKS5` / future bot routing.

## До начала переноса

Подготовить:

- доступ по SSH на новый VPS;
- установленный Docker + Docker Compose plugin;
- Git и доступ к репозиторию;
- копию актуального `.env`;
- план по домену и DNS;
- решение по Telegram bot token:
  - либо временно использовать старый токен и выключить старого бота в момент cutover;
  - либо выпустить новый токен и обновить `.env`;
- актуальный backup БД.

## Минимальные входные данные

- `VPS_HOST`
- `VPS_USER`
- `SSH_KEY_PATH`
- `PROJECT_DIR`
- домен, который будет смотреть на новый VPS
- кто выдает и хранит реальные секреты

## Базовый перенос на новый VPS

1. Подготовить сервер:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
```

2. Клонировать репозиторий:

```bash
git clone <REPO_URL> EventBudjet
cd EventBudjet
```

3. Создать `.env` на основе `.env.example` и заполнить реальные значения.

4. Если нужен перенос текущих данных:
   - сделать backup на старом VPS;
   - восстановить его на новом VPS по [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).

5. Если переносится текущий домен:
   - перенести или перевыпустить TLS сертификаты;
   - обновить DNS на новый IP;
   - проверить `server_name` и cert paths в [../infra/nginx/default.conf](../infra/nginx/default.conf).

6. Поднять проект:

```bash
sudo docker compose up -d --build
```

7. Проверить сервисы:

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 backend
sudo docker compose logs --tail=100 bot
sudo docker compose logs --tail=100 nginx
```

8. Проверить smoke tests:

- `https://<domain>/`
- `https://<domain>/api/v1/health`
- `/start` у Telegram-бота
- открытие mini app
- запись новых данных в БД
- приход admin notifications

## Telegram bot cutover

Важно: одновременно должен работать только один polling bot с одним токеном.

Правильный порядок:

1. Подготовить новый сервер полностью.
2. Остановить старого бота или выпустить новый токен.
3. Запустить нового бота.
4. Проверить `/start` и admin notifications.

## Если переносится только bot proxy routing

Если основной проект остается на российском VPS, а на зарубежном VPS поднимается только `SOCKS5`:

- текущий backend/frontend/postgres/nginx не переносить;
- на зарубежном VPS поднять только proxy;
- подключить к proxy только контейнер `bot`;
- для текущего проекта единственный рабочий proxy endpoint должен быть один, и он должен быть явно зафиксирован в `OPS_ACCESS.md` и `docs/SECRETS_INVENTORY.md`;
- после этого проверить `bot -> api.telegram.org`.

Это самый простой путь для текущего проекта.

## Rollback

Если новый VPS не проходит smoke checks:

1. вернуть DNS на старый сервер, если уже переключали;
2. вернуть старый bot token или снова запустить старого бота;
3. не вносить ручные правки на новом сервере вне git;
4. разбирать проблему отдельно после восстановления старого прод-пути.
