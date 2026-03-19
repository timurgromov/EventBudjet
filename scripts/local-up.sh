#!/bin/sh
set -eu

docker compose up -d frontend backend postgres nginx
