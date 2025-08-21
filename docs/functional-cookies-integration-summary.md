# 功能 Cookie 整合實作總結

## 概述

已將功能 Cookie 的實作整合到現有的 `userController.js` 中，與通知設定功能並存，提供完整的用戶偏好管理系統。

## 整合架構

### 1. User 模型更新

在 `User.js` 中新增了 `functionalPreferences` 欄位：

```javascript
functionalPreferences: {
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'auto'
  },
  language: {
    type: String,
    enum: ['zh-TW', 'en-US', 'ja-JP'],
    default: 'zh-TW'
  },
  personalization: {
    autoPlay: { type: Boolean, default: true },
    showNSFW: { type: Boolean, default: false },
    compactMode: { type: Boolean, default: false },
    infiniteScroll: { type: Boolean, default: true },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
    },
  },
  searchPreferences: {
    searchHistory: { type: Boolean, default: true },
    searchSuggestions: { type: Boolean, default: true },
    defaultSort: { type: String, enum: ['hot', 'new', 'top', 'rising'], default: 'hot' },
    defaultFilter: { type: String, enum: ['all', 'sfw', 'nsfw'], default: 'all' },
  },
}
```

### 2. Controller 整合

在 `userController.js` 中新增了以下方法：

#### 功能 Cookie 相關方法

- `setTheme()` - 設定主題偏好
- `setLanguage()` - 設定語言偏好
- `setPersonalization()` - 設定個人化偏好
- `setSearchPreferences()` - 設定搜尋偏好
- `getFunctionalPreferences()` - 取得當前偏好設定
- `clearFunctionalPreferences()` - 清除所有偏好設定
- `getPrivacyStatus()` - 取得隱私設定狀態

#### 現有通知設定方法（保持不變）

- `updateNotificationSettings()` - 更新通知設定
- `getNotificationSettings()` - 取得通知設定

### 3. 路由整合

在 `userRoutes.js` 中新增了功能 Cookie 相關路由：

```javascript
// 功能 Cookie 相關偏好設定路由
router.post('/preferences/theme', token, isUser, setTheme)
router.post('/preferences/language', token, isUser, setLanguage)
router.post('/preferences/personalization', token, isUser, setPersonalization)
router.post('/preferences/search', token, isUser, setSearchPreferences)
router.get('/preferences', token, isUser, getFunctionalPreferences)
router.delete('/preferences', token, isUser, clearFunctionalPreferences)
router.get('/privacy-status', token, isUser, getPrivacyStatus)

// 現有通知設定路由（保持不變）
router.get('/notification-settings', token, isUser, getNotificationSettings)
router.patch('/notification-settings', token, isUser, updateNotificationSettings)
```

## API 端點對照

### 功能 Cookie 相關端點

| 功能       | 方法   | 端點                                     | 說明             |
| ---------- | ------ | ---------------------------------------- | ---------------- |
| 設定主題   | POST   | `/api/users/preferences/theme`           | 設定網站主題     |
| 設定語言   | POST   | `/api/users/preferences/language`        | 設定顯示語言     |
| 設定個人化 | POST   | `/api/users/preferences/personalization` | 設定個人化選項   |
| 設定搜尋   | POST   | `/api/users/preferences/search`          | 設定搜尋偏好     |
| 取得偏好   | GET    | `/api/users/preferences`                 | 取得所有偏好設定 |
| 清除偏好   | DELETE | `/api/users/preferences`                 | 清除所有偏好設定 |
| 隱私狀態   | GET    | `/api/users/privacy-status`              | 取得隱私設定狀態 |

### 通知設定端點（保持不變）

| 功能         | 方法  | 端點                               | 說明         |
| ------------ | ----- | ---------------------------------- | ------------ |
| 取得通知設定 | GET   | `/api/users/notification-settings` | 取得通知偏好 |
| 更新通知設定 | PATCH | `/api/users/notification-settings` | 更新通知偏好 |

## 隱私保護機制

### 1. 功能 Cookie 檢查

所有功能 Cookie 相關方法都會檢查隱私設定：

```javascript
// 檢查功能 Cookie 同意
if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
  logger.debug('跳過設定：使用者未同意功能 Cookie')
  return res.status(StatusCodes.OK).json({
    success: true,
    message: '設定已跳過（隱私設定）',
    skipped: true,
    reason: 'functional_cookies_disabled',
  })
}
```

### 2. 雙重儲存機制

- **資料庫儲存**: 在 `User.functionalPreferences` 中永久儲存
- **Cookie 儲存**: 在瀏覽器中設定功能 Cookie 以提升效能

### 3. 預設值處理

當功能 Cookie 被停用時，系統會：

- 返回預設設定值
- 不執行任何個人化功能
- 清楚說明跳過原因

## 使用範例

### 設定主題偏好

```javascript
// 前端呼叫
const response = await apiService.post('/api/users/preferences/theme', {
  theme: 'dark'
})

// 成功回應
{
  "success": true,
  "message": "主題偏好已儲存",
  "data": { "theme": "dark" }
}

// 功能 Cookie 停用時的回應
{
  "success": true,
  "message": "主題設定已跳過（隱私設定）",
  "skipped": true,
  "reason": "functional_cookies_disabled"
}
```

### 取得所有偏好設定

```javascript
// 前端呼叫
const response = await apiService.get('/api/users/preferences')

// 成功回應
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

## 與現有功能的關係

### 1. 通知設定

- **功能 Cookie 通知偏好**: 控制是否啟用個人化的通知設定
- **現有通知設定**: 控制具體的通知類型開關
- **整合邏輯**: 功能 Cookie 停用時，個人化通知設定也會被忽略

### 2. 用戶偏好

- **功能 Cookie 偏好**: 新增的個人化設定
- **現有偏好**: 保留原有的 `preferences` 欄位
- **分離管理**: 兩套偏好系統獨立管理，互不影響

### 3. 隱私保護

- **全域隱私檢查**: 所有請求都會經過 `attachPrivacyConsent` middleware
- **功能特定檢查**: 功能 Cookie 相關端點會額外檢查 `canUseFunctionalCookies`
- **透明處理**: 清楚說明哪些功能被跳過及原因

## 最佳實踐

### 1. 前端整合

```javascript
// 檢查功能 Cookie 狀態
const checkFunctionalCookies = async () => {
  try {
    const response = await apiService.get('/api/users/privacy-status')
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

### 2. 錯誤處理

```javascript
// 處理功能 Cookie 跳過的情況
const handlePreferenceSetting = async (endpoint, data) => {
  try {
    const response = await apiService.post(endpoint, data)

    if (response.data.skipped) {
      console.log('設定已跳過（功能 Cookie 已停用）')
      // 使用預設設定
      applyDefaultSettings()
    } else {
      console.log('設定成功')
      // 應用新設定
      applySettings(response.data.data)
    }
  } catch (error) {
    console.error('設定失敗:', error)
  }
}
```

## 總結

這次整合成功將功能 Cookie 實作融入到現有的用戶管理系統中，提供了：

1. **完整的偏好管理**: 主題、語言、個人化、搜尋偏好
2. **隱私保護**: 嚴格的功能 Cookie 檢查機制
3. **向後相容**: 保持現有通知設定功能不變
4. **統一管理**: 所有用戶偏好都在 `userController.js` 中管理
5. **雙重儲存**: 資料庫 + Cookie 的效能優化方案

這樣的整合既滿足了 GDPR/CCPA 合規要求，又提供了豐富的個人化功能，同時保持了程式碼的整潔和可維護性。
