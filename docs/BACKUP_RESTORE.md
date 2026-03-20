# BACKUP_RESTORE.md

Базовая инструкция по backup и restore для текущего проекта.

## Что важно сохранить

- PostgreSQL данные;
- актуальный `.env` на VPS;
- TLS сертификаты в `/etc/letsencrypt`;
- DNS настройки домена;
- SSH доступ.

GitHub уже хранит код. Основной невосстановимый без backup слой - это данные и секреты.

## Быстрый backup PostgreSQL на VPS

На текущем VPS:

```bash
cd /home/user1/EventBudjet
set -a
. ./.env
set +a
mkdir -p backups
sudo docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "backups/postgres_$(date +%Y%m%d_%H%M%S).sql"
```

Результат:

- plain SQL dump появится в `/home/user1/EventBudjet/backups/`

## Проверка, что backup создался

```bash
cd /home/user1/EventBudjet
ls -lh backups
```

## Как скачать backup локально

Пример:

```bash
scp -i ~/.ssh/cloudru.key user1@185.50.203.2:/home/user1/EventBudjet/backups/postgres_YYYYMMDD_HHMMSS.sql .
```

## Restore на новом VPS

1. Поднять `postgres` контейнер:

```bash
cd /home/user1/EventBudjet
sudo docker compose up -d postgres
```

2. Загрузить dump на новый VPS.

3. Остановить writers перед restore:

```bash
cd /home/user1/EventBudjet
sudo docker compose stop backend bot
```

4. Восстановить dump:

```bash
cd /home/user1/EventBudjet
set -a
. ./.env
set +a
cat /path/to/postgres_dump.sql | sudo docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

5. Снова поднять сервисы:

```bash
cd /home/user1/EventBudjet
sudo docker compose up -d backend bot nginx frontend
```

## Backup `.env`

`.env` не хранится в git, поэтому его нужно хранить отдельно в защищенном месте:

- password manager;
- encrypted note;
- закрытое хранилище владельца.

Не сохранять реальные секреты в markdown-файлы репозитория.

## Backup TLS certs

Для полного переноса домена нужно отдельно учитывать:

- `/etc/letsencrypt/live/calcul.timurgromov.ru/`
- `/etc/letsencrypt/archive/calcul.timurgromov.ru/`
- auto-renew конфиг certbot, если он используется вне репозитория

Если сертификаты проще перевыпустить на новом сервере, это допустимо.

## Минимальная периодичность

- перед любым переносом;
- перед сменой VPS;
- перед крупными infra-изменениями;
- периодически вручную, если появились новые лиды и история важна.
