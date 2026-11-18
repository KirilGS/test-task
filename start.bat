@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

where docker >nul 2>&1
if errorlevel 1 (
  echo Не найден Docker Desktop. Установите его с сайта https://www.docker.com/products/docker-desktop/, запустите и снова откройте этот файл.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop не запущен. Откройте его, дождитесь зелёного статуса и снова откройте этот файл.
  pause
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
)

echo Запускаем приложение. Первый запуск может занять несколько минут — скачиваются и собираются компоненты.

docker compose up -d --build
if errorlevel 1 (
  echo Не удалось запустить. Частая причина — порт 8080 занят другой программой. Откройте файл .env, замените APP_PORT=8080 на APP_PORT=8090 и запустите снова.
  pause
  exit /b 1
)

set "PORT=8080"
if exist ".env" (
  for /f "usebackq tokens=2 delims==" %%A in (`findstr /b /c:"APP_PORT=" ".env"`) do (
    if not "%%A"=="" set "PORT=%%A"
  )
)

set "READY=0"
for /l %%I in (1,1,90) do (
  if "!READY!"=="0" (
    <nul set /p "=."
    curl.exe -fsS "http://localhost:!PORT!/api/health" >nul 2>&1
    if errorlevel 1 (
      timeout /t 2 /nobreak >nul
    ) else (
      set "READY=1"
    )
  )
)
echo.

if "!READY!"=="1" (
  start "" "http://localhost:!PORT!"
  echo Приложение запущено: http://localhost:!PORT!. Чтобы остановить его, откройте файл stop.bat
) else (
  docker compose logs --tail 30 app
  echo Приложение не ответило. Отправьте этот текст разработчику
)

pause
endlocal
