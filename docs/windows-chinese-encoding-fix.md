# Windows 中文編碼問題解決方案

## 問題描述

在 Windows 環境下運行迷因典後端時，日誌中的中文可能出現亂碼問題。

## 原因分析

1. Windows 預設使用字碼頁 950（繁體中文）
2. Node.js 和 pino logger 需要正確的 UTF-8 編碼設定
3. 環境變數 `LANG` 和 `LC_ALL` 未正確設定

## 解決方案

### 方法一：使用提供的啟動腳本（推薦）

#### Windows 用戶

```cmd
# 使用 npm 腳本（推薦）
npm run dev:win

# 或直接執行批次檔案
start-dev.bat
```

#### Linux/macOS 用戶

```bash
./start-dev.sh
```

### 方法二：手動設定環境變數

在啟動服務器前，手動設定以下環境變數：

```cmd
REM Windows CMD
chcp 65001
set LANG=zh_TW.UTF-8
set LC_ALL=zh_TW.UTF-8
set NODE_ENV=development
node index.js
```

```bash
# Linux/macOS
export LANG=zh_TW.UTF-8
export LC_ALL=zh_TW.UTF-8
export NODE_ENV=development
node index.js
```

### 方法三：永久設定系統環境變數

1. 開啟系統環境變數設定
2. 新增或修改以下變數：
   - `LANG` = `zh_TW.UTF-8`
   - `LC_ALL` = `zh_TW.UTF-8`
   - `NODE_ENV` = `development`

## 驗證方法

啟動服務器後，檢查日誌是否正確顯示中文：

```
[2025-08-18 15:00:43.336 +0800] INFO: 迷因典後端服務器啟動中...
[2025-08-18 15:00:43.336 +0800] INFO: 資料庫連接成功
[2025-08-18 15:00:43.336 +0800] INFO: Redis 連接成功
```

## 技術細節

### 修改的檔案

1. `start-dev.sh` - Linux/macOS 啟動腳本
2. `start-dev.bat` - Windows 完整啟動腳本
3. `package.json` - 新增 `dev:win` 腳本
4. `utils/logger.js` - 日誌配置優化

### 關鍵設定

- 強制設定 UTF-8 編碼：`chcp 65001`
- 環境變數：`LANG=zh_TW.UTF-8`, `LC_ALL=zh_TW.UTF-8`
- Node.js 編碼：`process.stdout.setEncoding('utf8')`
- pino logger 優化：針對 Windows 環境的特殊處理

## 注意事項

1. 確保終端機支援 UTF-8 編碼
2. 如果使用 VS Code 終端機，建議設定為 UTF-8 編碼
3. 某些舊版 Windows 可能需要額外的字體支援
4. 建議使用 Windows Terminal 或 PowerShell 7+ 以獲得更好的 Unicode 支援

## 故障排除

如果仍然出現亂碼：

1. 檢查終端機編碼：`chcp`
2. 確認環境變數：`echo %LANG%`
3. 嘗試使用不同的終端機應用程式
4. 檢查 Node.js 版本是否支援 UTF-8
