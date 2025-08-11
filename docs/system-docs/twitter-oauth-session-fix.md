# Twitter OAuth 1.0a Session 修復指南

## 問題描述

Twitter OAuth 1.0a 出現 `Failed to find request token in session` 錯誤，導致認證失敗。

## 根本原因

1. **Session 配置不適合 OAuth 1.0a**：
   - `resave: false` 和 `saveUninitialized: false` 阻止了 request token 的保存
   - `rolling: true` 導致 session 在 OAuth 流程中變化

2. **Host 不一致問題**：
   - 前端從 `127.0.0.1:4000` 發起請求
   - Twitter 回調到 `localhost:4000`
   - 導致 session 無法匹配

## 解決方案

### 1. 修正 Session 配置

已更新 `index.js` 中的 session 配置：

```javascript
return session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  name: 'memedam.sid',
  resave: true, // Twitter OAuth 1.0a 需要 resave
  saveUninitialized: true, // Twitter OAuth 1.0a 需要初始化 session
  cookie: {
    httpOnly: true,
    sameSite: 'lax', // 支援 OAuth 跨域流程
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 天
    // 本地開發環境不限制 domain
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
  },
  // Twitter OAuth 1.0a 相容設定
  rolling: false, // 避免 OAuth 流程中 session 變化
  unset: 'keep', // 保持 session 資料
  // 只在生產環境信任代理
  proxy: process.env.NODE_ENV === 'production',
  genid: () => {
    return crypto.randomBytes(16).toString('hex')
  },
})
```

### 2. 環境變數配置

確保使用一致的 host：

```env
# 使用 localhost 保持一致性
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_REDIRECT_URI=http://localhost:4000/api/users/auth/twitter/callback
FRONTEND_URL=http://localhost:5173
```

### 3. Twitter 開發者平台設定

在 Twitter Developer Portal 中設定：

1. **App Settings**：
   - **Callback URL**: `http://localhost:4000/api/users/auth/twitter/callback`
   - **Website URL**: `http://localhost:5173`

2. **App Permissions**：
   - 設為 **Read**

### 4. 測試步驟

1. 重新啟動後端服務
2. 清除瀏覽器 cookies
3. 使用 `http://localhost:5173` 訪問前端（不是 127.0.0.1）
4. 點擊 Twitter 登入

### 5. 預期行為

正確的 OAuth 1.0a 流程：

```
1. GET /api/users/auth/twitter
   → 生成 request token 並保存到 session
   → 重定向到 Twitter 授權頁面

2. Twitter 授權後回調
   → GET /api/users/auth/twitter/callback?oauth_token=xxx&oauth_verifier=yyy
   → 從 session 中找到 request token
   → 交換 access token
   → 創建用戶或登入
   → 重定向到前端首頁
```

## 故障排除

### 檢查 Session

在回調處理中添加日誌：

```javascript
console.log('Session 內容:', req.session)
console.log('Session ID:', req.sessionID)
console.log('Request host:', req.get('host'))
```

### 清除 Cookies

如果仍有問題，清除瀏覽器中的所有 `memedam.sid` cookies。

### 檢查環境變數

確認所有 Twitter 相關環境變數正確設定：

```bash
echo $TWITTER_API_KEY
echo $TWITTER_API_SECRET
echo $TWITTER_REDIRECT_URI
```

## 修復歷史

- **2025-01-11**: 修正 session 配置，支援 OAuth 1.0a
- **2025-01-11**: 移除 Twitter 回調中的 verifyOAuthState 中間件
- **2025-01-11**: 統一使用 localhost 避免 host 不一致問題
