# OAuth 綁定故障排除指南

## 問題描述
當用戶嘗試綁定 Google 帳號時，跳轉到 `/api/users/bind-auth/google/init?state=...` 顯示空白頁面。

## 問題原因分析

### 1. 環境變數配置問題
- **問題**: 生產環境的 OAuth 回調 URL 設定錯誤
- **影響**: Google OAuth 策略無法正確重定向
- **解決方案**: 確保環境變數正確設定

### 2. Google OAuth 應用程式設定問題
- **問題**: Google Cloud Console 中的「授權的重新導向 URI」沒有包含生產環境的 URL
- **影響**: Google 拒絕重定向到未授權的 URL
- **解決方案**: 在 Google Cloud Console 中添加生產環境的回調 URL

### 3. Session 配置問題
- **問題**: OAuth 綁定需要 session 支持來存儲 state 參數
- **影響**: 無法維持綁定流程的狀態
- **解決方案**: 確保 session 中間件正確配置

## 修復步驟

### 步驟 1: 檢查環境變數
使用調試端點檢查配置：
```bash
curl https://www.memedam.com/api/test/oauth-debug
```

確保以下環境變數正確設定：
```env
# Google OAuth 配置
GOOGLE_CLIENT_ID=你的_google_client_id
GOOGLE_CLIENT_SECRET=你的_google_client_secret
GOOGLE_REDIRECT_URI=https://www.memedam.com/api/users/auth/google/callback
GOOGLE_BIND_REDIRECT_URI=https://www.memedam.com/api/users/bind-auth/google/callback

# Session 配置
SESSION_SECRET=你的_session_secret
```

### 步驟 2: 更新 Google Cloud Console 設定
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇您的專案
3. 前往「API 和服務」→「憑證」
4. 點擊您的 OAuth 2.0 用戶端 ID
5. 在「授權的重新導向 URI」中添加：
   - `https://www.memedam.com/api/users/auth/google/callback`
   - `https://www.memedam.com/api/users/bind-auth/google/callback`

### 步驟 3: 檢查 Session 配置
使用調試端點檢查 session：
```bash
curl https://www.memedam.com/api/test/session-debug
```

### 步驟 4: 正確的綁定流程
確保前端使用正確的流程：

1. **第一步**: 調用認證端點獲取授權 URL
```javascript
// 需要帶上 Authorization header
const response = await fetch('/api/users/bind-auth/google', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
})
const { authUrl } = await response.json()
```

2. **第二步**: 重定向到授權 URL
```javascript
window.location.href = authUrl
```

**錯誤的做法**: 直接跳轉到 `/api/users/bind-auth/google/init`

## 調試工具

### OAuth 配置調試
```bash
curl https://www.memedam.com/api/test/oauth-debug
```

### Session 調試
```bash
curl -c cookies.txt -b cookies.txt https://www.memedam.com/api/test/session-debug
```

### 檢查環境變數
```bash
# 在伺服器上執行
echo $GOOGLE_BIND_REDIRECT_URI
echo $SESSION_SECRET
```

## 常見錯誤排解

### 錯誤 1: "不支援的社群平台"
- **原因**: provider 參數錯誤或不在支援清單中
- **解決**: 確保使用 'google'、'facebook'、'discord' 或 'twitter'

### 錯誤 2: "OAuth 配置錯誤"
- **原因**: 環境變數未設定或值為空
- **解決**: 檢查並設定相關環境變數

### 錯誤 3: "缺少 state 參數"
- **原因**: URL 中沒有 state 參數
- **解決**: 確保使用正確的綁定流程

### 錯誤 4: 空白頁面
- **原因**: 多種可能：環境變數錯誤、Google 設定錯誤、策略未初始化
- **解決**: 依序檢查上述修復步驟

## 測試驗證

### 1. 測試環境變數
```bash
curl https://www.memedam.com/api/test/oauth-debug
```
應該返回所有 OAuth 配置為 `true`

### 2. 測試完整流程
1. 登入用戶
2. 調用 `/api/users/bind-auth/google` 獲取授權 URL
3. 訪問授權 URL
4. 確認能正確重定向到 Google

### 3. 檢查伺服器日誌
```bash
# 查看相關錯誤日誌
tail -f logs/app.log | grep -i oauth
```

## 預防措施

1. **定期檢查配置**: 使用調試端點定期檢查配置狀態
2. **環境一致性**: 確保開發、測試、生產環境的配置一致
3. **監控錯誤**: 設定 OAuth 相關錯誤的監控和警報
4. **文檔更新**: 當更改 OAuth 配置時，及時更新文檔

## 相關文件

- [OAuth 綁定實作摘要](./oauth-bind-implementation-summary.md)
- [OAuth 綁定整合](../user-docs/oauth-bind-integration.md)
- [API 文檔](../api-docs/swagger-api-documentation.md)