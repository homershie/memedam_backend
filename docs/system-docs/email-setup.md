# MemeDam Email 服務設定指南

## 概述

MemeDam 使用 SendGrid 作為 email 服務提供商，提供以下功能：

- Email 驗證
- 密碼重設
- 測試 email 發送

## 環境變數設定

在 `.env` 檔案中加入以下變數：

```env
# SendGrid 設定
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
SENDGRID_FROM_NAME=MemeDam

# 前端 URL (用於 email 中的連結)
FRONTEND_URL=http://localhost:3000

# 測試用 email (可選)
TEST_EMAIL=your-test-email@gmail.com
```

### 取得 SendGrid API Key

1. 註冊 SendGrid 帳戶：https://sendgrid.com/
2. 進入 Settings > API Keys
3. 建立新的 API Key
4. 複製 API Key 到 `.env` 檔案

### 驗證發送者 Email

1. 在 SendGrid 中進入 Settings > Sender Authentication
2. 驗證您的 domain 或單一 email 地址
3. 將驗證過的 email 設定為 `SENDGRID_FROM_EMAIL`

## API 端點

### 1. 檢查 Email 服務狀態

```
GET /api/email/status
```

### 2. 發送測試 Email

```
POST /api/email/test
Content-Type: application/json

{
  "email": "recipient@example.com"
}
```

### 3. 發送驗證 Email

```
POST /api/email/verification
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "使用者名稱",
  "verificationToken": "verification-token-here"
}
```

### 4. 發送密碼重設 Email

```
POST /api/email/password-reset
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "使用者名稱",
  "resetToken": "reset-token-here"
}
```

## 測試步驟

### 1. 基本測試

執行測試檔案：

```bash
node test/email-test.js
```

### 2. API 測試

使用 curl 或 Postman 測試：

```bash
# 檢查狀態
curl http://localhost:3000/api/email/status

# 發送測試 email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com"}'
```

### 3. 使用 Postman

1. 開啟 Postman
2. 建立新的請求
3. 設定 URL: `http://localhost:3000/api/email/test`
4. 設定 Method: `POST`
5. 在 Headers 中加入 `Content-Type: application/json`
6. 在 Body 中選擇 `raw` 和 `JSON`，輸入：

```json
{
  "email": "your-email@gmail.com"
}
```

7. 點擊 Send

## 錯誤處理

### 常見錯誤

1. **401 Unauthorized**
   - 檢查 `SENDGRID_API_KEY` 是否正確

2. **403 Forbidden**
   - 檢查發送者 email 是否已驗證
   - 確認 API Key 權限

3. **400 Bad Request**
   - 檢查 email 格式是否正確
   - 確認所有必要參數都已提供

### 除錯步驟

1. 檢查環境變數是否正確設定
2. 確認 SendGrid 帳戶狀態
3. 查看伺服器日誌
4. 使用 `/api/email/status` 端點檢查設定

## Email 模板

### 測試 Email

- 主旨：MemeDam - Email 測試
- 內容：確認 SendGrid 設定成功

### 驗證 Email

- 主旨：MemeDam - 請驗證您的 Email
- 內容：包含驗證連結和 24 小時有效期

### 密碼重設 Email

- 主旨：MemeDam - 密碼重設請求
- 內容：包含重設連結和 1 小時有效期

## 安全性考量

1. **Rate Limiting**: 每個 IP 15 分鐘內最多發送 5 封 email
2. **Email 驗證**: 所有 email 都會驗證格式
3. **Token 安全性**: 驗證和重設 token 都有有效期限制
4. **錯誤處理**: 不會洩露敏感資訊

## 監控和日誌

- 所有 email 發送都會記錄在日誌中
- 使用 `logger.info()` 記錄成功發送
- 使用 `logger.error()` 記錄錯誤

## 下一步

1. 整合到註冊流程中
2. 整合到密碼重設流程中
3. 加入 email 驗證狀態追蹤
4. 實作 email 範本管理系統
