# 聯絡表單功能實現文檔

## 概述

本功能允許使用者透過聯絡頁面發送訊息到 `support@memedam.com`，實現了完整的表單驗證、API 串接和 email 發送功能。

## 功能特點

- ✅ 完整的表單驗證（前端 + 後端）
- ✅ 美觀的 HTML email 模板
- ✅ 速率限制保護
- ✅ 錯誤處理和用戶回饋
- ✅ 完整的 API 文檔（Swagger）
- ✅ 單元測試覆蓋

## 技術實現

### 後端實現

#### 1. Email 服務 (`utils/emailService.js`)

新增 `sendContactFormEmail` 方法：

```javascript
static async sendContactFormEmail(contactData) {
  const { fullName, email, topic, userType, message } = contactData

  const subject = `MemeDam - 聯絡表單: ${topic}`
  // 發送美觀的 HTML email 到 support@memedam.com
}
```

#### 2. Email 控制器 (`controllers/emailController.js`)

新增 `sendContactForm` 方法，包含：

- 必填欄位驗證
- Email 格式驗證
- 訊息長度驗證
- 錯誤處理和日誌記錄

#### 3. API 路由 (`routes/emailRoutes.js`)

新增 `POST /api/email/contact` 端點：

- 完整的 Swagger 文檔
- 速率限制（15分鐘內最多5次）
- 請求驗證

### 前端實現

#### 1. Email 服務 (`src/services/emailService.js`)

新增 `sendContactForm` 方法：

```javascript
sendContactForm(contactData) {
  return apiService.http.post('/api/email/contact', contactData)
}
```

#### 2. 聯絡頁面 (`src/pages/contact.vue`)

更新表單提交邏輯：

- 移除模擬 API 調用
- 整合真實的 email 服務
- 改善錯誤處理和用戶回饋
- 移除不必要的電話號碼欄位

## API 規格

### POST /api/email/contact

**請求體：**

```json
{
  "fullName": "string (必填)",
  "email": "string (必填，有效 email 格式)",
  "topic": "string (必填，enum: general|technical|report|partnership|other)",
  "userType": "string (必填，enum: general|creator|business|student|media|other)",
  "message": "string (必填，最少10字元)"
}
```

**成功回應：**

```json
{
  "success": true,
  "message": "聯絡表單已成功送出，我們會盡快回覆您",
  "data": {
    "fullName": "string",
    "email": "string",
    "topic": "string",
    "userType": "string",
    "submittedAt": "ISO 8601 timestamp"
  }
}
```

**錯誤回應：**

```json
{
  "success": false,
  "message": "錯誤訊息",
  "error": {
    "code": "錯誤代碼",
    "details": "詳細錯誤資訊"
  }
}
```

## Email 模板

發送到 `support@memedam.com` 的 email 包含：

- 美觀的 HTML 格式
- 響應式設計（支援深色模式）
- 完整的表單資料展示
- 時間戳記
- MemeDam 品牌元素

## 安全性考量

1. **速率限制**：15分鐘內最多5次提交
2. **輸入驗證**：前後端雙重驗證
3. **XSS 防護**：HTML 內容轉義
4. **CORS 保護**：限制允許的來源

## 測試

### 單元測試

創建了完整的 API 測試 (`test/integration/api/contact-form.test.js`)：

- ✅ 成功提交測試
- ✅ 必填欄位驗證測試
- ✅ Email 格式驗證測試
- ✅ 訊息長度驗證測試
- ✅ 空白字元處理測試

### 手動測試

1. 訪問聯絡頁面
2. 填寫表單並提交
3. 檢查 email 是否正確發送到 support@memedam.com
4. 驗證錯誤處理（嘗試提交無效資料）

## 部署注意事項

1. 確保 `SENDGRID_API_KEY` 環境變數已設定
2. 確保 `SENDGRID_FROM_EMAIL` 環境變數已設定
3. 確保 SendGrid 已驗證 `support@memedam.com` 為收件人

## 未來改進

- [ ] 添加 CAPTCHA 驗證
- [ ] 實現自動回覆功能
- [ ] 添加聯絡表單管理後台
- [ ] 實現 email 模板多語言支援
- [ ] 添加聯絡表單統計分析

## 相關文件

- [SendGrid 設定指南](../reCAPTCHA-setup-guide.md)
- [Email 服務文檔](../email-service-documentation.md)
- [API 文檔](../api-docs/email-api-documentation.md)
