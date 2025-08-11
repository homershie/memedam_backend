# Twitter OAuth 本地開發修復指南

## 問題描述

在本地測試 Twitter 登入時，會跳轉到 `http://localhost:5173/login?error=oauth_failed` 錯誤頁面。

## 問題分析

根據後端日誌分析和官方文檔，問題可能出現在：

1. **回調 URL 使用 localhost 問題**：Twitter OAuth 2.0 在處理 `localhost` 時可能存在限制
2. **環境變數配置不正確**：缺少必要的 Twitter OAuth 配置
3. **時間同步問題**：OAuth 認證對時間同步要求嚴格

## 解決方案

### 1. 使用 127.0.0.1 替代 localhost

Twitter OAuth 2.0 建議使用 `127.0.0.1` 而不是 `localhost` 來避免回調問題。

#### Twitter 開發者平台設定：

1. 登入 [Twitter Developer Portal](https://developer.twitter.com/en/portal)
2. 進入您的應用程式設定
3. 在「Authentication settings」中設定：
   - **Callback URI**: `http://127.0.0.1:4000/api/users/auth/twitter/callback`
   - **Website URL**: `http://127.0.0.1:5173`

#### 環境變數設定：

創建 `.env` 文件，使用以下配置：

```env
# Twitter OAuth 設定
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_CLIENT_TYPE=confidential
TWITTER_REDIRECT_URI=http://127.0.0.1:4000/api/users/auth/twitter/callback
TWITTER_BIND_REDIRECT_URI=http://127.0.0.1:4000/api/users/bind-auth/twitter/callback

# 前端 URL 也要更新
FRONTEND_URL=http://127.0.0.1:5173
```

### 2. 更新 hosts 文件（可選方案）

如果不想使用 127.0.0.1，可以在 hosts 文件中設定自定義域名：

```
# Windows: C:\Windows\System32\drivers\etc\hosts
# macOS/Linux: /etc/hosts
127.0.0.1    myapp.local
```

然後在 Twitter 應用程式設定中使用：
- **Callback URI**: `http://myapp.local:4000/api/users/auth/twitter/callback`
- **Website URL**: `http://myapp.local:5173`

### 3. 檢查系統時間同步

確保系統時間與 NTP 伺服器同步：

```bash
# Windows
w32tm /resync

# macOS
sudo sntp -sS time.apple.com

# Linux
sudo ntpdate -s time.nist.gov
```

### 4. 完整配置檢查清單

#### 環境變數必須設定：
- [ ] `TWITTER_CLIENT_ID`
- [ ] `TWITTER_CLIENT_SECRET`
- [ ] `TWITTER_CLIENT_TYPE=confidential`
- [ ] `TWITTER_REDIRECT_URI=http://127.0.0.1:4000/api/users/auth/twitter/callback`
- [ ] `FRONTEND_URL=http://127.0.0.1:5173`

#### Twitter 開發者平台設定：
- [ ] App permissions: Read
- [ ] Type of App: Web App
- [ ] Callback URI: `http://127.0.0.1:4000/api/users/auth/twitter/callback`
- [ ] Website URL: `http://127.0.0.1:5173`

#### 本地訪問：
- [ ] 使用 `http://127.0.0.1:5173` 而不是 `http://localhost:5173` 訪問前端
- [ ] 確保後端在 `http://127.0.0.1:4000` 運行

## 測試步驟

1. 更新環境變數設定
2. 重新啟動後端服務
3. 使用 `http://127.0.0.1:5173` 訪問前端
4. 點擊 Twitter 登入
5. 檢查後端日誌獲取詳細錯誤信息

## 詳細日誌記錄

我們已經為 Twitter OAuth 回調處理添加了詳細的日誌記錄，包括：

- 環境變數檢查
- 認證過程詳情
- 錯誤詳細信息

測試時請檢查後端日誌中的以下信息：

```
=== Twitter OAuth 回調開始 ===
Query 參數: { state: '...', code: '...' }
環境變數檢查:
  TWITTER_CLIENT_ID: true
  TWITTER_CLIENT_SECRET: true
  TWITTER_REDIRECT_URI: http://127.0.0.1:4000/api/users/auth/twitter/callback
=== Twitter OAuth 認證結果 ===
```

## 常見問題

### 問題 1：`oauth_failed` 錯誤
**原因**：通常是回調 URL 不匹配或環境變數缺失
**解決**：檢查 Twitter 應用程式設定和環境變數配置

### 問題 2：PKCE 相關錯誤
**原因**：Twitter OAuth 2.0 要求使用 PKCE
**解決**：確認配置中有 `pkce: true`（已在 passport 配置中設定）

### 問題 3：時間同步錯誤
**原因**：系統時間與服務器時間不同步
**解決**：同步系統時間

## 參考資料

- [Twitter OAuth 2.0 官方文檔](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [passport-twitter-oauth2 GitHub](https://github.com/superfaceai/passport-twitter-oauth2)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal)

## 修復歷史

- **2025-01-11**：添加詳細日誌記錄和 127.0.0.1 配置建議
- **2025-01-11**：創建完整的修復指南