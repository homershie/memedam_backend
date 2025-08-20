# reCAPTCHA 完整整合指南

## 概述

本指南涵蓋 reCAPTCHA 在迷因典專案中的完整整合，包括設定、實作、測試和維護。reCAPTCHA 主要用於保護本地 JWT 登入和表單提交，防止暴力破解攻擊。

## 目錄

1. [取得 reCAPTCHA 金鑰](#1-取得-recaptcha-金鑰)
2. [環境變數設定](#2-環境變數設定)
3. [功能特色](#3-功能特色)
4. [技術實作](#4-技術實作)
5. [API 端點](#5-api-端點)
6. [前端整合](#6-前端整合)
7. [測試指南](#7-測試指南)
8. [部署建議](#8-部署建議)
9. [故障排除](#9-故障排除)
10. [安全性考量](#10-安全性考量)

## 1. 取得 reCAPTCHA 金鑰

### 步驟 1：前往 Google reCAPTCHA 管理頁面

1. 前往 [Google reCAPTCHA 管理頁面](https://www.google.com/recaptcha/admin)
2. 使用您的 Google 帳戶登入

### 步驟 2：建立新的 reCAPTCHA 網站

1. 點擊「+」按鈕建立新的網站
2. 選擇 **reCAPTCHA v3** (推薦，無需使用者互動)
3. 填寫以下資訊：
   - **標籤**：迷因典 MemeDam
   - **網域**：輸入您的網域 (例如：memedam.com, www.memedam.com)
   - **接受條款**：勾選同意

### 步驟 3：取得金鑰

建立完成後，您會得到兩個金鑰：

- **網站金鑰 (Site Key)**：用於前端
- **網站密鑰 (Secret Key)**：用於後端驗證

## 2. 環境變數設定

### 後端環境變數 (.env)

```bash
# reCAPTCHA 設定
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

### 前端環境變數 (.env)

```bash
# reCAPTCHA 設定
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

## 3. 功能特色

### 前端特色

- ✅ 自動載入 reCAPTCHA 腳本
- ✅ 無需使用者互動 (v3)
- ✅ 表單驗證整合
- ✅ 錯誤處理和重試機制
- ✅ 載入狀態指示
- ✅ 登入頁面整合

### 後端特色

- ✅ 伺服器端驗證
- ✅ 頻率限制 (15分鐘內最多5次提交)
- ✅ 完整的意見管理系統
- ✅ 管理員回覆功能
- ✅ 狀態追蹤
- ✅ 本地登入防護
- ✅ 統一驗證服務

## 4. 技術實作

### 後端服務架構

#### 統一驗證服務 (`services/recaptchaService.js`)

```javascript
import RecaptchaService from '../services/recaptchaService.js'

// 快速驗證（預設）
const isValid = await RecaptchaService.quickVerify(recaptchaToken)

// 嚴格驗證（登入/註冊）
const isValid = await RecaptchaService.strictVerify(recaptchaToken, 0.7)

// 寬鬆驗證（測試環境）
const isValid = await RecaptchaService.lenientVerify(recaptchaToken)
```

#### 登入控制器整合

```javascript
// authController.js
export const login = async (req, res) => {
  const { login, password, recaptchaToken } = req.body

  // 驗證 reCAPTCHA（如果已設定）
  if (process.env.RECAPTCHA_SECRET_KEY) {
    if (!recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: '請完成 reCAPTCHA 驗證',
      })
    }

    const isRecaptchaValid = await RecaptchaService.quickVerify(recaptchaToken)
    if (!isRecaptchaValid) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA 驗證失敗，請重新驗證',
      })
    }
  }

  // 繼續原有的登入邏輯...
}
```

### 前端整合

#### 登入頁面整合

```javascript
// login.vue
const onSubmit = async () => {
  if (activeTab.value === 'login') {
    let loginData = {
      login: formData.email,
      password: formData.password,
    }

    // 如果設定了 reCAPTCHA，加入驗證
    try {
      recaptchaLoading.value = true
      const recaptchaToken = await emailService.executeRecaptcha('login')
      loginData.recaptchaToken = recaptchaToken
    } catch (error) {
      console.warn('reCAPTCHA 載入失敗，繼續登入流程:', error)
    } finally {
      recaptchaLoading.value = false
    }

    const { data } = await userService.login(loginData)
    // 處理登入成功...
  }
}
```

#### reCAPTCHA 服務 (`services/emailService.js`)

```javascript
// 載入 reCAPTCHA 腳本
loadRecaptchaScript() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve(window.grecaptcha)
      return
    }

    const siteKey = this.checkRecaptchaConfig()
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
    script.async = true
    script.defer = true

    script.onload = () => {
      const checkGrecaptcha = () => {
        if (window.grecaptcha && window.grecaptcha.ready) {
          resolve(window.grecaptcha)
        } else {
          setTimeout(checkGrecaptcha, 100)
        }
      }
      checkGrecaptcha()
    }

    document.head.appendChild(script)
  })
}

// 執行 reCAPTCHA 驗證
async executeRecaptcha(action = 'submit_contact') {
  const grecaptcha = await this.loadRecaptchaScript()

  return new Promise((resolve, reject) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(this.checkRecaptchaConfig(), { action })
        .then(resolve)
        .catch(reject)
    })
  })
}
```

## 5. API 端點

### 公開端點

- `POST /api/feedback/submit` - 提交意見（支援 reCAPTCHA）
- `POST /api/users/login` - 本地帳號登入（支援 reCAPTCHA）

### 管理員端點

- `GET /api/feedback/admin` - 取得意見列表
- `PUT /api/feedback/admin/:id` - 更新意見狀態

### API 文件更新

```javascript
// Swagger 文件中的 LoginRequest
*     LoginRequest:
*       type: object
*       required:
*         - login
*         - password
*       properties:
*         login:
*           type: string
*           description: 帳號或電子郵件
*           example: "user@example.com"
*         password:
*           type: string
*           description: 密碼
*           example: "password123"
*         recaptchaToken:
*           type: string
*           description: reCAPTCHA 驗證 token（如果已設定 reCAPTCHA）
*           example: "03AFcWeA..."
```

## 6. 前端整合

### 使用場景

1. **登入頁面** - 防止暴力破解攻擊
2. **聯絡表單** - 防止垃圾訊息
3. **意見回饋** - 防止惡意提交

### 整合步驟

1. **環境變數設定**

   ```bash
   VITE_RECAPTCHA_SITE_KEY=your_site_key_here
   ```

2. **載入 reCAPTCHA 腳本**

   ```javascript
   import emailService from '@/services/emailService.js'
   ```

3. **執行驗證**

   ```javascript
   const recaptchaToken = await emailService.executeRecaptcha('login')
   ```

4. **發送請求**
   ```javascript
   const response = await userService.login({
     login: formData.email,
     password: formData.password,
     recaptchaToken,
   })
   ```

## 7. 測試指南

### 測試檔案

- `test/integration/api/login-recaptcha.test.js` - 登入整合測試
- `test/unit/services/recaptchaService.test.js` - 服務單元測試

### 測試情境

#### 1. 有 reCAPTCHA 設定

- 無 token 登入 → 400 錯誤
- 無效 token 登入 → 400 錯誤
- 有效 token 登入 → 200 成功

#### 2. 無 reCAPTCHA 設定

- 正常登入 → 200 成功
- 支援帳號或信箱登入

#### 3. 錯誤處理

- 密碼錯誤 → 401 錯誤
- 帳號不存在 → 401 錯誤

### 執行測試

```bash
# 執行所有 reCAPTCHA 相關測試
npm test test/integration/api/login-recaptcha.test.js
npm test test/unit/services/recaptchaService.test.js

# 執行特定測試
npm test -- --grep "reCAPTCHA"
```

## 8. 部署建議

### 開發環境

1. 使用測試金鑰進行開發
2. 確認 reCAPTCHA 載入正常
3. 測試各種錯誤情境
4. 驗證登入功能

### 生產環境

1. 使用正式金鑰
2. 確認網域設定正確
3. 測試完整流程
4. 監控錯誤日誌
5. 確認登入安全性

### 監控指標

1. **reCAPTCHA 載入成功率**
2. **驗證失敗率**
3. **登入嘗試頻率**
4. **錯誤日誌分析**

## 9. 故障排除

### 常見問題

#### 1. reCAPTCHA 載入失敗

- 檢查網域設定
- 確認金鑰正確性
- 檢查網路連線

#### 2. 驗證失敗

- 檢查後端密鑰設定
- 確認網路連線
- 檢查 token 格式

#### 3. 表單提交錯誤

- 檢查所有必填欄位
- 確認 reCAPTCHA token 存在
- 檢查 API 回應

#### 4. 登入驗證失敗

- 檢查登入頁面 reCAPTCHA 載入
- 確認後端驗證邏輯
- 檢查網路連線狀態

### 除錯技巧

```javascript
// 檢查 reCAPTCHA 設定狀態
const status = RecaptchaService.getStatus()
console.log('reCAPTCHA 狀態:', status)

// 測試不同驗證模式
const quickResult = await RecaptchaService.quickVerify(token)
const strictResult = await RecaptchaService.strictVerify(token)
console.log('驗證結果:', { quickResult, strictResult })
```

## 10. 安全性考量

### 為什麼只加到本地登入？

1. **攻擊風險差異**
   - **本地登入**：容易受到暴力破解攻擊
   - **OAuth 登入**：由第三方服務保護，風險較低

2. **使用者體驗**
   - **本地登入**：reCAPTCHA 提供必要防護
   - **OAuth 登入**：額外驗證會降低體驗

3. **實作複雜度**
   - **本地登入**：直接整合到現有流程
   - **OAuth 登入**：需要修改第三方流程

### 安全最佳實踐

- ✅ 使用 HTTPS
- ✅ 伺服器端驗證
- ✅ 頻率限制
- ✅ 輸入驗證
- ✅ XSS 防護
- ✅ 可選性設計（未設定時跳過驗證）

### 效能優化

- ✅ 非同步載入 reCAPTCHA 腳本
- ✅ 快取機制
- ✅ 錯誤重試
- ✅ 載入狀態管理

## 總結

reCAPTCHA 整合提供了：

- ✅ **增強安全性**：防止暴力破解攻擊
- ✅ **靈活配置**：可選的驗證機制
- ✅ **完整測試**：全面的測試覆蓋
- ✅ **良好體驗**：無縫的使用者體驗
- ✅ **易於維護**：清晰的程式碼結構
- ✅ **統一服務**：可重用的驗證邏輯

這個實作在保持安全性的同時，也考慮了開發和維護的便利性，是一個平衡且實用的解決方案。
