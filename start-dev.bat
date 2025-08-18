@echo off
chcp 65001 >nul
REM 本地開發啟動腳本 - Windows 版本

REM 設置 UTF-8 編碼環境
set LANG=zh_TW.UTF-8
set LC_ALL=zh_TW.UTF-8
set LC_CTYPE=zh_TW.UTF-8
set LC_MESSAGES=zh_TW.UTF-8
set LC_MONETARY=zh_TW.UTF-8
set LC_NUMERIC=zh_TW.UTF-8
set LC_TIME=zh_TW.UTF-8

REM 設置 Node.js 編碼選項
set NODE_OPTIONS=--max-old-space-size=4096 --trace-uncaught

REM 設置開發環境
set NODE_ENV=development
if "%PORT%"=="" set PORT=4000

echo 🚀 啟動迷因典後端開發服務器...
echo 📝 日誌將以格式化方式顯示，支援中文
echo 🌐 環境: %NODE_ENV%
echo 🔌 端口: %PORT%
echo 🔤 編碼: %LANG%
echo.

REM 啟動應用
node index.js
