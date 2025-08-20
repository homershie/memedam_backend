# reCAPTCHA 整合指南

## 概述

本專案已將 reCAPTCHA 驗證邏輯重構為統一的服務，提供更好的程式碼重用性和維護性。本文檔包含完整的整合指南、重構總結和使用範例。

## 重構概述

### 重構前後對比

**重構前問題：**

- 重複的驗證邏輯分散在 `feedbackController.js` 和 `emailController.js` 中
- 錯誤處理不一致
- 日誌記錄不統一
- 難以擴展和維護
- 缺乏測試覆蓋

**重構後解決方案：**

- 統一的 `RecaptchaService` 服務
- 多種驗證模式支援
- 完整的錯誤處理和日誌記錄
- 環境適應性
- 完整的測試覆蓋

## 服務架構

### 檔案位置

- **服務檔案**: `services/recaptchaService.js`
- **測試檔案**: `test/unit/services/recaptchaService.test.js`

### 功能特色

#### 1. 統一驗證邏輯

- 支援 reCAPTCHA v2 和 v3 版本
- 統一的錯誤處理和日誌記錄
- 可配置的驗證選項

#### 2. 環境適應性

- 開發環境自動允許通過（當密鑰未設定時）
- 生產環境嚴格驗證
- 可配置的寬鬆模式

#### 3. 多種驗證模式

- `quickVerify()`: 快速驗證（預設設定）
- `strictVerify()`: 嚴格驗證（不允許開發環境通過）
- `lenientVerify()`: 寬鬆驗證（允許開發環境通過）

## 使用方法

### 基本使用

```javascript
import RecaptchaService from '../services/recaptchaService.js'

// 快速驗證
const isValid = await RecaptchaService.quickVerify(recaptchaToken)
if (!isValid) {
  return res.status(400).json({
    success: false,
    message: 'reCAPTCHA 驗證失敗',
  })
}
```

### 進階使用

```javascript
// 自定義驗證選項
const isValid = await RecaptchaService.verify(recaptchaToken, {
  minScore: 0.7, // v3 最低分數
  allowDevMode: false, // 不允許開發環境通過
  requireToken: true, // 要求必須提供 token
})

// 嚴格驗證（適合登入流程）
const isValid = await RecaptchaService.strictVerify(recaptchaToken, 0.8)

// 寬鬆驗證（適合測試環境）
const isValid = await RecaptchaService.lenientVerify(recaptchaToken)
```

### 檢查設定狀態

```javascript
const status = RecaptchaService.getStatus()
console.log('reCAPTCHA 設定狀態:', status)
// 輸出: {
//   hasSecretKey: true,
//   hasSiteKey: true,
//   environment: 'production',
//   timestamp: '2024-01-01T00:00:00.000Z'
// }
```

## 整合範例

### 1. 在控制器中使用

```javascript
import RecaptchaService from '../services/recaptchaService.js'

export const submitForm = async (req, res) => {
  try {
    const { recaptchaToken, ...formData } = req.body

    // 驗證 reCAPTCHA
    const isRecaptchaValid = await RecaptchaService.quickVerify(recaptchaToken)
    if (!isRecaptchaValid) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA 驗證失敗，請重新驗證',
      })
    }

    // 處理表單提交邏輯...
  } catch (error) {
    // 錯誤處理...
  }
}
```

### 2. 登入流程整合

```javascript
import RecaptchaService from '../services/recaptchaService.js'

export const login = async (req, res) => {
  const { login, password, recaptchaToken } = req.body

  // 驗證 reCAPTCHA（使用嚴格模式）
  const isRecaptchaValid = await RecaptchaService.strictVerify(recaptchaToken, 0.7)
  if (!isRecaptchaValid) {
    return res.status(400).json({
      success: false,
      message: '驗證失敗，請重新嘗試',
    })
  }

  // 繼續登入邏輯...
}
```

### 3. 註冊流程整合

```javascript
export const createUser = async (req, res) => {
  const { recaptchaToken, ...userData } = req.body

  // 驗證 reCAPTCHA（使用嚴格模式）
  const isRecaptchaValid = await RecaptchaService.strictVerify(recaptchaToken, 0.7)
  if (!isRecaptchaValid) {
    return res.status(400).json({
      success: false,
      message: '驗證失敗，請重新嘗試',
    })
  }

  // 繼續註冊邏輯...
}
```

## 前端整合範例

### Vue.js 登入組件

```vue
<template>
  <div class="login-form">
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label for="login">帳號或信箱</label>
        <input id="login" v-model="form.login" type="text" required :disabled="loading" />
      </div>

      <div class="form-group">
        <label for="password">密碼</label>
        <input id="password" v-model="form.password" type="password" required :disabled="loading" />
      </div>

      <!-- reCAPTCHA 組件 -->
      <div class="recaptcha-container">
        <vue-recaptcha
          ref="recaptcha"
          :sitekey="recaptchaSiteKey"
          @verify="onRecaptchaVerify"
          @expired="onRecaptchaExpired"
        />
      </div>

      <button type="submit" :disabled="loading || !recaptchaToken">
        {{ loading ? '登入中...' : '登入' }}
      </button>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </form>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import VueRecaptcha from 'vue-recaptcha'
import { useAuthStore } from '@/stores/authStore'

export default {
  name: 'LoginForm',
  components: {
    VueRecaptcha,
  },
  setup() {
    const authStore = useAuthStore()
    const recaptcha = ref(null)

    const form = reactive({
      login: '',
      password: '',
    })

    const loading = ref(false)
    const error = ref('')
    const recaptchaToken = ref('')

    const recaptchaSiteKey = process.env.VUE_APP_RECAPTCHA_SITE_KEY

    const onRecaptchaVerify = (token) => {
      recaptchaToken.value = token
    }

    const onRecaptchaExpired = () => {
      recaptchaToken.value = ''
    }

    const handleLogin = async () => {
      if (!recaptchaToken.value) {
        error.value = '請完成 reCAPTCHA 驗證'
        return
      }

      loading.value = true
      error.value = ''

      try {
        await authStore.login({
          ...form,
          recaptchaToken: recaptchaToken.value,
        })

        // 登入成功後的處理
        this.$router.push('/dashboard')
      } catch (err) {
        error.value = err.message || '登入失敗，請重試'
        // 重置 reCAPTCHA
        recaptcha.value.reset()
        recaptchaToken.value = ''
      } finally {
        loading.value = false
      }
    }

    return {
      form,
      loading,
      error,
      recaptcha,
      recaptchaToken,
      recaptchaSiteKey,
      onRecaptchaVerify,
      onRecaptchaExpired,
      handleLogin,
    }
  },
}
</script>
```

## 環境變數設定

### 必需變數

```bash
# reCAPTCHA 密鑰
RECAPTCHA_SECRET_KEY=your_secret_key_here
RECAPTCHA_SITE_KEY=your_site_key_here
```

### 可選變數

```bash
# 環境設定
NODE_ENV=production  # development, test, production
```

### 前端設定

```javascript
// .env
VUE_APP_RECAPTCHA_SITE_KEY = your_site_key_here

// main.js
import VueRecaptcha from 'vue-recaptcha'
Vue.use(VueRecaptcha)
```

## 安全性考量

### 1. 驗證模式選擇

- **登入/註冊**: 使用 `strictVerify()` 進行嚴格驗證
- **一般表單**: 使用 `quickVerify()` 進行標準驗證
- **測試環境**: 使用 `lenientVerify()` 進行寬鬆驗證

### 2. 分數閾值設定

```javascript
// 高安全性場景（登入、註冊、管理員操作）
const isValid = await RecaptchaService.strictVerify(recaptchaToken, 0.8)

// 中等安全性場景（一般表單提交）
const isValid = await RecaptchaService.strictVerify(recaptchaToken, 0.6)

// 低安全性場景（評論、留言）
const isValid = await RecaptchaService.quickVerify(recaptchaToken)
```

### 3. 錯誤處理

```javascript
try {
  const isValid = await RecaptchaService.strictVerify(recaptchaToken, 0.7)
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: '驗證失敗，請重新嘗試',
    })
  }
} catch (error) {
  logger.error('reCAPTCHA 驗證錯誤:', error)
  return res.status(500).json({
    success: false,
    message: '驗證服務暫時不可用，請稍後再試',
  })
}
```

## 測試

### 執行測試

```bash
npm test test/unit/services/recaptchaService.test.js
```

### 測試覆蓋範圍

- 基本驗證功能
- 環境適應性
- 錯誤處理
- 不同驗證模式
- 設定狀態檢查

### 測試結果

```
✓ RecaptchaService (15)
  ✓ verify (9)
  ✓ quickVerify (1)
  ✓ strictVerify (2)
  ✓ lenientVerify (1)
  ✓ getStatus (2)
```

## 遷移指南

### 從舊版本遷移

1. **移除重複的驗證函數**

   ```javascript
   // 舊版本
   const verifyRecaptcha = async (token) => {
     /* ... */
   }

   // 新版本
   import RecaptchaService from '../utils/recaptchaService.js'
   ```

2. **更新驗證調用**

   ```javascript
   // 舊版本
   const isValid = await verifyRecaptcha(recaptchaToken)

   // 新版本
   const isValid = await RecaptchaService.quickVerify(recaptchaToken)
   ```

3. **移除 axios 依賴**（如果只在 reCAPTCHA 中使用）
   ```javascript
   // 移除這行
   import axios from 'axios'
   ```

## 重構成果

### 1. 程式碼重用性提升

- **重構前**: 2 個控制器中有重複的驗證邏輯
- **重構後**: 1 個統一的服務供所有控制器使用

### 2. 功能增強

- 多種驗證模式（快速、嚴格、寬鬆）
- 環境適應性（開發環境自動通過）
- 可配置的分數閾值
- 詳細的日誌記錄
- 設定狀態檢查

### 3. 維護性提升

- 單一檔案管理所有驗證邏輯
- 統一的錯誤處理
- 詳細的日誌記錄便於除錯

### 4. 測試覆蓋

- 15 個單元測試案例
- 涵蓋所有驗證模式
- 環境適應性測試
- 錯誤處理測試

## 檔案變更清單

### 新增檔案

- `services/recaptchaService.js` - 統一的 reCAPTCHA 服務
- `test/unit/services/recaptchaService.test.js` - 單元測試

### 修改檔案

- `controllers/feedbackController.js` - 移除重複邏輯，使用新服務
- `controllers/emailController.js` - 移除重複邏輯，使用新服務

### 移除內容

- 重複的 `verifyRecaptcha` 函數
- 重複的 axios 導入（如果只在 reCAPTCHA 中使用）

## 未來擴展建議

### 1. 其他使用場景

- 評論系統
- 檔案上傳
- 管理員操作
- 密碼重設
- 敏感操作確認

### 2. 進階功能

- reCAPTCHA Enterprise 支援
- 快取機制（減少 API 調用）
- 自定義評分規則
- 批量驗證支援
- 統計和分析功能

## 故障排除

### 常見問題

1. **驗證總是失敗**
   - 檢查 `RECAPTCHA_SECRET_KEY` 是否正確設定
   - 確認前端發送的 token 格式正確
   - 檢查網路連線

2. **開發環境驗證失敗**
   - 確認 `NODE_ENV` 設定為 `development`
   - 檢查 `allowDevMode` 選項

3. **v3 分數過低**
   - 調整 `minScore` 參數
   - 檢查前端 reCAPTCHA 設定
   - 考慮使用 `strictVerify()` 進行更嚴格驗證

### 除錯技巧

```javascript
// 啟用詳細日誌
const status = RecaptchaService.getStatus()
console.log('reCAPTCHA 狀態:', status)

// 測試不同驗證模式
const quickResult = await RecaptchaService.quickVerify(token)
const strictResult = await RecaptchaService.strictVerify(token)
console.log('驗證結果:', { quickResult, strictResult })
```

## 總結

本次重構成功解決了 reCAPTCHA 驗證邏輯重複的問題，建立了統一、可擴展的服務架構。重構後的程式碼更加：

- **模組化**：單一職責，易於維護
- **可重用**：一次編寫，多處使用
- **可測試**：完整的測試覆蓋
- **可擴展**：支援多種驗證模式
- **環境適應**：自動適應不同環境

這為未來在登入、註冊等高安全性場景中整合 reCAPTCHA 驗證奠定了良好的基礎。
