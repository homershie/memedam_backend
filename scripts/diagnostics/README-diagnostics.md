# 診斷腳本使用說明

本目錄包含了用於診斷系統各個組件健康的 Vitest 測試腳本。

## 可用的診斷腳本

### 1. 通知系統診斷 (`diagnose-notifications.js`)

測試通知系統的完整功能，包括：

- 資料庫連線
- 用戶建立
- 迷因建立
- 按讚通知處理
- 通知事件和收件項驗證

### 2. Redis 隊列診斷 (`diagnose-redis-queue.js`)

測試 Redis 隊列和通知隊列的功能，包括：

- Redis 連線
- Redis 統計資訊
- 通知隊列健康檢查
- 隊列操作測試

## 正確的執行方式

⚠️ **重要**：這些是 Vitest 測試腳本，不能直接用 Node.js 運行！

### 方法 1: 使用 npm scripts (推薦)

```bash
# 診斷通知系統
npm run diagnose:notifications

# 診斷 Redis 隊列
npm run diagnose:redis-queue

# 同時執行所有診斷
npm run diagnose:all
```

### 方法 2: 直接使用 Vitest

```bash
# 診斷通知系統
npx vitest run scripts/diagnostics/diagnose-notifications.js

# 診斷 Redis 隊列
npx vitest run scripts/diagnostics/diagnose-redis-queue.js

# 執行所有診斷腳本
npx vitest run scripts/diagnostics/**/*diagnose*.js
```

### 方法 3: 監視模式

```bash
# 監視模式運行診斷
npx vitest scripts/diagnostics/diagnose-notifications.js --watch

# 監視模式運行所有診斷
npx vitest scripts/diagnostics/**/*diagnose*.js --watch
```

## 錯誤排除

### 錯誤："未知的環境: development"

- **原因**: 環境變數設定問題
- **解決方案**: 確保 `.env` 文件存在並包含正確的環境變數

### 錯誤："Vitest failed to access its internal state"

- **原因**: 直接用 Node.js 運行 Vitest 腳本
- **解決方案**: 必須使用 `vitest run` 或 npm scripts 運行

### 錯誤：MongoDB/Redis 連線失敗

- **原因**: 資料庫或 Redis 服務未運行
- **解決方案**: 確保相關服務正在運行

## 環境變數要求

腳本會自動設定 `NODE_ENV=test`，但仍需要以下環境變數：

```bash
# 資料庫
MONGO_TEST_URI=mongodb://localhost:27017/memedam_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password (如果有的話)
```

## 輸出說明

每個診斷腳本都會輸出詳細的測試結果：

- ✅ **成功**: 組件運行正常
- ❌ **失敗**: 發現問題，需要修復
- ⚠️ **警告**: 潛在問題，需要關注

## 故障排除

如果遇到問題，請按以下順序檢查：

1. 確保所有依賴服務 (MongoDB, Redis) 正在運行
2. 檢查 `.env` 文件中的環境變數
3. 使用 `npm run diagnose:all` 執行完整診斷
4. 查看控制台輸出以獲取詳細錯誤信息

## 開發說明

如需添加新的診斷測試：

1. 在 `scripts/` 目錄下創建新的 `.js` 文件
2. 使用 Vitest 的 `describe` 和 `it` 結構
3. 在 `vitest.config.js` 中確保包含新的腳本
4. 在 `package.json` 中添加對應的 npm script
