#!/bin/sh
set -eu

ssh -o IdentitiesOnly=yes -i ~/.ssh/cloudru.key user1@185.50.203.2 \
  'cd /home/user1/EventBudjet && git pull && sudo docker compose up -d --build --force-recreate frontend backend bot nginx'
