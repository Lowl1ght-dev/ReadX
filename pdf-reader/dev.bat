@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/2] Освобождаю порт 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [2/2] Запуск npm run dev...
echo.
call npm run dev

echo.
pause
