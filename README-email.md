# MemeDam Email 功能快速開始指南

## 🚀 快速開始

### 1. 設定環境變數

在 `.env` 檔案中加入以下設定：

```env
# SendGrid 設定
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
SENDGRID_FROM_NAME=MemeDam

# 前端 URL
FRONTEND_URL=http://localhost:3000

# 測試用 email
TEST_EMAIL=your-test-email@gmail.com
```

### 2. 取得 SendGrid API Key

1. 前往 [SendGrid](https://sendgrid.com/) 註冊帳戶
2. 進入 Settings > API Keys
3. 建立新的 API Key
4. 複製 API Key 到 `.env` 檔案

### 3. 驗證發送者 Email

1. 在 SendGrid 中進入 Settings > Sender Authentication
2. 驗證您的 domain 或單一 email 地址
3. 將驗證過的 email 設定為 `SENDGRID_FROM_EMAIL`

### 4. 測試 Email 功能

執行簡單測試：

```bash
npm run test:email
```

執行完整測試：

```bash
npm run test:email:full
```

## 📧 API 端點

### 檢查 Email 服務狀態

```bash
curl http://localhost:3000/api/email/status
```

### 發送測試 Email

```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

### 發送驗證 Email

```bash
curl -X POST http://localhost:3000/api/email/verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "使用者名稱",
    "verificationToken": "verification-token-here"
  }'
```

### 發送密碼重設 Email

```bash
curl -X POST http://localhost:3000/api/email/password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "使用者名稱",
    "resetToken": "reset-token-here"
  }'
```

## 🎯 功能特色

- ✅ 完整的 SendGrid 整合
- ✅ 美觀的 HTML email 模板
- ✅ 速率限制保護
- ✅ 完整的錯誤處理
- ✅ Swagger API 文檔
- ✅ 測試腳本
- ✅ 環境變數驗證

## 📁 檔案結構

```
memedam_backend/
├── config/
│   └── sendgrid.js          # SendGrid 配置
├── controllers/
│   └── emailController.js    # Email 控制器
├── routes/
│   └── emailRoutes.js       # Email 路由
├── utils/
│   └── emailService.js      # Email 服務
├── test/
│   ├── email-test.js        # 完整測試
│   └── simple-email-test.js # 簡單測試
└── docs/
    └── email-setup.md       # 詳細設定指南
```

## 🔧 除錯

### 常見問題

1. **401 Unauthorized**
   - 檢查 `SENDGRID_API_KEY` 是否正確

2. **403 Forbidden**
   - 檢查發送者 email 是否已驗證

3. **400 Bad Request**
   - 檢查 email 格式是否正確

### 除錯步驟

1. 檢查環境變數：`npm run test:email`
2. 查看伺服器日誌
3. 使用 `/api/email/status` 端點檢查設定

## 📚 詳細文檔

更多詳細資訊請參考：

- [Email 設定指南](./docs/email-setup.md)

## 🚀 下一步

1. 整合到註冊流程
2. 實作密碼重設功能
3. 加入 email 驗證狀態追蹤
4. 實作 email 範本管理系統

---

**注意**: 請確保在生產環境中正確設定所有環境變數，並定期監控 email 發送狀態。
