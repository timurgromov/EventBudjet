# VPS_RUNBOOK.md

Этот файл нужен, чтобы быстро дать доступ агенту и одинаково запускать прод.

## 1) Минимум данных для доступа

Заполняй и присылай эти 5 пунктов:

1. `VPS_HOST` (IP или домен), например `185.50.203.2`
2. `VPS_USER` (обычно `root` или `ubuntu`)
3. `SSH_KEY_PATH` (путь к приватному ключу на локальной машине)
4. `PROJECT_DIR` (путь проекта на VPS), например `/opt/EventBudjet`
5. `PROCESS_MANAGER` (`docker compose` / `systemd` / `pm2`)

## 2) Разовый доступ по SSH ключу

На VPS в консоли Cloud.ru под нужным юзером:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo '<PUBLIC_KEY_HERE>' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Важно:
- добавляется **публичный** ключ (`ssh-rsa ...`), не приватный;
- если вход под `root`, добавляй в `/root/.ssh/authorized_keys`;
- если вход под `ubuntu`, добавляй в `/home/ubuntu/.ssh/authorized_keys`.

## 3) Быстрая диагностика бота на VPS

```bash
cd <PROJECT_DIR>
docker compose ps
docker compose logs --tail=200 bot
```

Если используется не docker compose:

```bash
pm2 ls
pm2 logs --lines 200
systemctl list-units --type=service | grep -Ei 'bot|telegram'
```

## 4) Правило, чтобы не ловить Conflict

Должен работать только **один** процесс Telegram-бота с этим токеном.

- Локально бот не поднимать.
- На VPS держать один инстанс.
- При `TelegramConflictError` проверить и остановить дубли.

## 5) Что не хранить в git

- приватные ключи (`*.pem`, `*.key`, `id_rsa`)
- реальные токены и пароли в документации

