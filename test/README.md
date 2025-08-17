# 測試目錄

本目錄包含迷因典後端的所有測試檔案，按功能分類組織。

## 目錄結構

```
test/
├── README.md                    # 本檔案
├── run-tests.js                 # 統一測試執行器
├── api-tests/                   # API 測試
├── db-tests/                    # 資料庫測試
├── debug-tests/                 # 調試測試
├── email-tests/                 # 電子郵件測試
├── frontend-tests/              # 前端整合測試
├── notification-tests/          # 通知系統測試
├── oauth-tests/                 # OAuth 認證測試
├── performance-tests/           # 效能測試
├── rate-limit-tests/            # 速率限制測試
├── recommendation-tests/        # 推薦系統測試
├── report-tests/                # 檢舉系統測試
├── search-sort-tests/           # 搜尋和排序測試
├── user-cleanup-tests/          # 使用者清理測試
├── username-tests/              # 使用者名稱測試
├── verification-tests/          # 驗證系統測試
└── utils/                       # 測試工具
```

## 測試分類詳情

### API 測試 (`api-tests/`)

- `api-pagination-test.js` - API 分頁測試
- `api-test.js` - 基礎 API 測試
- `change-email-test.js` - 電子郵件變更測試
- `hot-api-test.cjs` - 熱門 API 測試
- `oauth-bind-test.js` - OAuth 綁定測試
- `real-api-test.js` - 真實 API 測試
- `simple-api-test.js` - 簡單 API 測試
- `user-api-test.js` - 使用者 API 測試
- `username-test.js` - 使用者名稱 API 測試

### 資料庫測試 (`db-tests/`)

- `db-connection-test.js` - 資料庫連線測試
- `db-test.cjs` - 資料庫測試 (CJS)
- `db-test-cjs.js` - 資料庫測試 (CJS)
- `simple-db-test.js` - 簡單資料庫測試
- `simple-mongo-test.cjs` - 簡單 MongoDB 測試

### 調試測試 (`debug-tests/`)

- `cast-error-verification.js` - 型別轉換錯誤驗證
- `check-email-existence.js` - 電子郵件存在性檢查
- `debug-sorting.js` - 排序調試
- `delete-user.js` - 使用者刪除測試
- `final-sort-verification.cjs` - 最終排序驗證
- `query-structure-test.js` - 查詢結構測試
- `simple-cast-test.js` - 簡單型別轉換測試
- `simple-email-check.js` - 簡單電子郵件檢查
- `test-cast-error-fix.js` - 型別轉換錯誤修復測試
- `verify-sort-fix.js` - 排序修復驗證

### 電子郵件測試 (`email-tests/`)

- `date-cast-error-test.js` - 日期型別轉換錯誤測試
- `email-test.js` - 電子郵件測試
- `password-reset-test.js` - 密碼重設測試
- `simple-email-test.js` - 簡單電子郵件測試

### 前端整合測試 (`frontend-tests/`)

- `check-frontend-data.cjs` - 前端資料檢查
- `check-infinite-scroll.cjs` - 無限滾動檢查
- `check-meme-dates.cjs` - 迷因日期檢查
- `check-memes.cjs` - 迷因檢查

### 通知系統測試 (`notification-tests/`)

- `api-notification-test.js` - API 通知測試
- `comprehensive-notification-test.js` - 完整通知測試
- `debug-notification.js` - 通知調試
- `end-to-end-notification-test.js` - 端到端通知測試
- `notification-enhancement.test.js` - 通知增強測試
- `notification-fix-test.js` - 通知修復測試
- `notification-settings-test.js` - 通知設定測試
- `notification-system-test.js` - 通知系統測試
- `notification-test.js` - 通知測試
- `notification-test-summary.md` - 通知測試摘要

### OAuth 認證測試 (`oauth-tests/`)

- `cloudflare-session-test.js` - Cloudflare 會話測試
- `discord-email-fix-test.js` - Discord 電子郵件修復測試
- `discord-oauth-fix-test.js` - Discord OAuth 修復測試
- `discord-oauth-session-test.js` - Discord OAuth 會話測試
- `oauth-fix-verification.js` - OAuth 修復驗證
- `test-temp-store.js` - 臨時儲存測試

### 效能測試 (`performance-tests/`)

- `analytics.test.js` - 分析效能測試
- `performance.test.js` - 效能測試

### 速率限制測試 (`rate-limit-tests/`)

- `api-rate-limit-test.js` - API 速率限制測試
- `basic-rate-limit-test.js` - 基礎速率限制測試
- `rate-limit-debug.js` - 速率限制調試
- `rate-limit-diagnose.js` - 速率限制診斷
- `simple-rate-limit-test.js` - 簡單速率限制測試

### 推薦系統測試 (`recommendation-tests/`)

- `collaborativeFiltering.test.js` - 協同過濾測試
- `contentBasedRecommendation.test.js` - 內容基礎推薦測試
- `mixedRecommendation.test.js` - 混合推薦測試
- `socialCollaborativeFiltering.test.js` - 社交協同過濾測試
- `socialScoreCalculator.test.js` - 社交分數計算器測試
- `test-recommendation-api.cjs` - 推薦 API 測試

### 檢舉系統測試 (`report-tests/`)

- `report-system-comprehensive-test.js` - 完整檢舉系統測試
- `report-system-simple-test.js` - 簡單檢舉系統測試

### 搜尋和排序測試 (`search-sort-tests/`)

- `advancedSearch.test.js` - 進階搜尋測試
- `content-tag-collaborative-pagination.test.js` - 內容標籤協同分頁測試
- `hot-latest-pagination.test.js` - 熱門最新分頁測試
- `infiniteScroll.test.js` - 無限滾動測試
- `simple-sort-test.js` - 簡單排序測試
- `sorting-test.js` - 排序測試

### 使用者清理測試 (`user-cleanup-tests/`)

- `has-password-test.js` - 密碼存在性測試
- `test-password-status-api.js` - 密碼狀態 API 測試
- `user-cleanup-test.js` - 使用者清理測試

### 使用者名稱測試 (`username-tests/`)

- `username-optimization-test.js` - 使用者名稱優化測試

### 驗證系統測試 (`verification-tests/`)

- `registration-email-test.js` - 註冊電子郵件測試
- `verification-system-test.js` - 驗證系統測試

### 測試工具 (`utils/`)

- `test-config.js` - 測試配置

## 執行測試

### 使用 npm 腳本

```bash
# 執行所有測試
npm run test:all

# 執行特定類別的測試
npm run test:report                    # 檢舉系統測試
npm run test:report:comprehensive      # 完整檢舉系統測試
npm run test:rate-limit                # 速率限制測試
npm run test:rate-limit:debug          # 速率限制調試
npm run test:rate-limit:diagnose       # 速率限制診斷
npm run test:rate-limit:api            # API 速率限制測試
npm run test:rate-limit:basic          # 基礎速率限制測試
npm run test:notification              # 通知系統測試
npm run test:api                       # API 測試
npm run test:oauth-bind                # OAuth 綁定測試
npm run test:discord-oauth-session     # Discord OAuth 會話測試

# 使用統一測試執行器
npm run test:runner                    # 執行所有測試
npm run test:runner:rate-limit         # 執行速率限制測試
npm run test:runner:report             # 執行檢舉系統測試
npm run test:runner:notification       # 執行通知系統測試
npm run test:runner:debug              # 執行調試測試
npm run test:runner:all                # 執行所有測試
```

### 使用統一測試執行器

```bash
# 查看幫助
node test/run-tests.js --help

# 執行特定類別的測試
node test/run-tests.js rate-limit
node test/run-tests.js report
node test/run-tests.js notification
node test/run-tests.js debug
node test/run-tests.js all

# 執行單一測試檔案
node test/api-tests/simple-api-test.js
node test/report-tests/report-system-simple-test.js
```

## 測試配置

所有測試都使用 `test/utils/test-config.js` 中的配置，包括：

- 測試環境設定
- 資料庫連線配置
- 安全檢查（防止在生產環境執行）
- 資料清理規則

## 安全注意事項

⚠️ **重要**：所有測試都會在測試環境中執行，並包含安全檢查以防止意外在生產環境中執行。

## 開發指南

1. **新增測試**：將新的測試檔案放在適當的子目錄中
2. **更新配置**：如有需要，更新 `test-config.js` 中的配置
3. **更新腳本**：在 `package.json` 中新增相應的測試腳本
4. **更新文檔**：更新本 README.md 檔案以反映變更

## 測試結果

測試執行後會顯示：

- 測試通過/失敗狀態
- 執行時間
- 錯誤訊息（如有）
- 測試摘要
