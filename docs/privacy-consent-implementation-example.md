# 隱私同意設定實作指南

## 概述

本文件說明如何根據使用者的隱私同意設定來控制應用程式的行為，特別是 analytics 追蹤和功能 Cookie 的使用。

## 隱私設定類型

### 1. 必要 Cookie (Necessary)

- **預設值**: `true`
- **用途**: 網站基本功能運作必需
- **範例**: 登入狀態、購物車、安全性驗證

### 2. 功能 Cookie (Functional)

- **預設值**: `false`
- **用途**: 增強使用者體驗
- **範例**: 語言偏好、主題設定、個人化內容

### 3. 分析 Cookie (Analytics)

- **預設值**: `false`
- **用途**: 網站使用分析
- **範例**: 頁面瀏覽統計、使用者行為追蹤、A/B 測試

## Middleware 使用方式

### 1. 全域隱私檢查

```javascript
// 在 index.js 中已設定全域 middleware
app.use(attachPrivacyConsent)

// 在 controller 中可以直接使用
export const someController = async (req, res) => {
  // 檢查隱私設定
  if (!req.canTrackAnalytics) {
    // 跳過 analytics 追蹤
    return res.json({ message: 'Analytics 已停用' })
  }

  // 正常處理邏輯
}
```

### 2. 特定路由隱私檢查

```javascript
// 在 routes 中使用
import { checkAnalyticsConsent, checkFunctionalConsent } from '../middleware/privacyConsent.js'

// Analytics 追蹤路由
router.post('/track', token, checkAnalyticsConsent, analyticsController)

// 功能 Cookie 路由
router.post('/preferences', token, checkFunctionalConsent, preferencesController)
```

### 3. 條件式功能執行

```javascript
import { conditionalAnalytics, conditionalFunctionalCookies } from '../middleware/privacyConsent.js'

// 條件式 analytics 追蹤
const trackingFunction = async (req, res, next) => {
  // 執行追蹤邏輯
  await trackUserBehavior(req.user.id, req.body)
  next()
}

router.post('/track', token, conditionalAnalytics(trackingFunction))

// 條件式功能 Cookie 設定
const cookieFunction = async (req, res, next) => {
  res.cookie('user_preference', req.body.preference, {
    httpOnly: true,
    secure: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
  })
  next()
}

router.post('/set-preference', token, conditionalFunctionalCookies(cookieFunction))
```

## Controller 中的使用範例

### Analytics Controller

```javascript
export const trackRecommendation = async (req, res) => {
  try {
    // 檢查隱私同意設定
    if (req.skipAnalytics || !req.canTrackAnalytics) {
      logger.debug('跳過 analytics 追蹤：使用者未同意 analytics')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: 'Analytics 追蹤已跳過（隱私設定）',
        skipped: true,
      })
    }

    // 正常追蹤邏輯
    const metrics = new RecommendationMetrics({
      user_id: req.user._id,
      // ... 其他資料
    })

    await metrics.save()

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { metrics_id: metrics._id },
    })
  } catch (error) {
    next(error)
  }
}
```

### 功能 Cookie Controller

```javascript
export const setUserPreference = async (req, res) => {
  try {
    // 檢查功能 Cookie 同意
    if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: '功能 Cookie 已停用（隱私設定）',
        skipped: true,
      })
    }

    // 設定功能 Cookie
    res.cookie('theme', req.body.theme, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
    })

    res.json({
      success: true,
      message: '偏好設定已儲存',
    })
  } catch (error) {
    next(error)
  }
}
```

## 前端整合

### 檢查隱私設定

```javascript
// 在 Vue 組件中
const checkPrivacySettings = async () => {
  try {
    const response = await privacyConsentService.getCurrentConsent()
    const consent = response.data

    if (consent) {
      // 根據設定調整功能
      if (consent.analytics) {
        // 啟用 Google Analytics
        enableGoogleAnalytics()
      }

      if (consent.functional) {
        // 啟用功能 Cookie
        loadUserPreferences()
      }
    }
  } catch (error) {
    console.error('檢查隱私設定失敗:', error)
  }
}
```

### 動態調整功能

```javascript
// 在 API 服務中
const apiService = {
  async trackEvent(eventData) {
    try {
      const response = await this.httpAuth.post('/api/analytics/track', eventData)

      if (response.data.skipped) {
        console.log('Analytics 追蹤已跳過（隱私設定）')
      }

      return response
    } catch (error) {
      console.error('追蹤事件失敗:', error)
    }
  },
}
```

## 測試隱私功能

### 1. 測試 Analytics 跳過

```javascript
// 測試未同意 analytics 的情況
const testAnalyticsSkip = async () => {
  // 1. 建立不同意 analytics 的隱私設定
  await privacyConsentService.createConsent({
    necessary: true,
    functional: true,
    analytics: false, // 不同意 analytics
    consentSource: 'test',
  })

  // 2. 呼叫 analytics 端點
  const response = await apiService.post('/api/analytics/track-recommendation', {
    meme_id: 'test_id',
    algorithm: 'test_algorithm',
    recommendation_score: 0.8,
    recommendation_rank: 1,
  })

  // 3. 驗證回應
  expect(response.data.skipped).toBe(true)
  expect(response.data.message).toContain('Analytics 追蹤已跳過')
}
```

### 2. 測試功能 Cookie 跳過

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

  // 2. 呼叫功能 Cookie 端點
  const response = await apiService.post('/api/preferences/set', {
    theme: 'dark',
  })

  // 3. 驗證回應
  expect(response.data.skipped).toBe(true)
  expect(response.data.message).toContain('功能 Cookie 已停用')
}
```

## 最佳實踐

### 1. 預設安全

- 所有非必要功能預設為停用
- 只有明確同意才啟用功能

### 2. 透明處理

- 清楚記錄哪些功能被跳過
- 提供詳細的跳過原因

### 3. 效能考量

- 隱私檢查應該快速且不影響效能
- 考慮快取隱私設定結果

### 4. 錯誤處理

- 隱私檢查失敗時預設為最嚴格設定
- 提供適當的錯誤訊息

### 5. 測試覆蓋

- 測試所有隱私設定組合
- 確保功能正確跳過或啟用

## 監控和日誌

### 隱私檢查日誌

```javascript
// 在 middleware 中記錄隱私檢查結果
logger.debug('隱私同意檢查結果:', {
  userId: req.user?._id,
  sessionId: getSessionId(req),
  hasConsent: !!req.privacyConsent,
  canTrackAnalytics: req.canTrackAnalytics,
  canUseFunctionalCookies: req.canUseFunctionalCookies,
  skippedAnalytics: req.skipAnalytics,
  skippedFunctionalCookies: req.skipFunctionalCookies,
})
```

### 統計資料

```javascript
// 收集隱私設定統計
const privacyStats = {
  totalRequests: 0,
  analyticsSkipped: 0,
  functionalCookiesSkipped: 0,
  noConsent: 0,
}

// 在 middleware 中更新統計
if (req.skipAnalytics) privacyStats.analyticsSkipped++
if (req.skipFunctionalCookies) privacyStats.functionalCookiesSkipped++
if (!req.hasPrivacyConsent) privacyStats.noConsent++
privacyStats.totalRequests++
```

這個實作確保了應用程式完全遵守使用者的隱私偏好，並提供了靈活的方式來根據這些設定調整功能行為。
