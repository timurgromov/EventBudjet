#!/bin/sh
set -eu

docker compose up -d --build frontend backend postgres nginx
