# MemeDam 品牌遷移總結

## 📋 遷移概述

本次遷移將專案從 `MemeDex` 品牌名稱更改為 `MemeDam`，並更新了相關的網域配置和環境設定。

## 🔄 主要修改內容

### 1. 專案名稱更新

- `package.json`: `memedex_backend` → `memedam_backend`
- 專案描述: "迷因典的後端API" → "迷因達姆的後端API"

### 2. 網域配置更新

- 生產環境網域: `memedex.com` → `memedam.com`
- API 網域: `api.memedex.com` → `api.memedam.com`
- 支援郵箱: `support@memedex.com` → `support@memedam.com`

### 3. 資料庫配置更新

- 資料庫名稱: `memedex` → `memedam`
- Docker 容器名稱: `memedex-redis` → `memedam-redis`
- Docker 容器名稱: `memedex-backend` → `memedam-backend`

### 4. 通知服務環境配置

- 新增 `getFrontendUrl()` 函數，支援環境變數配置
- 支援開發環境: `http://localhost:5173`
- 支援生產環境: `https://memedam.com`
- 環境變數: `FRONTEND_URL` 可自定義前端URL

### 5. 品牌名稱更新

- 所有文檔中的 "迷因典" → "迷因達姆"
- API 文檔標題更新
- 開發團隊名稱更新

## 🔧 環境變數配置

### 新增環境變數

```bash
# 前端URL配置（重要！）
# 開發環境：http://localhost:5173
# 生產環境：https://memedam.com
FRONTEND_URL=http://localhost:5173
```

### 環境變數優先級

1. `FRONTEND_URL` 環境變數（最高優先級）
2. 根據 `NODE_ENV` 自動判斷：
   - `development` 或 `test`: `http://localhost:5173`
   - `production`: `https://memedam.com`

## 📁 修改的檔案清單

### 核心配置檔案

- `package.json` - 專案名稱和描述
- `docker-compose.yml` - 容器名稱和資料庫配置
- `config/swagger.js` - API 文檔配置
- `utils/notificationService.js` - 通知服務URL配置

### 文檔檔案

- `README.md` - 專案概述和環境配置說明
- `docs/api-docs/api-docs.json` - API 文檔配置
- `docs/api-docs/MemeDex-API.json` - API 規範檔案
- `docs/api-docs/swagger-api-documentation.md` - Swagger 文檔
- `docs/api-docs/swagger-implementation-summary.md` - 實作總結
- `docs/performance-docs/performance-optimization.md` - 效能優化文檔
- `docs/user-docs/user-api-enhancements.md` - 用戶API增強文檔
- `docs/README.md` - 文檔目錄
- `test/README.md` - 測試檔案目錄

### 測試檔案

- `test/notification-tests/notification-test.js` - 通知測試
- `test/notification-tests/notification-settings-test.js` - 通知設定測試
- `test/notification-tests/debug-notification.js` - 通知除錯測試
- `test/notification-tests/notification-test-summary.md` - 測試總結

## 🚀 部署注意事項

### 1. 環境變數設定

確保在 `.env` 檔案中設定正確的 `FRONTEND_URL`：

```bash
# 開發環境
FRONTEND_URL=http://localhost:5173

# 生產環境
FRONTEND_URL=https://memedam.com
```

### 2. 資料庫遷移

如果使用現有資料庫，需要更新資料庫名稱：

```bash
# 舊資料庫名稱
mongodb://localhost:27017/memedex

# 新資料庫名稱
mongodb://localhost:27017/memedam
```

### 3. Docker 部署

更新 Docker Compose 配置後，重新建立容器：

```bash
docker-compose down
docker-compose up --build
```

## ✅ 測試檢查清單

- [ ] 通知服務URL生成正確
- [ ] 開發環境使用 `http://localhost:5173`
- [ ] 生產環境使用 `https://memedam.com`
- [ ] API 文檔正常顯示
- [ ] 資料庫連接正常
- [ ] Docker 容器正常運行
- [ ] 所有測試通過

## 🔍 驗證步驟

### 1. 通知服務測試

```bash
# 測試通知URL生成
curl -X POST http://localhost:4000/api/notifications/test
```

### 2. 環境變數測試

```bash
# 檢查環境變數
echo $FRONTEND_URL
echo $NODE_ENV
```

### 3. API 文檔測試

```bash
# 訪問 Swagger UI
curl http://localhost:4000/api-docs
```

## 📝 後續工作

1. **DNS 配置**: 確保 `memedam.com` 和 `api.memedam.com` 的 DNS 記錄正確
2. **SSL 憑證**: 為生產環境配置 SSL 憑證
3. **監控更新**: 更新監控系統中的網域配置
4. **CI/CD 更新**: 更新持續整合/部署流程中的網域配置
5. **第三方服務**: 更新 OAuth 應用程式中的回調URL

---

_遷移完成時間：2025年1月_  
_版本：v2.0.0_  
_維護團隊：迷因達姆開發團隊_
