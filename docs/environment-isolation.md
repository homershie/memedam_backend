# 環境隔離指南

## 概述

本專案實現了完整的環境隔離，確保開發、測試和生產環境的完全分離，防止資料洩露和意外操作。

## 環境架構

### 1. 資料庫分離

```
MongoDB Atlas Cluster
├── dev (開發環境)
├── test (測試環境)
└── prod (生產環境)
```

### 2. Redis 分離

```
Redis Instances
├── db 0 (開發環境)
├── db 1 (測試環境)
└── db 2 (生產環境)
```

## 環境變數配置

### 開發環境 (.env)

```bash
NODE_ENV=development
MONGO_DEV_URI=mongodb+srv://username:password@cluster.mongodb.net/dev
REDIS_DEV_URI=redis://localhost:6379/0
```

### 測試環境 (.env.test)

```bash
NODE_ENV=test
MONGO_TEST_URI=mongodb+srv://username:password@cluster.mongodb.net/test
REDIS_TEST_URI=redis://localhost:6379/1
```

### 生產環境 (.env.production)

```bash
NODE_ENV=production
MONGO_PROD_URI=mongodb+srv://username:password@cluster.mongodb.net/prod
REDIS_PROD_URI=redis://localhost:6379/2
SESSION_SECRET=your-production-session-secret
JWT_SECRET=your-production-jwt-secret
```

## 啟動腳本

### 開發環境

```bash
npm run start:dev
# 或
bash scripts/start-dev.sh
```

### 測試環境

```bash
npm run start:test
# 或
bash scripts/start-test.sh
```

### 生產環境

```bash
npm run start:prod
# 或
bash scripts/start-prod.sh
```

## 安全檢查機制

### 1. 環境驗證

- 檢查必要的環境變數是否設置
- 驗證資料庫連接字串格式
- 確認 Redis 連接可用性

### 2. 安全檢查

- 防止生產環境使用開發/測試資料庫
- 防止測試環境使用生產資料庫
- 檢查敏感配置是否正確設置

### 3. 自動化檢查

```javascript
// 自動檢查環境配置
validateEnvironment()
performSecurityCheck()
```

## 環境特定配置

### 開發環境特性

- 詳細的調試日誌
- 寬鬆的速率限制
- 啟用測試端點
- 本地 CORS 設置

### 測試環境特性

- 最小化日誌輸出
- 寬鬆的速率限制（用於測試）
- 啟用測試端點
- 安全的資料清理

### 生產環境特性

- 資訊級別日誌
- 嚴格的速率限制
- 禁用測試端點
- 生產級 CORS 設置

## 資料隔離策略

### 1. 資料庫隔離

- 每個環境使用獨立的資料庫
- 不同的連接池配置
- 環境特定的索引策略

### 2. 快取隔離

- Redis 使用不同的資料庫編號
- 環境特定的快取前綴
- 獨立的快取清理策略

### 3. 檔案隔離

- 環境特定的配置檔案
- 獨立的日誌檔案
- 分離的上傳目錄

## 最佳實踐

### 1. 環境變數管理

- 使用 `.env` 檔案管理本地配置
- 在部署平台設置生產環境變數
- 定期輪換敏感資訊

### 2. 權限控制

- 為每個環境創建獨立的資料庫用戶
- 實施最小權限原則
- 定期審查訪問權限

### 3. 監控和警報

- 監控各環境的資源使用
- 設置異常訪問警報
- 定期檢查環境隔離狀態

### 4. 備份策略

- 為每個環境設置獨立的備份
- 定期測試備份恢復
- 實施災難恢復計劃

## 故障排除

### 常見問題

#### 1. 環境變數未設置

```bash
❌ 錯誤: 未設置 MONGO_DEV_URI 環境變數
解決方案: 檢查 .env 檔案或環境變數設置
```

#### 2. 安全檢查失敗

```bash
❌ 安全警告: 生產環境檢測到開發資料庫連接！
解決方案: 檢查資料庫連接字串配置
```

#### 3. 資料庫連接失敗

```bash
❌ MongoDB 連線失敗
解決方案: 檢查網路連接和資料庫憑證
```

### 緊急處理

#### 1. 環境切換

```bash
# 緊急切換到開發環境
export NODE_ENV=development
npm run dev
```

#### 2. 資料庫恢復

```bash
# 從備份恢復資料
mongorestore --uri="your-backup-uri" --db=your-database
```

#### 3. 配置重置

```bash
# 重置環境配置
rm .env
cp .env.example .env
# 重新設置環境變數
```

## 部署檢查清單

### 開發環境

- [ ] 設置 `MONGO_DEV_URI`
- [ ] 設置 `REDIS_DEV_URI`
- [ ] 確認 `NODE_ENV=development`
- [ ] 測試本地連接

### 測試環境

- [ ] 設置 `MONGO_TEST_URI`
- [ ] 設置 `REDIS_TEST_URI`
- [ ] 確認 `NODE_ENV=test`
- [ ] 運行測試套件

### 生產環境

- [ ] 設置 `MONGO_PROD_URI`
- [ ] 設置 `REDIS_PROD_URI`
- [ ] 設置 `SESSION_SECRET`
- [ ] 設置 `JWT_SECRET`
- [ ] 確認 `NODE_ENV=production`
- [ ] 執行安全檢查
- [ ] 測試生產連接

## 聯繫支持

如果遇到環境隔離相關問題，請：

1. 檢查環境變數設置
2. 查看應用日誌
3. 驗證網路連接
4. 聯繫系統管理員
