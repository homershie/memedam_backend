# OAuth 登入問題修正總結

## 問題描述

1. **Discord 重複 ID 錯誤**：用戶嘗試登入時出現 `discord_id 已存在` 錯誤
2. **Twitter OAuth 失敗**：手動 PKCE 處理與 Passport 策略衝突，scope 配置錯誤

## 根本原因分析

### Discord 問題
- 當已登入用戶嘗試綁定 Discord 帳號時，系統沒有正確處理該 Discord ID 已被其他用戶使用的情況
- 缺乏對重複綁定的適當檢查和錯誤處理
- 錯誤訊息對用戶不友好

### Twitter 問題
- `@superfaceai/passport-twitter-oauth2` 包的 scope 配置不完整
- `userProfileURL` 沒有請求足夠的用戶資訊字段
- 缺乏 `offline.access` scope 導致 refresh token 無法正常工作

## 修正方案

### 1. Discord OAuth 策略修正

#### 改善重複 ID 檢測邏輯
```javascript
// 綁定流程：檢查該 Discord ID 是否已被其他用戶使用
const existingUserWithDiscordId = await User.findOne({ discord_id: profile.id })
if (existingUserWithDiscordId && existingUserWithDiscordId._id.toString() !== req.user._id.toString()) {
  // Discord ID 已被其他用戶使用
  const error = new Error(`Discord ID ${profile.id} 已被其他用戶綁定`)
  error.code = 'DISCORD_ID_ALREADY_BOUND'
  error.statusCode = 409
  return done(error, null)
}
```

#### 友好的錯誤處理
```javascript
if (err.code === 'DISCORD_ID_ALREADY_BOUND') {
  return res.status(409).json({
    success: false,
    error: 'discord_id 已存在',
    details: err.message,
    suggestion: '該 Discord 帳號已被其他用戶綁定，請使用其他帳號或聯繫客服'
  })
}
```

### 2. Twitter OAuth 策略修正

#### 改善 Scope 配置
```javascript
scope: ['tweet.read', 'users.read', 'offline.access']  // 添加 offline.access
```

#### 更新用戶資訊 URL
```javascript
userProfileURL: 'https://api.twitter.com/2/users/me?user.fields=id,username,name,email,verified'
```

#### 同樣的重複 ID 檢測
```javascript
// 綁定流程：檢查該 Twitter ID 是否已被其他用戶使用
const existingUserWithTwitterId = await User.findOne({ twitter_id: profile.id })
if (existingUserWithTwitterId && existingUserWithTwitterId._id.toString() !== req.user._id.toString()) {
  const error = new Error(`Twitter ID ${profile.id} 已被其他用戶綁定`)
  error.code = 'TWITTER_ID_ALREADY_BOUND'
  error.statusCode = 409
  return done(error, null)
}
```

### 3. 回調處理改善

#### 自定義錯誤處理中間件
原來的簡單重定向：
```javascript
passport.authenticate('discord', {
  failureRedirect: `${getFrontendUrl()}/login?error=oauth_failed`,
})
```

修正為詳細的錯誤處理：
```javascript
(req, res, next) => {
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
          suggestion: '該 Discord 帳號已被其他用戶綁定，請使用其他帳號或聯繫客服'
        })
      }
      
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }
    
    if (!user) {
      const frontendUrl = getFrontendUrl()
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`)
    }
    
    req.user = user
    next()
  })(req, res, next)
}
```

## 修正檔案清單

1. **config/passport.js**
   - 改善 Discord 和 Twitter OAuth 策略的重複 ID 檢測
   - 更新 Twitter scope 和 userProfileURL 配置
   - 添加具體的錯誤代碼和狀態碼

2. **routes/userRoutes.js**
   - 修改 Discord 和 Twitter OAuth 回調處理
   - 添加自定義錯誤處理中間件
   - 提供友好的錯誤訊息

3. **test/oauth-tests/oauth-fix-verification.js**
   - 創建驗證測試以確保修正有效

## 預期效果

### Discord 登入
- ✅ 重複 ID 錯誤會返回明確的 409 狀態碼
- ✅ 提供友好的錯誤訊息指導用戶
- ✅ 防止同一 Discord 帳號被多個用戶綁定
- ✅ 允許同一用戶重複綁定（幂等操作）

### Twitter 登入
- ✅ 修正 scope 配置，添加 `offline.access`
- ✅ 改善用戶資訊獲取，包含更多字段
- ✅ 同樣的重複 ID 保護機制
- ✅ 更穩定的 OAuth 2.0 with PKCE 流程

## 測試建議

1. **Discord 測試**
   - 嘗試用已綁定的 Discord 帳號登入其他用戶
   - 驗證錯誤訊息是否友好且明確
   - 測試同一用戶重複綁定是否正常

2. **Twitter 測試**
   - 測試 Twitter OAuth 授權流程
   - 驗證是否能成功獲取用戶資訊
   - 測試重複綁定保護機制

3. **環境變數檢查**
   ```bash
   # 確保以下環境變數已正確設置
   TWITTER_CLIENT_ID=your_twitter_client_id
   TWITTER_CLIENT_SECRET=your_twitter_client_secret
   TWITTER_CLIENT_TYPE=confidential
   TWITTER_REDIRECT_URI=http://localhost:4000/api/users/auth/twitter/callback
   
   DISCORD_CLIENT_ID=your_discord_client_id
   DISCORD_CLIENT_SECRET=your_discord_client_secret
   DISCORD_REDIRECT_URI=http://localhost:4000/api/users/auth/discord/callback
   ```

## 注意事項

1. **Twitter 開發者設定**
   - 確保 Twitter 應用啟用了 OAuth 2.0 with PKCE
   - 回調 URL 必須與 `TWITTER_REDIRECT_URI` 完全匹配

2. **Discord 應用設定**
   - 確保 Discord 應用的 OAuth2 設定正確
   - 回調 URL 必須與 `DISCORD_REDIRECT_URI` 完全匹配

3. **資料庫索引**
   - 確保 `discord_id` 和 `twitter_id` 有唯一索引
   - 這有助於在資料庫層面防止重複

修正後，兩個 OAuth 登入問題都應該得到解決，用戶體驗會更加流暢和友好。