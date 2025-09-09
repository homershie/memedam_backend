@echo off
echo ========================================
echo    MemeDam 贊助商品數據初始化
echo ========================================
echo.

cd /d "%~dp0..\..\"
node scripts/data/initialize-sponsorship-products.js

echo.
echo ========================================
echo    初始化完成！
echo ========================================
pause
