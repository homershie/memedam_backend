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
