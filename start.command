#!/bin/bash

cd "$(cd "$(dirname "$0")" && pwd)" || exit 1

wait_enter() {
  read -r _ || true
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Не найден Docker Desktop. Установите его с сайта https://www.docker.com/products/docker-desktop/, запустите и снова откройте этот файл."
  wait_enter
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop не запущен. Откройте его, дождитесь зелёного статуса и снова откройте этот файл."
  wait_enter
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "Запускаем приложение. Первый запуск может занять несколько минут — скачиваются и собираются компоненты."

if ! docker compose up -d --build; then
  echo "Не удалось запустить. Частая причина — порт 8080 занят другой программой. Откройте файл .env, замените APP_PORT=8080 на APP_PORT=8090 и запустите снова."
  wait_enter
  exit 1
fi

port="8080"
if [ -f .env ]; then
  line="$(grep -E '^APP_PORT=' .env | tail -n 1 || true)"
  value="${line#APP_PORT=}"
  value="${value//$'\r'/}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    port="$value"
  fi
fi

ready=0
deadline=$((SECONDS + 180))
while [ "$SECONDS" -lt "$deadline" ]; do
  printf '.'
  if curl -fsS --max-time 5 "http://localhost:${port}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
printf '\n'

if [ "$ready" -eq 1 ]; then
  url="http://localhost:${port}"
  if [ "$(uname -s)" = "Darwin" ]; then
    open "$url"
  else
    xdg-open "$url"
  fi
  echo "Приложение запущено: ${url}. Чтобы остановить его, откройте файл stop.command (stop.sh в Linux)"
  wait_enter
  exit 0
fi

docker compose logs --tail 30 app
echo "Приложение не ответило. Отправьте этот текст разработчику"
wait_enter
exit 1
