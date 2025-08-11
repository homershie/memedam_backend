# Discord OAuth 522 錯誤修復總結

## 問題描述

Discord 登入時出現 Cloudflare 522 (Connection timed out) 錯誤，代表流程有到 Cloudflare，但 Cloudflare 連上後端（Origin）後，後端沒有在指定時間內回應，所以中斷了。

從 Render 日誌中發現主要問題：

```
OAuth state 驗證失敗: { provided: 'pcx2h7hccrr8nibr22fck4', expected: undefined }
```

## 根本原因分析

1. **Session Store 問題**：生產環境使用 `MemoryStore`，導致：
   - 應用重啟後 session 資料丟失
   - 多實例部署時 session 不同步
   - OAuth state 參數無法正確保存和驗證

2. **Session 配置問題**：
   - `resave: true` 和 `saveUninitialized: true` 導致不必要的 session 保存
   - 缺乏適當的 session 過期和清理機制

3. **錯誤處理不足**：
   - OAuth state 驗證失敗時缺乏詳細的調試資訊
   - 無法區分 session 過期和其他錯誤類型

## 修復方案

### 1. 改善 Session 配置

**檔案：`index.js`**

```javascript
const configureSession = () => {
  // 根據環境選擇 session store
  let sessionStore

  if (process.env.NODE_ENV === 'production' && redisCache.isConnected && redisCache.client) {
    // 生產環境使用 Redis store
    sessionStore = new RedisStore({
      client: redisCache.client,
      prefix: 'sess:',
      ttl: 86400 * 7, // 7 天
    })
    logger.info('使用 Redis session store')
  } else {
    // 開發環境或 Redis 不可用時使用 MemoryStore
    sessionStore = new session.MemoryStore()
    logger.info('使用 Memory session store')
  }

  return session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    name: process.env.NODE_ENV === 'production' ? '__Host-memedam.sid' : 'memedam.sid',
    resave: false, // 改為 false，避免不必要的 session 保存
    saveUninitialized: false, // 改為 false，只保存有變更的 session
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 天
    },
    rolling: true, // 每次請求都更新 session 過期時間
    unset: 'destroy', // 刪除 session 時完全移除
  })
}
```

### 2. 改善 OAuth State 驗證

**檔案：`routes/userRoutes.js`**

```javascript
const verifyOAuthState = (req, res, next) => {
  const { state } = req.query

  // 確保 session 存在
  if (!req.session) {
    console.error('Session not available in verifyOAuthState')
    const frontendUrl = getFrontendUrl()
    return res.redirect(`${frontendUrl}/login?error=session_unavailable`)
  }

  const sessionState = req.session.oauthState

  // 調試資訊（生產環境也記錄，但減少詳細程度）
  console.log('OAuth state verification:')
  console.log('  Provided state:', state)
  console.log('  Session state:', sessionState)
  console.log('  Session ID:', req.sessionID)
  console.log('  Session exists:', !!req.session)

  // 清除 session 中的 state（無論驗證是否成功）
  delete req.session.oauthState

  if (!state || !sessionState || state !== sessionState) {
    console.error('OAuth state 驗證失敗:', { provided: state, expected: sessionState })

    // 在生產環境中，如果 session 存在但 state 不匹配，可能是 session 過期或重啟
    if (req.session && !sessionState) {
      console.error(
        'Session exists but oauthState is undefined - possible session restart or timeout',
      )
    }

    const frontendUrl = getFrontendUrl()
    return res.redirect(`${frontendUrl}/login?error=invalid_state`)
  }

  // 保存 session 的變更
  req.session.save((err) => {
    if (err) {
      console.error('Session save error in verifyOAuthState:', err)
      const frontendUrl = getFrontendUrl()
      return res.redirect(`${frontendUrl}/login?error=session_save_failed`)
    }

    console.log('OAuth state verified successfully')
    next()
  })
}
```

### 3. 改善 Discord OAuth 路由

**檔案：`routes/userRoutes.js`**

```javascript
// 觸發 Discord OAuth
router.get('/auth/discord', (req, res, next) => {
  // 生成並儲存 state 參數
  const state = generateOAuthState()

  // 確保 session 存在
  if (!req.session) {
    console.error('Session not available in Discord OAuth')
    return res.status(500).json({ error: 'Session not available' })
  }

  req.session.oauthState = state

  // 調試資訊
  console.log('Discord OAuth initiated:')
  console.log('  Generated state:', state)
  console.log('  Session ID:', req.sessionID)

  // 確保 session 被保存
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err)
      return res.status(500).json({ error: 'Session save failed' })
    }

    console.log('Session saved successfully, proceeding with Discord OAuth')
    passport.authenticate('discord', {
      scope: ['identify', 'email'],
      state: state,
    })(req, res, next)
  })
})
```

### 4. 改善 Discord OAuth Callback

**檔案：`routes/userRoutes.js`**

```javascript
// Discord OAuth callback
router.get(
  '/auth/discord/callback',
  verifyOAuthState,
  (req, res, next) => {
    console.log('Discord OAuth callback - state verified, proceeding with authentication')

    passport.authenticate('discord', (err, user, info) => {
      if (err) {
        console.error('Discord OAuth 錯誤:', err)
        const frontendUrl = getFrontendUrl()

        // 處理特定的錯誤類型
        if (err.code === 'DISCORD_ID_ALREADY_BOUND') {
          return res.status(409).json({
            success: false,
            error: 'discord_id 已存在',
            details: err.message,
            suggestion: '該 Discord 帳號已被其他用戶綁定，請使用其他帳號或聯繫客服',
          })
        }

        return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
      }

      if (!user) {
        console.error('Discord OAuth - no user returned')
        const frontendUrl = getFrontendUrl()
        return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
      }

      console.log('Discord OAuth successful, user:', user._id)
      req.user = user
      next()
    })(req, res, next)
  },
  async (req, res) => {
    try {
      console.log('Processing Discord OAuth callback for user:', req.user._id)

      const token = signToken({ _id: req.user._id })
      req.user.tokens = req.user.tokens || []

      // 檢查是否已達到 token 數量限制
      if (req.user.tokens.length >= 3) {
        req.user.tokens.shift() // 移除最舊的 token
      }

      req.user.tokens.push(token)
      await req.user.save()

      console.log('Discord OAuth completed successfully, redirecting to frontend')
      const frontendUrl = getFrontendUrl()
      res.redirect(`${frontendUrl}/?token=${token}`)
    } catch (error) {
      console.error('Discord OAuth callback 錯誤:', error)
      const frontendUrl = getFrontendUrl()
      res.redirect(`${frontendUrl}/login?error=server_error`)
    }
  },
)
```

## 環境變數要求

確保以下環境變數正確設定：

```bash
# Session 配置
SESSION_SECRET=your-session-secret-here

# Redis 配置（生產環境必需）
REDIS_URL=redis://your-redis-url
# 或個別配置
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Discord OAuth 配置
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=https://api.memedam.com/api/users/auth/discord/callback
```

## 測試方法

使用提供的測試腳本：

```bash
node test/oauth-tests/discord-oauth-fix-test.js
```

## 預期效果

修復後，Discord OAuth 應該能夠：

1. **正確保存 OAuth state**：使用 Redis store 確保 session 資料持久化
2. **改善錯誤處理**：提供詳細的調試資訊，便於問題排查
3. **提高穩定性**：避免因 session 丟失導致的 OAuth 失敗
4. **支援多實例部署**：Redis store 支援分散式 session 管理

## 注意事項

1. **Redis 連線**：確保生產環境的 Redis 服務正常運行
2. **Session 清理**：定期清理過期的 session 資料
3. **監控**：監控 OAuth 成功率和錯誤率
4. **備份**：定期備份 Redis 資料

## 相關檔案

- `index.js` - Session 配置
- `routes/userRoutes.js` - OAuth 路由和驗證
- `config/redis.js` - Redis 配置
- `test/oauth-tests/discord-oauth-fix-test.js` - 測試腳本
