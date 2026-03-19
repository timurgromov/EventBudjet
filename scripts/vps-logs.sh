#!/bin/sh
set -eu

ssh -o IdentitiesOnly=yes -i ~/.ssh/cloudru.key user1@185.50.203.2 \
  'cd /home/user1/EventBudjet && sudo docker compose ps && sudo docker compose logs --tail=100 bot && sudo docker compose logs --tail=100 backend'
