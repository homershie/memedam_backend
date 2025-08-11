# Twitter OAuth 1.0a 遷移指南

## 背景

由於 Twitter OAuth 2.0 在本地開發環境中的兼容性問題，我們已將 Twitter 身份驗證從 OAuth 2.0 遷移到 OAuth 1.0a，使用 [Passport.js 官方的 `passport-twitter` 套件](https://www.passportjs.org/packages/passport-twitter/)。

## 變更摘要

### 1. 套件替換

- **移除**: `@superfaceai/passport-twitter-oauth2`
- **安裝**: `passport-twitter` (官方套件)

### 2. 環境變數變更

```env
# 舊的 OAuth 2.0 配置
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_CLIENT_TYPE=confidential

# 新的 OAuth 1.0a 配置
TWITTER_CONSUMER_KEY=your_consumer_key
TWITTER_CONSUMER_SECRET=your_consumer_secret
```

### 3. Passport 策略更新

```javascript
// 舊的 OAuth 2.0 策略
passport.use(
  'twitter-oauth2',
  new TwitterStrategy({
    clientID: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
    // ... 其他 OAuth 2.0 配置
  }),
)

// 新的 OAuth 1.0a 策略
passport.use(
  'twitter',
  new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    // ... 其他 OAuth 1.0a 配置
  }),
)
```

## 設定步驟

### 1. Twitter 開發者平台設定

1. 登入 [Twitter Developer Portal](https://developer.twitter.com/en/portal)
2. 進入您的應用程式
3. 在 **Keys and tokens** 頁面：
   - 複製 **Consumer Key** (API Key)
   - 複製 **Consumer Secret** (API Secret Key)
4. 在 **Settings** 頁面：
   - 設定 **Callback URL**: `http://localhost:4000/api/users/auth/twitter/callback`
   - 確保 **App permissions** 設為 **Read**

### 2. 環境變數配置

創建或更新您的 `.env` 文件：

```env
# Twitter OAuth 1.0a 設定
TWITTER_CONSUMER_KEY=your_consumer_key_here
TWITTER_CONSUMER_SECRET=your_consumer_secret_here
TWITTER_REDIRECT_URI=http://localhost:4000/api/users/auth/twitter/callback
TWITTER_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/twitter/callback

# 前端 URL (可使用 localhost)
FRONTEND_URL=http://localhost:5173
```

### 3. 本地開發設定

**重要**: Twitter OAuth 1.0a 支援 `localhost`，不需要使用 `127.0.0.1`。

- 前端: `http://localhost:5173`
- 後端: `http://localhost:4000`
- 回調 URL: `http://localhost:4000/api/users/auth/twitter/callback`

## 主要優勢

### OAuth 1.0a vs OAuth 2.0

| 特性             | OAuth 1.0a        | OAuth 2.0                |
| ---------------- | ----------------- | ------------------------ |
| 本地開發支援     | ✅ 支援 localhost | ❌ 需要 127.0.0.1 或域名 |
| 設定複雜度       | 🟡 中等           | 🔴 較複雜                |
| 穩定性           | ✅ 成熟穩定       | 🟡 相對較新              |
| Passport.js 支援 | ✅ 官方套件       | ⚠️ 第三方套件            |

### 解決的問題

1. **本地開發兼容性**: OAuth 1.0a 原生支援 localhost
2. **套件穩定性**: 使用 Passport.js 官方維護的套件
3. **設定簡化**: 減少環境變數和配置複雜度

## 測試步驟

### 1. 檢查環境變數

確保以下環境變數已正確設定：

```bash
echo $TWITTER_CONSUMER_KEY
echo $TWITTER_CONSUMER_SECRET
echo $TWITTER_REDIRECT_URI
```

### 2. 啟動服務

```bash
# 啟動後端 (確保在 localhost:4000)
npm start

# 啟動前端 (確保在 localhost:5173)
npm run dev
```

### 3. 測試登入流程

1. 訪問 `http://localhost:5173`
2. 點擊 "Twitter 登入"
3. 查看後端日誌，應該看到：
   ```
   === Twitter OAuth 1.0a 登入開始 ===
   環境變數檢查:
     TWITTER_CONSUMER_KEY: true
     TWITTER_CONSUMER_SECRET: true
     TWITTER_REDIRECT_URI: http://localhost:4000/api/users/auth/twitter/callback
   ```
4. 完成 Twitter 授權
5. 應該成功重定向到首頁並取得 token

## 故障排除

### 問題 1: 環境變數未設定

**症狀**: 日誌顯示 `TWITTER_CONSUMER_KEY: false`
**解決**: 檢查 `.env` 文件中的 Twitter 配置

### 問題 2: 回調 URL 不匹配

**症狀**: Twitter 返回 "Invalid callback URL" 錯誤
**解決**: 確保 Twitter 開發者平台中的回調 URL 與環境變數一致

### 問題 3: 認證失敗

**症狀**: 返回 `oauth_failed` 錯誤
**解決**: 檢查 Consumer Key 和 Secret 是否正確

## 程式碼變更

### 檔案修改清單

1. **config/passport.js**
   - 替換 TwitterStrategy import
   - 更新策略配置
   - 修改環境變數引用

2. **routes/userRoutes.js**
   - 更新認證策略名稱
   - 修改環境變數檢查
   - 簡化綁定流程

3. **package.json**
   - 移除 `@superfaceai/passport-twitter-oauth2`
   - 新增 `passport-twitter`

## 注意事項

1. **不需要 PKCE**: OAuth 1.0a 使用簽名機制，不需要 PKCE
2. **支援 localhost**: 可以直接使用 localhost 進行本地開發
3. **Email 權限**: 需要向 Twitter 申請額外的 email 權限
4. **向後兼容**: 現有用戶資料不受影響

## 參考資料

- [Passport Twitter 官方文檔](https://www.passportjs.org/packages/passport-twitter/)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal)
- [OAuth 1.0a 規範](https://oauth.net/core/1.0a/)

## 修復歷史

- **2025-01-11**: 完成 OAuth 1.0a 遷移
- **2025-01-11**: 添加詳細的測試流程和故障排除指南
