# MemeDam 測試檔案分類

本目錄包含 MemeDam 後端的各種測試檔案，已按功能分類整理。

## 目錄結構

### 📡 API 測試 (`api-tests/`)

測試 API 端點和功能的檔案：

- `user-api-test.js` - 用戶 API 測試
- `real-api-test.js` - 真實 API 測試
- `simple-api-test.js` - 簡單 API 測試
- `api-test.js` - 基礎 API 測試
- `api-pagination-test.js` - API 分頁測試
- `hot-api-test.cjs` - 熱門 API 測試

### 🗄️ 資料庫測試 (`db-tests/`)

測試資料庫連接和操作的檔案：

- `db-connection-test.js` - 資料庫連接測試
- `db-test-cjs.js` - 資料庫測試 (CommonJS)
- `db-test.cjs` - 資料庫測試 (CommonJS)
- `simple-db-test.js` - 簡單資料庫測試
- `simple-mongo-test.cjs` - 簡單 MongoDB 測試

### 🎯 推薦系統測試 (`recommendation-tests/`)

測試推薦演算法的檔案：

- `socialCollaborativeFiltering.test.js` - 社交協同過濾測試
- `mixedRecommendation.test.js` - 混合推薦測試
- `contentBasedRecommendation.test.js` - 內容基礎推薦測試
- `collaborativeFiltering.test.js` - 協同過濾測試
- `socialScoreCalculator.test.js` - 社交分數計算測試
- `test-recommendation-api.cjs` - 推薦 API 測試

### 🔔 通知系統測試 (`notification-tests/`)

測試通知功能的檔案：

- `notification-settings-test.js` - 通知設定測試
- `notification-system-test.js` - 通知系統測試
- `notification-enhancement.test.js` - 通知增強測試

### 📧 電子郵件測試 (`email-tests/`)

測試電子郵件功能的檔案：

- `email-test.js` - 電子郵件功能測試
- `simple-email-test.js` - 簡單電子郵件測試

### 🔍 搜尋和排序測試 (`search-sort-tests/`)

測試搜尋和排序功能的檔案：

- `advancedSearch.test.js` - 進階搜尋測試
- `sorting-test.js` - 排序測試
- `simple-sort-test.js` - 簡單排序測試
- `hot-latest-pagination.test.js` - 熱門最新分頁測試
- `content-tag-collaborative-pagination.test.js` - 內容標籤協同分頁測試
- `infiniteScroll.test.js` - 無限滾動測試

### ⚡ 效能測試 (`performance-tests/`)

測試系統效能的檔案：

- `performance.test.js` - 效能測試
- `analytics.test.js` - 分析測試

### 🐛 除錯和驗證測試 (`debug-tests/`)

用於除錯和驗證修復的檔案：

- `test-cast-error-fix.js` - 類型轉換錯誤修復測試
- `cast-error-verification.js` - 類型轉換錯誤驗證
- `simple-cast-test.js` - 簡單類型轉換測試
- `query-structure-test.js` - 查詢結構測試
- `final-sort-verification.cjs` - 最終排序驗證
- `verify-sort-fix.js` - 排序修復驗證
- `debug-sorting.js` - 排序除錯

### 🖥️ 前端整合測試 (`frontend-tests/`)

測試前端資料整合的檔案：

- `check-frontend-data.cjs` - 前端資料檢查
- `check-infinite-scroll.cjs` - 無限滾動檢查
- `check-memes.cjs` - 迷因資料檢查
- `check-meme-dates.cjs` - 迷因日期檢查

## 使用說明

每個目錄都包含相關功能的測試檔案，可以根據需要執行特定類別的測試：

```bash
# 執行 API 測試
node api-tests/user-api-test.js

# 執行資料庫測試
node db-tests/db-connection-test.js

# 執行推薦系統測試
node recommendation-tests/socialCollaborativeFiltering.test.js
```

## 注意事項

- 部分測試檔案使用 `.cjs` 副檔名，表示使用 CommonJS 模組系統
- 測試檔案命名遵循功能描述，便於識別和維護
- 建議在執行測試前確保資料庫連接正常

# 測試環境設置指南

## 🚨 重要安全提醒

**測試腳本會清理資料庫中的測試資料，請確保：**

1. 使用獨立的測試資料庫
2. 不要在生產環境運行測試
3. 定期備份重要資料

## 環境變數設置

### 1. 測試資料庫設置

在 `.env` 文件中添加：

```bash
# 開發資料庫（主要資料庫）
MONGO_URI=mongodb://localhost:27017/memedam

# 測試資料庫（推薦設置）
MONGODB_TEST_URI=mongodb://localhost:27017/memedam_test

# 環境設置
NODE_ENV=development
```

### 2. 測試資料庫創建

```bash
# 連接到 MongoDB
mongosh

# 創建測試資料庫
use memedam_test

# 創建測試用戶（可選）
db.createUser({
  user: "testuser",
  pwd: "testpassword",
  roles: ["readWrite"]
})
```

## 運行測試

### 安全檢查

測試腳本會自動檢查：

- 是否連接到生產資料庫
- 環境變數設置
- 資料庫連接狀態

### 運行測試

```bash
# 運行檢舉系統測試
node test/report-system-simple-test.js

# 運行所有測試（如果設置了測試腳本）
npm test
```

## 測試資料管理

### 自動清理

測試完成後會自動清理：

- 測試用戶（用戶名以 `testuser_` 開頭）
- 測試迷因（標題以 `測試` 開頭）
- 所有檢舉記錄

### 手動清理

如果需要手動清理測試資料：

```javascript
// 在 MongoDB shell 中執行
use memedam_test

// 清理測試用戶
db.users.deleteMany({ username: { $regex: /^testuser_/ } })

// 清理測試迷因
db.memes.deleteMany({ title: { $regex: /^測試/ } })

// 清理所有檢舉
db.reports.deleteMany({})
```

## 安全最佳實踐

### 1. 環境隔離

- ✅ 使用獨立的測試資料庫
- ✅ 設置 `MONGODB_TEST_URI` 環境變數
- ❌ 不要在生產環境運行測試

### 2. 資料保護

- ✅ 定期備份重要資料
- ✅ 使用測試專用的資料庫
- ✅ 檢查測試腳本的安全設置

### 3. 監控和日誌

- ✅ 檢查測試日誌
- ✅ 監控資料庫變化
- ✅ 設置資料庫備份

## 故障排除

### 問題：測試清理了所有用戶資料

**原因：** 測試腳本使用了生產資料庫連接

**解決方案：**

1. 檢查 `MONGO_URI` 是否指向生產資料庫
2. 設置 `MONGODB_TEST_URI` 指向測試資料庫
3. 確保 `NODE_ENV` 不是 `production`

### 問題：測試無法連接到資料庫

**解決方案：**

1. 檢查 MongoDB 服務是否運行
2. 驗證連接字串格式
3. 檢查網路連接

### 問題：測試用戶名衝突

**解決方案：**

1. 清理現有的測試用戶
2. 使用時間戳生成唯一用戶名
3. 檢查測試腳本的用戶名生成邏輯

## 緊急恢復

如果意外清理了重要資料：

1. **立即停止所有測試**
2. **檢查資料庫備份**
3. **從備份恢復資料**
4. **檢查測試腳本的安全設置**

## 聯繫支持

如果遇到問題，請：

1. 檢查測試日誌
2. 驗證環境設置
3. 聯繫開發團隊
