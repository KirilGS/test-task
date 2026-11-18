#!/bin/bash

cd "$(cd "$(dirname "$0")" && pwd)" || exit 1

if docker compose stop; then
  echo "Приложение остановлено. Данные сохранены"
else
  echo "Не удалось остановить приложение."
  read -r _ || true
  exit 1
fi

read -r _ || true
