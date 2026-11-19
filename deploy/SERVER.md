# Сервер проектов

Один VPS в России. Снаружи открыты только порты 22, 80 и 443. На нём уже работает Отклик, домен `ot-click.ru`. Новые проекты сажаются рядом и не делят с ним каталоги, порт API и базу.

Пользователь для команд — `deploy`. Вход с Мака:

```bash
ssh -i ~/.ssh/otklik deploy@IP-СЕРВЕРА
```

Блок `bash` — одна команда. Блоки `caddy`, `yaml` и `dotenv` в терминал не вставляются: это текст файла в `nano`.

## Что уже стоит

| Что | Где |
| --- | --- |
| Сайты | Caddy, файл `/etc/caddy/Caddyfile`. Сертификат выпускается сам, когда A-запись домена смотрит на IP сервера |
| Отклик, файлы сайта | `/var/www/otklik` |
| Отклик, код | `/opt/otklik` |
| Отклик, API | `127.0.0.1:3000`, контейнер из `/opt/otklik/watch-reviews-back/docker-compose.prod.yml` |
| Общая Mongo | контейнер `mongo`, каталог `/opt/mongo`. Порт 27017 наружу не открыт |
| Сеть Docker для базы | `shared`. Её видят только контейнеры, которым она указана |
| База Отклика | `watch-reviews`, пользователь `otklik` |
| Копии | `/var/backups/mongo` |

Пароль администратора Mongo лежит в `/opt/mongo/.env`, переменная `MONGO_INITDB_ROOT_PASSWORD`. Пароль пользователя проекта лежит только в `.env` этого проекта.

Caddy читает каталог сайта от своего пользователя. После копирования файлов каталоги должны быть `755`, файлы `644`. Иначе сайт открывается с ошибкой 403.

Порт следующего API — `3001`, потом `3002`. Порт Отклика `3000` не занимать. Mongo второй раз не запускать.

## Домен

У регистратора одна A-запись на IP этого сервера. Проверка с Мака:

```bash
dig +short ДОМЕН
```

В ответе IP сервера. Пока записи нет, Caddy не выпустит сертификат.

## Только Vue

Статика. Своей базы и своего API нет. Имя проекта ниже — `site`, домен — `ДОМЕН`. Подставьте свои.

Две отдельные команды:

```bash
sudo mkdir -p /opt/site /var/www/site
```

```bash
sudo chown -R deploy:deploy /opt/site /var/www/site
```

```bash
cd /opt/site
```

```bash
git clone АДРЕС-РЕПОЗИТОРИЯ .
```

Сборка. Команды `npm ci` и `npm run build` подставьте те, что есть в репозитории. Каталог `dist` — обычный результат Vite. Если сборка кладёт файлы в другое место, в `rsync` укажите его.

```bash
npm ci
```

```bash
npm run build
```

```bash
rsync -a --delete dist/ /var/www/site/
```

```bash
sudo chmod 755 /var/www /var/www/site
```

```bash
sudo find /var/www/site -type d -exec chmod 755 {} \;
```

```bash
sudo find /var/www/site -type f -exec chmod 644 {} \;
```

Блок в конец `/etc/caddy/Caddyfile`. Это не команда.

```bash
sudo nano /etc/caddy/Caddyfile
```

```caddy
ДОМЕН {
	encode gzip
	root * /var/www/site

	handle {
		try_files {path} /index.html
		file_server
	}
}
```

`try_files` нужен, чтобы маршруты Vue вроде `/about` открывались напрямую, а не только с главной. Две отдельные команды:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

```bash
sudo systemctl reload caddy
```

Проверка с Мака. Ожидается `200`.

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://ДОМЕН/
```

Обновление этого сайта. Четыре отдельные команды из `/opt/site`:

```bash
git pull
```

```bash
npm ci
```

```bash
npm run build
```

```bash
rsync -a --delete dist/ /var/www/site/
```

После `rsync` снова три команды `chmod` и `find` выше, если Caddy снова ответит 403.

## Vue, NestJS и Mongo

Тот же сервер. У проекта свой каталог, свой порт API, своя база и свой пользователь Mongo. Общий контейнер `mongo` и сеть `shared` уже есть. Имя проекта ниже — `app`, база и пользователь — `app`, домен — `ДОМЕН`, порт на хосте — `3001`.

Пароль пользователя базы без символов `@ : / ? #`. Одна команда, вывод сохраните.

```bash
openssl rand -hex 24
```

Пользователь видит только свою базу. Одна команда. Пароль администратора возьмите из `/opt/mongo/.env`.

```bash
docker exec mongo mongosh --username root --password "ПАРОЛЬ-АДМИНИСТРАТОРА" --authenticationDatabase admin --eval 'db.getSiblingDB("app").createUser({user:"app",pwd:"ПАРОЛЬ-ПРОЕКТА",roles:[{role:"readWrite",db:"app"}]})'
```

В ответе `"ok": 1`.

Каталоги. Две отдельные команды:

```bash
sudo mkdir -p /opt/app /var/www/app
```

```bash
sudo chown -R deploy:deploy /opt/app /var/www/app
```

Код. Если фронт и бэкенд в разных репозиториях, клонируйте их в `/opt/app/front` и `/opt/app/back`.

```bash
cd /opt/app
```

```bash
git clone АДРЕС-ФРОНТА front
```

```bash
git clone АДРЕС-БЭКЕНДА back
```

Файл `/opt/app/back/.env`. В терминал не вставлять, пока не открыт `nano`. Секреты проекта свои, не из Отклика. `JWT_SECRET` не короче 32 байт: `openssl rand -base64 32`.

```bash
umask 077
```

```bash
nano /opt/app/back/.env
```

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
MONGODB_URI=mongodb://app:ПАРОЛЬ-ПРОЕКТА@mongo:27017/app?authSource=app
CORS_ORIGINS=https://ДОМЕН
TRUST_PROXY=true
APP_PUBLIC_URL=https://ДОМЕН
```

Остальные переменные — как требует этот бэкенд. Для Отклика полный список в `DEPLOY.md`.

```bash
chmod 600 /opt/app/back/.env
```

Файл `/opt/app/back/docker-compose.prod.yml`. Контейнер слушает 3000, с хоста он доступен только как `127.0.0.1:3001`.

```bash
nano /opt/app/back/docker-compose.prod.yml
```

```yaml
services:
  api:
    build: .
    restart: unless-stopped
    ports:
      - '127.0.0.1:3001:3000'
    env_file: .env
    environment:
      TRUST_PROXY: 'true'
    networks:
      - shared

networks:
  shared:
    external: true
    name: shared
```

Если у этого Nest нет Dockerfile, его нужно добавить до сборки. Образ Отклика подходит как образец: `watch-reviews-back/Dockerfile`, сборка `npm run build`, запуск `node dist/main.js`.

Запуск API. Две отдельные команды.

```bash
cd /opt/app/back
```

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Фронт. Адрес API зашивается при сборке. Для Vite это файл `.env.production.local`.

```bash
cd /opt/app/front
```

```bash
nano .env.production.local
```

```dotenv
VITE_API_URL=https://ДОМЕН/api
```

Четыре отдельные команды:

```bash
npm ci
```

```bash
npm run build
```

```bash
rsync -a --delete dist/ /var/www/app/
```

```bash
sudo chmod 755 /var/www /var/www/app
```

```bash
sudo find /var/www/app -type d -exec chmod 755 {} \;
```

```bash
sudo find /var/www/app -type f -exec chmod 644 {} \;
```

Блок Caddy. Пути `/api` уходят в Nest. Остальное — собранный Vue. Если у бэкенда есть вебхуки вне `/api`, для них добавьте такой же `handle`, как у Отклика для `/hooks`.

```bash
sudo nano /etc/caddy/Caddyfile
```

```caddy
ДОМЕН {
	encode gzip
	root * /var/www/app

	handle /api/* {
		reverse_proxy 127.0.0.1:3001
	}

	handle {
		try_files {path} /index.html
		file_server
	}
}
```

Две отдельные команды:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

```bash
sudo systemctl reload caddy
```

Проверка с сервера, затем с Мака. Первая команда должна показать, что API жив. Вторая печатает `200`.

```bash
curl -fsS http://127.0.0.1:3001/api
```

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://ДОМЕН/
```

Адрес проверки API замените на тот, который реально есть у проекта. У Отклика это `/health/ready`.

Обновление бэкенда:

```bash
cd /opt/app/back
```

```bash
git pull
```

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Обновление фронта — те же `git pull`, `npm ci`, `npm run build`, `rsync` и права на `/var/www/app`, что и при первом запуске.

Логи API:

```bash
docker compose -f /opt/app/back/docker-compose.prod.yml logs -f api
```

Выход из просмотра — Ctrl+C.

## Чего не делать

Не публикуйте `27017` и не добавляйте порты API в `ufw`. Не используйте базу `watch-reviews` и пользователя `otklik` для другого проекта. Не копируйте `.env` Отклика. Не запускайте `docker compose down -v` в `/opt/mongo`: эта команда стирает базы всех проектов.
