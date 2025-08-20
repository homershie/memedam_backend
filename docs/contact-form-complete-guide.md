# 聯絡表單完整實現指南

## 目錄

1. [概述](#概述)
2. [功能特點](#功能特點)
3. [技術實現](#技術實現)
4. [環境設定](#環境設定)
5. [API 規格](#api-規格)
6. [前端整合](#前端整合)
7. [reCAPTCHA 整合](#recaptcha-整合)
8. [Email 模板](#email-模板)
9. [安全性考量](#安全性考量)
10. [測試](#測試)
11. [部署指南](#部署指南)
12. [故障排除](#故障排除)
13. [使用方式](#使用方式)
14. [未來改進](#未來改進)

## 概述

聯絡表單功能已完整實現，整合了 Google reCAPTCHA v3 防垃圾訊息保護、SendGrid email 發送、完整的前後端驗證，以及美觀的 HTML email 模板。使用者可透過聯絡頁面發送訊息到 `support@memedam.com`。

## 功能特點

### ✅ 核心功能

- 完整的表單驗證（前端 + 後端）
- Google reCAPTCHA v3 整合
- SendGrid email 發送
- 美觀的響應式 HTML email 模板
- 速率限制保護（15分鐘內最多5次）
- 開發環境友好設定

### ✅ 安全性

- reCAPTCHA v3 無需使用者互動
- 分數閾值設定（0.5）
- 輸入驗證和清理
- 敏感資訊保護
- XSS 防護

### ✅ 用戶體驗

- 用戶友好的錯誤處理
- 自動 reCAPTCHA 驗證
- 即時表單驗證
- 成功提交回饋

## 技術實現

### 後端架構

#### 1. EmailController (`controllers/emailController.js`)

```javascript
// reCAPTCHA 驗證函數
const verifyRecaptcha = async (recaptchaToken) => {
  // 檢查環境設定
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    return true // 開發環境允許通過
  }

  // 向 Google API 驗證
  const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
    params: {
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: recaptchaToken,
    },
  })

  return response.data.success && response.data.score >= 0.5
}

// 聯絡表單處理
static async sendContactForm(req, res) {
  const { fullName, email, topic, userType, message, recaptchaToken } = req.body

  // 驗證 reCAPTCHA
  const isRecaptchaValid = await verifyRecaptcha(recaptchaToken)
  if (!isRecaptchaValid) {
    return res.status(400).json({
      success: false,
      message: 'reCAPTCHA 驗證失敗，請重新驗證'
    })
  }

  // 驗證表單資料
  // 發送 email
  // 返回結果
}
```

#### 2. EmailService (`utils/emailService.js`)

```javascript
static async sendContactFormEmail(contactData) {
  const { fullName, email, topic, userType, message } = contactData

  const msg = {
    to: 'support@memedam.com',
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `MemeDam - 聯絡表單: ${getTopicLabel(topic)}`,
    html: generateContactEmailTemplate(contactData)
  }

  return await sgMail.send(msg)
}
```

#### 3. API 路由 (`routes/emailRoutes.js`)

```javascript
// 速率限制
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 最多 5 次請求
  message: {
    success: false,
    message: '發送 email 過於頻繁，請稍後再試',
  },
})

router.post('/contact', emailRateLimit, EmailController.sendContactForm)
```

### 前端架構

#### 1. EmailService (`src/services/emailService.js`)

```javascript
class EmailService {
  // reCAPTCHA 驗證
  async executeRecaptcha(action = 'submit_contact') {
    const grecaptcha = await this.loadRecaptchaScript()
    return new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(this.checkRecaptchaConfig(), { action }).then(resolve).catch(reject)
      })
    })
  }

  // 發送聯絡表單
  async sendContactForm(contactData) {
    const recaptchaToken = await this.executeRecaptcha()
    return apiService.http.post('/api/email/contact', {
      ...contactData,
      recaptchaToken,
    })
  }
}
```

#### 2. 聯絡頁面 (`src/pages/contact.vue`)

自動處理 reCAPTCHA 驗證和錯誤處理：

```javascript
const submitForm = async () => {
  if (!validateForm()) return

  try {
    const response = await emailService.sendContactForm({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      topic: form.topic,
      userType: form.userType,
      message: form.message.trim(),
    })

    // 成功處理
  } catch (error) {
    // 錯誤處理
  }
}
```

## 環境設定

### 必要環境變數

#### 後端 (.env)

```bash
# reCAPTCHA 設定
RECAPTCHA_SECRET_KEY=your_secret_key_here

# SendGrid 設定
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_from_email@domain.com
FRONTEND_URL=https://your-domain.com
```

#### 前端 (.env)

```bash
# reCAPTCHA 設定
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

### 取得 reCAPTCHA 金鑰

1. **前往 Google reCAPTCHA 管理頁面**
   - 訪問 [Google reCAPTCHA 管理頁面](https://www.google.com/recaptcha/admin)
   - 使用 Google 帳戶登入

2. **建立新的 reCAPTCHA 網站**
   - 點擊「+」按鈕建立新網站
   - 選擇 **reCAPTCHA v3**
   - 填寫網站資訊：
     - 標籤：`迷因典聯絡表單`
     - 網域：`localhost` (開發) 和生產網域
   - 接受條款並提交

3. **取得金鑰**
   - **網站金鑰 (Site Key)**：用於前端
   - **密鑰 (Secret Key)**：用於後端

## API 規格

### POST /api/email/contact

發送聯絡表單，需要 reCAPTCHA 驗證。

#### 請求格式

```json
{
  "fullName": "使用者姓名",
  "email": "user@example.com",
  "topic": "general",
  "userType": "general",
  "message": "訊息內容（至少10個字元）",
  "recaptchaToken": "reCAPTCHA 驗證 token"
}
```

#### 欄位說明

- `fullName`: 必填，使用者姓名
- `email`: 必填，有效的 email 格式
- `topic`: 必填，主題選項 (`general`|`technical`|`report`|`partnership`|`other`)
- `userType`: 必填，用戶類型 (`general`|`creator`|`business`|`student`|`media`|`other`)
- `message`: 必填，訊息內容（最少10字元）
- `recaptchaToken`: 必填，reCAPTCHA 驗證 token

#### 成功回應

```json
{
  "success": true,
  "message": "聯絡表單已成功送出，我們會盡快回覆您",
  "data": {
    "fullName": "使用者姓名",
    "email": "user@example.com",
    "topic": "general",
    "userType": "general",
    "submittedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 錯誤回應

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

### GET /api/email/status

檢查 email 服務狀態。

#### 回應格式

```json
{
  "success": true,
  "message": "Email 服務狀態檢查完成",
  "status": {
    "sendgridConfigured": true,
    "fromEmailConfigured": true,
    "frontendUrlConfigured": true,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 前端整合

### 自動 reCAPTCHA 驗證

聯絡表單會自動執行 reCAPTCHA 驗證：

```javascript
import emailService from '@/services/emailService'

// 自動處理 reCAPTCHA 驗證
const response = await emailService.sendContactForm({
  fullName: '使用者姓名',
  email: 'user@example.com',
  topic: 'general',
  userType: 'general',
  message: '訊息內容',
})
```

### 錯誤處理

前端會處理各種錯誤情況：

- **設定未完成**：「系統設定問題，請聯絡管理員」
- **網路連線問題**：「網路連線問題，請檢查網路後重新嘗試」
- **reCAPTCHA 驗證失敗**：「驗證失敗，請重新嘗試」
- **表單驗證錯誤**：顯示具體欄位錯誤

## reCAPTCHA 整合

### 驗證流程

1. **前端流程**

   ```
   用戶填寫表單 → 自動載入 reCAPTCHA 腳本 → 執行驗證 → 取得 token → 發送請求
   ```

2. **後端流程**
   ```
   接收請求 → 驗證 reCAPTCHA token → 驗證表單資料 → 發送 email → 返回結果
   ```

### 開發環境

在開發環境中，如果沒有設定 `RECAPTCHA_SECRET_KEY`，系統會：

1. 記錄警告訊息
2. 允許 reCAPTCHA 驗證通過（開發便利）
3. 繼續執行其他驗證

## Email 模板

發送到 `support@memedam.com` 的 email 包含：

- 美觀的 HTML 格式
- 響應式設計（支援深色模式）
- 完整的表單資料展示
- 時間戳記和品牌元素
- MemeDam 品牌配色

### 模板範例

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>MemeDam 聯絡表單</title>
  </head>
  <body>
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <h2 style="color: #2563eb;">MemeDam 聯絡表單</h2>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
        <p><strong>姓名：</strong>{{fullName}}</p>
        <p><strong>Email：</strong>{{email}}</p>
        <p><strong>主題：</strong>{{topic}}</p>
        <p><strong>用戶類型：</strong>{{userType}}</p>
        <p><strong>訊息：</strong></p>
        <div style="background: white; padding: 15px; border-radius: 4px;">{{message}}</div>
      </div>
    </div>
  </body>
</html>
```

## 安全性考量

### reCAPTCHA 保護

- 使用 reCAPTCHA v3，無需使用者互動
- 分數閾值設定為 0.5
- 自動驗證可疑行為

### 輸入驗證

- 前後端雙重驗證
- Email 格式檢查
- 訊息長度限制
- HTML 內容轉義
- 輸入資料 trim 處理

### 速率限制

- 15分鐘內最多5次請求
- 基於 IP 地址限制
- 防止自動化攻擊

### 資料保護

- 敏感資訊不記錄在日誌中
- 使用 HTTPS 傳輸
- 環境變數保護 API 金鑰

## 測試

### 執行測試

```bash
# 執行所有測試
npm test

# 執行聯絡表單相關測試
npm test contact-form.test.js

# 執行測試並顯示覆蓋率
npm run test:coverage
```

### 測試案例

#### 後端測試 (`test/integration/api/contact-form.test.js`)

- ✅ 拒絕缺少 reCAPTCHA token 的請求
- ✅ 拒絕無效的 email 格式
- ✅ 拒絕訊息長度不足的請求
- ✅ 拒絕缺少必填欄位的請求
- ✅ 開發環境中的 reCAPTCHA 驗證
- ✅ email 服務狀態檢查

#### 測試結果

```
✅ 6 個測試案例全部通過
✅ 涵蓋所有主要功能點
```

### 手動測試清單

1. **功能測試**
   - [ ] 訪問聯絡頁面
   - [ ] 填寫完整表單並提交
   - [ ] 檢查成功訊息顯示
   - [ ] 確認 email 發送到 support@memedam.com

2. **驗證測試**
   - [ ] 提交空白表單（應顯示錯誤）
   - [ ] 輸入無效 email（應顯示錯誤）
   - [ ] 輸入過短訊息（應顯示錯誤）

3. **reCAPTCHA 測試**
   - [ ] 正常提交（應自動驗證）
   - [ ] 檢查開發環境設定

## 部署指南

### 生產環境部署

1. **設定環境變數**

   ```bash
   # 後端
   RECAPTCHA_SECRET_KEY=your_production_secret_key
   SENDGRID_API_KEY=your_production_sendgrid_key
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   FRONTEND_URL=https://yourdomain.com

   # 前端
   VITE_RECAPTCHA_SITE_KEY=your_production_site_key
   ```

2. **SendGrid 設定**
   - 驗證發送者 email 地址
   - 設定 DNS 記錄（SPF, DKIM）
   - 測試 email 發送功能

3. **reCAPTCHA 設定**
   - 在 Google Console 中添加生產網域
   - 更新金鑰設定
   - 測試驗證功能

### 部署檢查清單

- [ ] 環境變數設定完成
- [ ] SendGrid 服務正常
- [ ] reCAPTCHA 驗證正常
- [ ] API 端點可訪問
- [ ] 前端頁面正常載入
- [ ] 完整流程測試通過

## 故障排除

### 常見問題

#### 1. reCAPTCHA 腳本載入失敗

**症狀：** 前端控制台顯示腳本載入錯誤

**解決方案：**

- 檢查網路連線
- 確認 `VITE_RECAPTCHA_SITE_KEY` 設定正確
- 檢查瀏覽器是否阻擋腳本

#### 2. reCAPTCHA 驗證失敗

**症狀：** 提交表單時顯示「reCAPTCHA 驗證失敗」

**解決方案：**

- 確認 `RECAPTCHA_SECRET_KEY` 設定正確
- 檢查 Google reCAPTCHA 管理頁面的網域設定
- 確認 Site Key 和 Secret Key 對應正確

#### 3. Email 發送失敗

**症狀：** 表單提交成功但未收到 email

**解決方案：**

- 檢查 SendGrid API Key 設定
- 確認 From Email 地址已驗證
- 檢查 SendGrid 帳戶狀態和額度
- 查看後端日誌錯誤訊息

#### 4. 速率限制問題

**症狀：** 顯示「發送 email 過於頻繁」

**解決方案：**

- 等待 15 分鐘後重試
- 檢查是否有多次快速提交
- 確認 IP 地址是否正確

### 除錯技巧

#### 1. 檢查後端日誌

```bash
npm run dev
# 查看控制台輸出的詳細日誌
```

#### 2. 檢查前端控制台

- 開啟瀏覽器開發者工具
- 查看 Console 標籤的錯誤訊息
- 檢查 Network 標籤的 API 請求

#### 3. 測試服務狀態

```bash
# 測試 email 服務狀態
curl http://localhost:4000/api/email/status

# 測試聯絡表單 API
curl -X POST http://localhost:4000/api/email/contact \
  -H "Content-Type: application/json" \
  -d '{"fullName":"測試","email":"test@example.com","topic":"general","userType":"general","message":"測試訊息內容","recaptchaToken":"test"}'
```

## 使用方式

### 用戶使用流程

1. **訪問聯絡頁面**
   - 前往 `/contact` 頁面
   - 查看聯絡表單

2. **填寫表單資料**
   - 輸入姓名和 email
   - 選擇主題和用戶類型
   - 輸入訊息內容（至少10字元）
   - 同意條款

3. **提交表單**
   - 系統自動執行 reCAPTCHA 驗證
   - 驗證表單資料
   - 發送 email 到 support@memedam.com
   - 顯示成功或錯誤訊息

### 管理員處理流程

1. **接收 email**
   - 查看 support@memedam.com 信箱
   - 查看格式化的聯絡表單 email

2. **回覆用戶**
   - 使用用戶提供的 email 地址回覆
   - 根據主題類型分配處理人員

## 未來改進

### 短期改進 (1-3個月)

- [ ] 添加自動回覆功能
- [ ] 實現 email 模板多語言支援
- [ ] 優化 reCAPTCHA 分數閾值
- [ ] 添加更多主題選項

### 中期改進 (3-6個月)

- [ ] 建立聯絡表單管理後台
- [ ] 實現表單統計分析
- [ ] 添加附件上傳功能
- [ ] 整合客服系統

### 長期改進 (6個月以上)

- [ ] AI 自動分類和回覆
- [ ] 多管道整合（社群媒體等）
- [ ] 進階 A/B 測試
- [ ] 用戶滿意度追蹤

---

## 檔案清單

### 後端檔案

- `controllers/emailController.js` - Email 控制器（含 reCAPTCHA 驗證）
- `routes/emailRoutes.js` - Email 路由和 Swagger 文檔
- `utils/emailService.js` - Email 發送服務
- `test/integration/api/contact-form.test.js` - API 整合測試

### 前端檔案

- `src/services/emailService.js` - Email 服務（含 reCAPTCHA 整合）
- `src/pages/contact.vue` - 聯絡頁面

### 文檔檔案

- `docs/contact-form-complete-guide.md` - 本完整指南

---

**實現完成時間**: 2024年12月  
**測試狀態**: ✅ 全部通過  
**部署就緒**: ✅ 是  
**reCAPTCHA 整合**: ✅ 完成
