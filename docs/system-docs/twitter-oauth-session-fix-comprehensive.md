# Twitter OAuth 1.0a Session 修復指南 - 解決 ERR_EMPTY_RESPONSE 錯誤

## 問題概述

當用戶嘗試綁定 Twitter 社群帳號時，出現 `ERR_EMPTY_RESPONSE` 錯誤，同時後端日誌顯示：

```
Error: Failed to find request token in session
    at SessionStore.get (D:\...\passport-oauth1\lib\requesttoken\session.js:13:44)
```

## 根本原因分析

### 1. OAuth 1.0a 流程需求
Twitter OAuth 1.0a 需要兩步驗證：
- 第一步：獲取 request token 並存儲在 session 中
- 第二步：使用 request token 交換 access token

### 2. Session 管理問題
- Session 配置不適合 OAuth 1.0a 的需求
- `resave: false` 和 `saveUninitialized: false` 阻止了 request token 的正確存儲
- Session ID 在 OAuth 流程中可能發生變化

### 3. Host 一致性問題
- 前端和後端必須使用一致的 host（localhost 或 127.0.0.1）
- Twitter 回調 URL 必須與初始請求的 host 匹配

## 修復方案

### 1. Session 配置優化

已更新 `index.js` 中的 session 配置：

```javascript
return session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  name: 'memedam.sid',
  resave: true, // Twitter OAuth 1.0a 必須設為 true
  saveUninitialized: true, // Twitter OAuth 1.0a 必須設為 true
  cookie: {
    httpOnly: true,
    sameSite: 'lax', // 支援 OAuth 跨域流程
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 天
    path: '/',
  },
  // Twitter OAuth 1.0a 最佳化設定
  rolling: false, // 避免 OAuth 流程中 session ID 變化
  unset: 'keep', // 保持 session 資料不被清除
  proxy: process.env.NODE_ENV === 'production',
  genid: () => {
    // 使用更穩定的 session ID 生成方式
    return crypto.randomBytes(32).toString('hex')
  },
  touchAfter: 24 * 3600, // 24 小時後才更新 touch time
})
```

### 2. Passport Twitter 策略增強

已更新 `config/passport.js` 中的 Twitter 綁定策略：

```javascript
passport.use(
  'twitter-bind',
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_API_KEY,
      consumerSecret: process.env.TWITTER_API_SECRET,
      callbackURL: process.env.TWITTER_BIND_REDIRECT_URI || process.env.TWITTER_REDIRECT_URI,
      passReqToCallback: true,
      includeEmail: true,
      sessionKey: 'oauth:twitter', // 確保 session 設定正確
      forceLogin: false,
    },
    async (req, token, tokenSecret, profile, done) => {
      // 添加詳細日誌記錄
      logger.info('Twitter OAuth 綁定策略執行')
      logger.info('Session ID:', req.sessionID || req.session?.id)
      logger.info('Request token 存在:', !!token)
      
      return done(null, { profile, provider: 'twitter' })
    },
  ),
)
```

### 3. 路由錯誤處理增強

已更新 `routes/userRoutes.js` 中的回調處理：

```javascript
router.get(
  '/bind-auth/twitter/callback',
  (req, res, next) => {
    // 詳細的 session 檢查和日誌記錄
    logger.info('=== Twitter OAuth 綁定回調開始 ===')
    logger.info('Session ID:', req.sessionID || req.session?.id)
    logger.info('Session exists:', !!req.session)
    
    // 檢查 session 是否存在
    if (!req.session) {
      logger.error('❌ Session 不存在於 Twitter OAuth 回調中')
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=session_missing&message=${encodeURIComponent('Session 遺失，請重新嘗試綁定')}`
      )
    }
    
    next()
  },
  passport.authenticate('twitter-bind'),
  handleBindAuthCallback
)
```

## 環境配置

### 1. 必要的環境變數

創建 `.env` 文件，包含以下配置：

```env
# Session 設定（對 Twitter OAuth 1.0a 很重要）
SESSION_SECRET=your_very_long_and_secure_session_secret_here

# Twitter OAuth 1.0a 設定（重要：使用一致的 host）
TWITTER_API_KEY=your_twitter_api_key_here
TWITTER_API_SECRET=your_twitter_api_secret_here

# 登入用回調
TWITTER_REDIRECT_URI=http://localhost:4000/api/users/auth/twitter/callback

# 綁定用回調（修復 ERR_EMPTY_RESPONSE 的關鍵）
TWITTER_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/twitter/callback

# 前端 URL（必須與 Twitter OAuth 使用相同的 host）
FRONTEND_URL=http://localhost:5173
```

### 2. Twitter 開發者平台設定

在 [Twitter Developer Portal](https://developer.twitter.com) 設定：

1. **App Settings**：
   - **Callback URLs**:
     - `http://localhost:4000/api/users/auth/twitter/callback`
     - `http://localhost:4000/api/users/bind-auth/twitter/callback`
   - **Website URL**: `http://localhost:5173`

2. **App Permissions**：
   - 設為 **Read** 或 **Read and Write**

## 測試步驟

### 1. 環境準備
```bash
# 1. 停止現有服務
pkill -f "node.*index.js"

# 2. 確保環境變數設定正確
cp .env.example .env
# 編輯 .env 文件，填入正確的 Twitter API 金鑰

# 3. 重新啟動服務
npm start
```

### 2. 測試流程
1. 使用 `http://localhost:5173` 訪問前端（不要使用 127.0.0.1）
2. 登入一個現有帳號
3. 前往設定頁面
4. 點擊「綁定 Twitter 帳號」
5. 觀察後端日誌輸出

### 3. 預期行為

**正確的綁定流程**：
```
=== Twitter OAuth 綁定回調開始 ===
Session ID: [session_id]
Session exists: true
Twitter OAuth 綁定策略執行
Request token 存在: true
✅ Twitter OAuth 認證成功，開始處理綁定
```

**如果仍有問題**：
```
❌ Session 不存在於 Twitter OAuth 回調中
或
❌ Twitter OAuth 認證失敗
```

## 故障排除

### 1. 檢查 Session 存儲

如果使用 Redis：
```bash
# 連接到 Redis 並檢查 session
redis-cli
keys sess:*
```

如果使用 Memory Store：
```bash
# 檢查後端日誌是否顯示 "使用 Memory session store"
```

### 2. 清除瀏覽器數據

```bash
# 清除所有與 localhost:4000 和 localhost:5173 相關的 cookies
# 或使用無痕模式測試
```

### 3. 檢查網路連線

```bash
# 測試後端連線
curl http://localhost:4000/api/test

# 測試前端連線
curl http://localhost:5173
```

### 4. Host 一致性檢查

確保所有配置使用相同的 host：
- 前端 URL: `http://localhost:5173`
- 後端 URL: `http://localhost:4000`
- Twitter 回調 URL: `http://localhost:4000/api/users/bind-auth/twitter/callback`

**避免混合使用 localhost 和 127.0.0.1**

## 常見錯誤

### 1. `ERR_EMPTY_RESPONSE`
- **原因**: Session 中找不到 request token
- **解決**: 確保 session 配置正確，使用一致的 host

### 2. `invalid_request_token`
- **原因**: Request token 已過期或無效
- **解決**: 檢查 Twitter API 金鑰是否正確

### 3. `redirect_uri_mismatch`
- **原因**: 回調 URL 與 Twitter 應用設定不匹配
- **解決**: 檢查 Twitter 開發者平台的回調 URL 設定

## 監控和日誌

### 1. 關鍵日誌點

在綁定過程中，注意以下日誌：
```
=== Twitter OAuth 綁定回調開始 ===
Twitter OAuth 綁定策略執行
✅ Twitter OAuth 認證成功，開始處理綁定
```

### 2. 錯誤指標

如果看到以下日誌，表示仍有問題：
```
❌ Session 不存在於 Twitter OAuth 回調中
❌ Twitter OAuth 認證失敗
Failed to find request token in session
```

## 修復歷史

- **2025-01-12**: 綜合修復 ERR_EMPTY_RESPONSE 錯誤
- **2025-01-12**: 優化 session 配置以支援 OAuth 1.0a
- **2025-01-12**: 增強錯誤處理和日誌記錄
- **2025-01-12**: 統一 host 配置指南

## 相關資源

- [Twitter OAuth 1.0a 官方文檔](https://developer.twitter.com/en/docs/authentication/oauth-1-0a)
- [passport-twitter GitHub](https://github.com/jaredhanson/passport-twitter)
- [express-session 文檔](https://github.com/expressjs/session)

---

**重要提醒**: 如果修復後仍有問題，請提供完整的後端日誌，特別是包含 session 相關的部分。