# Google OAuth 2.0 政策問題修正總結

## 問題描述

前端設定頁面在測試 Google OAuth 綁定時出現以下錯誤：

```
已封鎖存取權：授權錯誤
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure.
錯誤代碼 400： invalid_request
```

## 根本原因

Google 在 2023 年加強了 OAuth 2.0 政策，要求應用程式：

1. 只請求必要的 scopes
2. 提供完整的隱私政策和使用條款
3. 通過 Google 驗證（外部應用程式）
4. 符合安全最佳實踐

## 修正內容

### 1. 後端 Scopes 最小化

**檔案：** `config/passport.js`

- 將 Google OAuth 策略的 scopes 從預設值改為最小化設定
- 登入策略：`['openid', 'email', 'profile']`
- 綁定策略：`['openid', 'email', 'profile']`

**檔案：** `routes/userRoutes.js`

- 更新 OAuth 綁定路由的 scopes 設定
- 確保與 passport.js 中的設定一致

### 2. 前端錯誤診斷增強

**檔案：** `src/utils/oauthConfigChecker.js`

- 增強 `diagnoseOAuthError` 函數
- 添加 Google OAuth 2.0 政策錯誤的特殊處理
- 新增 `getGoogleOAuthChecklist` 函數提供詳細檢查清單

**檔案：** `src/components/OAuthDebugDialog.vue`

- 增強錯誤顯示，包含立即行動建議
- 添加 Google 政策要求檢查清單
- 新增配置檢查清單顯示功能

## 建議的 Google Cloud Console 設定

### 1. 應用程式類型設定

- **開發階段：** 建議使用「內部」應用程式類型
- **生產環境：** 外部應用程式需要 Google 驗證

### 2. OAuth 同意畫面設定

- 應用程式名稱：迷因典
- 應用程式描述：迷因分享平台
- 隱私政策 URL：必需設定
- 使用條款 URL：必需設定
- 應用程式圖示：建議添加

### 3. 重定向 URI 設定

```
# 後端回調 URI
http://localhost:4000/api/users/auth/google/callback
http://localhost:4000/api/users/bind-auth/google/callback

# 前端 URI
http://localhost:5173
http://localhost:5173/
http://localhost:5173/oauth-callback
http://localhost:5173/settings
```

### 4. 測試用戶設定（外部應用程式）

- 添加測試用戶電子信箱
- 確認測試用戶已接受邀請
- 測試用戶數量限制為 100 個

## 環境變數檢查

確保以下環境變數已正確設定：

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/users/auth/google/callback
GOOGLE_BIND_REDIRECT_URI=http://localhost:4000/api/users/bind-auth/google/callback
```

## 測試步驟

1. **使用 OAuth 調試工具**
   - 開啟設定頁面
   - 點擊社群帳號綁定區域的「調試」按鈕
   - 查看配置檢查結果

2. **檢查 Google Cloud Console**
   - 確認所有重定向 URI 已設定
   - 檢查 OAuth 同意畫面設定
   - 驗證應用程式類型設定

3. **測試 OAuth 流程**
   - 點擊「測試 API 端點」
   - 點擊「測試直接 Google OAuth」
   - 檢查錯誤診斷結果

## 常見問題解決

### 1. invalid_request 錯誤

- 檢查 client_id 是否正確
- 確認 redirect_uri 在授權列表中
- 驗證 scopes 設定

### 2. redirect_uri_mismatch 錯誤

- 確認重定向 URI 完全匹配
- 檢查協議和端口號
- 注意 URI 結尾的斜線

### 3. access_denied 錯誤

- 檢查應用程式驗證狀態
- 確認測試用戶設定
- 檢查 OAuth 同意畫面設定

## 下一步行動

1. **立即檢查 Google Cloud Console 設定**
2. **確認環境變數配置**
3. **使用 OAuth 調試工具進行測試**
4. **根據錯誤診斷結果進行修正**

## 相關檔案

- `config/passport.js` - OAuth 策略配置
- `routes/userRoutes.js` - OAuth 路由處理
- `src/utils/oauthConfigChecker.js` - OAuth 配置檢查工具
- `src/components/OAuthDebugDialog.vue` - OAuth 調試對話框
- `src/pages/settings.vue` - 設定頁面

## 參考資源

- [Google OAuth 2.0 政策](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- [OAuth 同意畫面設定](https://console.cloud.google.com/apis/credentials/consent)
