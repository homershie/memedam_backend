# OAuth 綁定功能整合指南

## 概述

本系統新增了 OAuth 綁定功能，允許已登入的用戶將社群帳號綁定到現有帳戶，而無需創建新帳戶。

## 功能特點

### 1. 分離登入和綁定邏輯

- **登入 OAuth**：創建新用戶或登入現有用戶
- **綁定 OAuth**：將社群帳號綁定到已登入的用戶

### 2. 安全性增強

- **State 參數**：防止 CSRF 攻擊
- **Session 管理**：安全存儲綁定狀態
- **重複綁定檢查**：防止同一社群帳號被多個用戶綁定

### 3. 支援的社群平台

- Google
- Facebook
- Discord
- Twitter

## API 端點

### 1. 獲取綁定狀態

```http
GET /api/users/bind-status
Authorization: Bearer <token>
```

**回應範例：**

```json
{
  "success": true,
  "bindStatus": {
    "google": false,
    "facebook": true,
    "discord": false,
    "twitter": false
  },
  "message": "成功獲取綁定狀態"
}
```

### 2. 初始化 OAuth 綁定流程

```http
GET /api/users/bind-auth/:provider
Authorization: Bearer <token>
```

**參數：**

- `provider`: 社群平台 (google, facebook, discord, twitter)

**回應範例：**

```json
{
  "success": true,
  "authUrl": "/api/users/bind-auth/google/init?state=abc123",
  "state": "abc123",
  "message": "正在初始化 Google 綁定流程"
}
```

### 3. OAuth 授權初始化

```http
GET /api/users/bind-auth/:provider/init?state=<state>
Authorization: Bearer <token>
```

### 4. OAuth 綁定回調

```http
GET /api/users/bind-auth/:provider/callback
```

**回應範例：**

```json
{
  "success": true,
  "message": "成功綁定 google 帳號",
  "user": {
    "_id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "google_id": "google_profile_id"
  }
}
```

## 環境變數配置

### 必需的環境變數

```env
# Session 配置
SESSION_SECRET=your-session-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/users/auth/google/callback
GOOGLE_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/google/callback

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
FACEBOOK_REDIRECT_URI=http://localhost:4000/api/users/auth/facebook/callback
FACEBOOK_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/facebook/callback

# Discord OAuth
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:4000/api/users/auth/discord/callback
DISCORD_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/discord/callback

# Twitter OAuth
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_REDIRECT_URI=http://localhost:4000/api/users/auth/twitter/callback
TWITTER_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/twitter/callback
```

## 前端整合範例

### 1. 獲取綁定狀態

```javascript
const getBindStatus = async () => {
  const response = await fetch('/api/users/bind-status', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json()
  return data.bindStatus
}
```

### 2. 初始化綁定流程

```javascript
const initBindAuth = async (provider) => {
  const response = await fetch(`/api/users/bind-auth/${provider}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await response.json()

  if (data.success) {
    // 重定向到 OAuth 授權頁面
    window.location.href = data.authUrl
  }
}
```

### 3. 處理綁定結果

```javascript
// 在 OAuth 回調頁面處理結果
const handleBindCallback = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const success = urlParams.get('success')
  const message = urlParams.get('message')

  if (success === 'true') {
    // 綁定成功
    showSuccessMessage(message)
    // 更新綁定狀態
    updateBindStatus()
  } else {
    // 綁定失敗
    showErrorMessage(message)
  }
}
```

## 錯誤處理

### 常見錯誤碼

- `400`: 不支援的社群平台
- `401`: 未授權訪問
- `404`: 找不到使用者
- `409`: 社群帳號已被綁定或用戶已綁定該平台
- `500`: 伺服器錯誤

### 錯誤回應範例

```json
{
  "success": false,
  "message": "此 Google 帳號已被其他使用者綁定"
}
```

## 安全考量

### 1. State 參數驗證

- 每個 OAuth 請求都包含唯一的 state 參數
- 在回調中驗證 state 參數防止 CSRF 攻擊

### 2. Session 管理

- 使用 express-session 管理綁定狀態
- Session 包含 oauthState、bindUserId、bindProvider 等資訊

### 3. 重複綁定檢查

- 檢查社群帳號是否已被其他用戶綁定
- 檢查用戶是否已綁定該平台

## 測試

### 運行測試

```bash
npm test test/api-tests/oauth-bind-test.js
```

### 測試覆蓋範圍

- 綁定狀態獲取
- OAuth 初始化流程
- 錯誤處理
- 已綁定帳號的處理

## 部署注意事項

### 1. 生產環境配置

- 設定 `NODE_ENV=production`
- 使用 HTTPS 和安全的 cookie 設定
- 配置正確的 callback URL

### 2. 社群平台配置

- 在 Google Console 中添加綁定 callback URL
- 在 Facebook 開發者平台配置綁定 redirect URI
- 在 Discord 開發者平台設定綁定 callback
- 在 Twitter 開發者平台配置綁定 redirect URI

### 3. 監控和日誌

- 監控 OAuth 綁定成功率
- 記錄綁定失敗的原因
- 監控 session 使用情況

## 未來擴展

### 1. 支援更多社群平台

- GitHub
- LinkedIn
- Microsoft

### 2. 功能增強

- 批量綁定/解綁
- 綁定歷史記錄
- 自動同步用戶資訊

### 3. 安全性增強

- 雙因素認證整合
- 綁定驗證碼
- 異常綁定檢測
