@echo off
chcp 65001 >nul
cd /d "%~dp0"

docker compose stop
if errorlevel 1 (
  echo Не удалось остановить приложение.
  pause
  exit /b 1
)

echo Приложение остановлено. Данные сохранены
pause
