#!/bin/sh
set -eu

wait_for_service_health() {
  service="$1"
  attempts=0

  while [ "$attempts" -lt 120 ]; do
    container_id="$(docker compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ]; then
      status="$(docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" "$container_id" 2>/dev/null || echo starting)"
      if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
        return 0
      fi
    fi

    attempts=$((attempts + 1))
    sleep 2
  done

  echo "Timed out waiting for service health: $service" >&2
  docker compose ps -a >&2 || true
  exit 1
}

docker compose up -d --build frontend backend postgres nginx
wait_for_service_health postgres
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
wait_for_service_health backend
wait_for_service_health frontend
