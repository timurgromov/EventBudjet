#!/bin/sh
set -eu

docker compose stop frontend backend postgres nginx
