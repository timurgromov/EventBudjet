#!/bin/sh
set -eu

ssh -o IdentitiesOnly=yes -i ~/.ssh/cloudru.key user1@185.50.203.2 \
  'bash -lc '"'"'
set -eu

wait_for_service_health() {
  service="$1"
  attempts=0

  while [ "$attempts" -lt 120 ]; do
    container_id="$(sudo docker compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ]; then
      status="$(sudo docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" "$container_id" 2>/dev/null || echo starting)"
      if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
        return 0
      fi
    fi

    attempts=$((attempts + 1))
    sleep 2
  done

  echo "Timed out waiting for service health: $service" >&2
  sudo docker compose ps -a >&2 || true
  exit 1
}

cd /home/user1/EventBudjet
git pull
sudo docker compose up -d --build --force-recreate frontend backend bot
wait_for_service_health frontend
wait_for_service_health backend
sudo docker compose up -d --force-recreate nginx
wait_for_service_health nginx
sudo docker compose ps
'"'"''
