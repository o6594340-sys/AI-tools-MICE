@echo off
chcp 65001 > nul
title MICE Draft

echo.
echo  ╔══════════════════════════════╗
echo  ║        MICE Draft            ║
echo  ╚══════════════════════════════╝
echo.

:: Создать .env если его нет
if not exist ".env" (
    echo  Первый запуск — нужен API-ключ Anthropic.
    echo  Найти ключ: https://console.anthropic.com/settings/keys
    echo.
    set /p API_KEY=" Вставьте ключ и нажмите Enter: "
    echo ANTHROPIC_API_KEY=%API_KEY%> .env
    echo.
    echo  Ключ сохранён.
    echo.
)

:: Установить зависимости
echo  Устанавливаю зависимости...
pip install -r requirements.txt -q
echo  Готово.
echo.

:: Загрузить переменные из .env
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

:: Запустить приложение
echo  Запускаю сервер...
echo  Браузер откроется автоматически.
echo.
echo  Для остановки — закрой это окно или нажми Ctrl+C
echo.

timeout /t 2 /nobreak > nul
start "" http://localhost:5000
python app.py

pause
