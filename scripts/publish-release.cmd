@echo off
chcp 65001 >nul
setlocal

echo.
echo === Публикация RoomKanban на GitHub Releases ===
echo.

if "%GH_TOKEN%"=="" (
  echo Ошибка: не задан GH_TOKEN.
  echo.
  echo 1. GitHub - Settings - Developer settings - Personal access tokens
  echo 2. Создайте токен с правом "repo"
  echo 3. В PowerShell:
  echo    $env:GH_TOKEN = "ghp_ваш_токен"
  echo    npm run dist:publish
  echo.
  exit /b 1
)

call npm run dist:publish
if errorlevel 1 exit /b 1

echo.
echo Готово. Релиз опубликован на GitHub.
echo Пользователи смогут обновляться кнопкой "Обновить" в приложении.
echo.
