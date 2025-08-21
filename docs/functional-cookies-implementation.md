# 功能 Cookie 實作指南

## 概述

功能 Cookie 用於儲存使用者的偏好設定，以增強使用者體驗。這些設定只有在使用者明確同意功能 Cookie 時才會被儲存和應用。

## 功能 Cookie 控制的功能

### 1. 主題偏好 (Theme)

- **Cookie 名稱**: `theme`
- **選項**: `light`, `dark`, `auto`
- **用途**: 控制網站的外觀主題
- **預設值**: `auto`

### 2. 語言偏好 (Language)

- **Cookie 名稱**: `language`
- **選項**: `zh-TW`, `en-US`, `ja-JP`
- **用途**: 控制網站顯示語言
- **預設值**: `zh-TW`

### 3. 個人化設定 (Personalization)

- **Cookie 名稱**: `personalization`
- **包含設定**:
  - `autoPlay`: 自動播放影片
  - `showNSFW`: 顯示 NSFW 內容
  - `compactMode`: 緊湊模式
  - `infiniteScroll`: 無限滾動
  - `notificationPreferences`: 通知偏好

### 4. 搜尋偏好 (Search Preferences)

- **Cookie 名稱**: `searchPreferences`
- **包含設定**:
  - `searchHistory`: 搜尋歷史
  - `searchSuggestions`: 搜尋建議
  - `defaultSort`: 預設排序方式
  - `defaultFilter`: 預設篩選條件

## API 端點

### 設定主題偏好

```http
POST /api/preferences/theme
Content-Type: application/json

{
  "theme": "dark"
}
```

**回應範例**:

```json
{
  "success": true,
  "message": "主題偏好已儲存",
  "data": { "theme": "dark" }
}
```

**當功能 Cookie 被停用時**:

```json
{
  "success": true,
  "message": "主題設定已跳過（隱私設定）",
  "skipped": true,
  "reason": "functional_cookies_disabled"
}
```

### 設定語言偏好

```http
POST /api/preferences/language
Content-Type: application/json

{
  "language": "en-US"
}
```

### 設定個人化偏好

```http
POST /api/preferences/personalization
Content-Type: application/json

{
  "autoPlay": true,
  "showNSFW": false,
  "compactMode": false,
  "infiniteScroll": true,
  "notificationPreferences": {
    "email": true,
    "push": true,
    "mentions": true,
    "likes": true,
    "comments": true
  }
}
```

### 設定搜尋偏好

```http
POST /api/preferences/search
Content-Type: application/json

{
  "searchHistory": true,
  "searchSuggestions": true,
  "defaultSort": "hot",
  "defaultFilter": "all"
}
```

### 取得當前偏好設定

```http
GET /api/preferences
```

**回應範例**:

```json
{
  "success": true,
  "data": {
    "theme": "dark",
    "language": "zh-TW",
    "personalization": {
      "autoPlay": true,
      "showNSFW": false,
      "compactMode": false,
      "infiniteScroll": true,
      "notificationPreferences": {
        "email": true,
        "push": true,
        "mentions": true,
        "likes": true,
        "comments": true
      }
    },
    "searchPreferences": {
      "searchHistory": true,
      "searchSuggestions": true,
      "defaultSort": "hot",
      "defaultFilter": "all"
    }
  },
  "functionalCookiesEnabled": true
}
```

### 清除所有偏好設定

```http
DELETE /api/preferences
```

### 取得隱私設定狀態

```http
GET /api/preferences/privacy-status
```

## 實作細節

### 1. Middleware 檢查

所有偏好設定端點都使用 `checkFunctionalConsent` middleware 來檢查功能 Cookie 同意狀態：

```javascript
router.post(
  '/theme',
  optionalToken,
  checkFunctionalConsent,
  apiLimiter,
  preferencesController.setTheme,
)
```

### 2. Controller 邏輯

每個控制器方法都會檢查隱私設定：

```javascript
async setTheme(req, res, next) {
  try {
    // 檢查功能 Cookie 同意
    if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
      logger.debug('跳過主題設定：使用者未同意功能 Cookie')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: '主題設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled'
      })
    }

    // 正常設定邏輯...
  } catch (error) {
    next(error)
  }
}
```

### 3. Cookie 設定

功能 Cookie 使用安全的設定：

```javascript
res.cookie('theme', theme, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
  path: '/',
})
```

## 前端整合

### 檢查功能 Cookie 狀態

```javascript
// 在 Vue 組件中
const checkFunctionalCookies = async () => {
  try {
    const response = await apiService.get('/api/preferences/privacy-status')
    const { canUseFunctionalCookies } = response.data.data

    if (canUseFunctionalCookies) {
      // 啟用偏好設定功能
      enablePreferenceSettings()
    } else {
      // 使用預設設定
      useDefaultSettings()
    }
  } catch (error) {
    console.error('檢查功能 Cookie 狀態失敗:', error)
  }
}
```

### 設定主題

```javascript
const setTheme = async (theme) => {
  try {
    const response = await apiService.post('/api/preferences/theme', { theme })

    if (response.data.skipped) {
      console.log('主題設定已跳過（功能 Cookie 已停用）')
      // 使用預設主題
      applyDefaultTheme()
    } else {
      console.log('主題設定成功')
      // 應用新主題
      applyTheme(theme)
    }
  } catch (error) {
    console.error('設定主題失敗:', error)
  }
}
```

### 動態調整功能

```javascript
// 根據功能 Cookie 狀態調整 UI
const updateUI = (functionalCookiesEnabled) => {
  if (functionalCookiesEnabled) {
    // 顯示偏好設定選項
    showPreferenceSettings()
    // 載入已儲存的偏好
    loadSavedPreferences()
  } else {
    // 隱藏偏好設定選項
    hidePreferenceSettings()
    // 使用預設設定
    useDefaultSettings()
  }
}
```

## 測試範例

### 測試功能 Cookie 跳過

```javascript
// 測試未同意功能 Cookie 的情況
const testFunctionalCookieSkip = async () => {
  // 1. 建立不同意功能 Cookie 的隱私設定
  await privacyConsentService.createConsent({
    necessary: true,
    functional: false, // 不同意功能 Cookie
    analytics: true,
    consentSource: 'test',
  })

  // 2. 呼叫偏好設定端點
  const response = await apiService.post('/api/preferences/theme', {
    theme: 'dark',
  })

  // 3. 驗證回應
  expect(response.data.skipped).toBe(true)
  expect(response.data.reason).toBe('functional_cookies_disabled')
  expect(response.data.message).toContain('主題設定已跳過')
}
```

### 測試功能 Cookie 啟用

```javascript
// 測試同意功能 Cookie 的情況
const testFunctionalCookieEnabled = async () => {
  // 1. 建立同意功能 Cookie 的隱私設定
  await privacyConsentService.createConsent({
    necessary: true,
    functional: true, // 同意功能 Cookie
    analytics: false,
    consentSource: 'test',
  })

  // 2. 呼叫偏好設定端點
  const response = await apiService.post('/api/preferences/theme', {
    theme: 'dark',
  })

  // 3. 驗證回應
  expect(response.data.success).toBe(true)
  expect(response.data.data.theme).toBe('dark')
  expect(response.data.skipped).toBeUndefined()
}
```

## 最佳實踐

### 1. 預設安全

- 所有偏好設定預設為最安全的選項
- 只有明確同意才啟用個人化功能

### 2. 透明處理

- 清楚說明哪些功能被跳過
- 提供詳細的跳過原因

### 3. 使用者體驗

- 即使功能 Cookie 被停用，網站仍能正常運作
- 提供預設設定作為備選方案

### 4. 資料保護

- 使用 httpOnly Cookie 防止 XSS 攻擊
- 設定適當的過期時間
- 使用 secure 標記在生產環境

### 5. 錯誤處理

- 優雅處理 Cookie 設定失敗的情況
- 提供適當的錯誤訊息

## 監控和日誌

### 功能 Cookie 使用統計

```javascript
// 記錄功能 Cookie 使用情況
logger.info('功能 Cookie 使用統計:', {
  totalRequests: privacyStats.totalRequests,
  functionalCookiesEnabled: privacyStats.functionalCookiesEnabled,
  preferencesSet: privacyStats.preferencesSet,
  preferencesSkipped: privacyStats.preferencesSkipped,
})
```

### 偏好設定變更日誌

```javascript
// 記錄偏好設定變更
logger.info('偏好設定變更:', {
  userId: req.user?._id || 'anonymous',
  preferenceType: 'theme',
  oldValue: oldTheme,
  newValue: newTheme,
  functionalCookiesEnabled: req.canUseFunctionalCookies,
})
```

這個實作確保了功能 Cookie 完全遵守使用者的隱私偏好，同時提供了豐富的個人化功能來增強使用者體驗。
