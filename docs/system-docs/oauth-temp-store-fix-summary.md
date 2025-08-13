# OAuth 綁定臨時存儲修復方案

## 問題描述

在 OAuth 帳號綁定流程中，彈出視窗無法正確維護 Session 狀態，導致出現 "OAuth 錯誤 授權失敗: auth_required" 錯誤。

### 根本原因

1. **Session 初始化問題**：當彈出視窗發送請求時，`req.session` 是 `null`，即使手動設置 `req.session = {}`，這個物件並不是由 `express-session` 管理的真正 Session 物件。

2. **瀏覽器限制**：瀏覽器對彈出視窗的第三方 Cookie 有嚴格限制，導致 `express-session` 無法正常工作。

3. **編碼問題**：日誌中出現亂碼，影響調試。

## 解決方案

### 1. 創建臨時存儲系統

**文件**: `memedam_backend/utils/oauthTempStore.js`

- 使用 `Map` 作為臨時存儲，避免依賴 `express-session`
- 實現自動過期清理機制（5分鐘過期）
- 提供完整的 CRUD 操作：`storeBindState`、`getBindState`、`removeBindState`
- 包含詳細的日誌記錄和錯誤處理

### 2. 修改 OAuth 初始化路由

**文件**: `memedam_backend/routes/userRoutes.js`

**主要變更**:

- 移除對 `req.session` 的依賴
- 使用 JWT token 驗證用戶身份
- 將綁定狀態存儲到臨時緩存中
- 改進錯誤處理和日誌記錄

**關鍵代碼變更**:

```javascript
// 從 token 獲取用戶 ID
if (!req.session && token) {
  const decoded = jwt.verify(token, JWT_SECRET)
  const user = await User.findById(decoded._id)
  bindUserId = user._id.toString()
}

// 存儲到臨時緩存
const { storeBindState } = await import('../utils/oauthTempStore.js')
const stored = storeBindState(state, bindUserId, provider)
```

### 3. 修改 Passport 策略

**文件**: `memedam_backend/config/passport.js`

**主要變更**:

- 修改 `google-bind` 策略的回調函數
- 從臨時存儲中獲取綁定狀態
- 實現完整的帳號綁定邏輯
- 自動清理臨時存儲

**關鍵代碼變更**:

```javascript
// 從臨時緩存中獲取綁定狀態
const { getBindState, removeBindState } = await import('../utils/oauthTempStore.js')
const storedBindState = getBindState(oauthState)

// 執行綁定邏輯
user.socialAccounts.push({
  provider: 'google',
  id: profile.id,
  displayName: profile.displayName,
  email: profile.emails?.[0]?.value,
  accessToken: accessToken,
  refreshToken: refreshToken,
  profile: profile._json,
})
```

### 4. 修改回調處理函數

**文件**: `memedam_backend/controllers/userController.js`

**主要變更**:

- 修改 `handleBindAuthCallback` 函數
- 使用臨時存儲而不是 Session
- 改進錯誤處理和清理機制

### 5. 改進日誌系統

**文件**: `memedam_backend/utils/logger.js`

**主要變更**:

- 強制設置 UTF-8 編碼
- 改進 pino-pretty 配置
- 添加自定義時間格式化

## 技術架構

### 數據流程

1. **初始化階段**:

   ```
   前端彈出視窗 → /bind-auth/:provider/init → JWT 驗證 → 臨時存儲 → OAuth 重定向
   ```

2. **回調階段**:
   ```
   OAuth 回調 → Passport 策略 → 臨時存儲檢索 → 帳號綁定 → 清理存儲 → 重定向
   ```

### 存儲結構

```javascript
Map<state, {
  userId: string,
  provider: string,
  timestamp: number
}>
```

### 過期機制

- 自動清理：每分鐘檢查一次過期狀態
- 過期時間：5分鐘
- 手動清理：綁定完成或錯誤時立即清理

## 測試驗證

### 創建測試文件

**文件**: `memedam_backend/test/oauth-tests/test-temp-store.js`

測試項目：

- 存儲綁定狀態
- 獲取綁定狀態
- 刪除綁定狀態
- 統計資訊
- 過期處理

### 運行測試

```bash
node test/oauth-tests/test-temp-store.js
```

## 部署注意事項

### 開發環境

- 使用 `Map` 作為臨時存儲
- 自動清理機制確保記憶體不會洩漏
- 詳細日誌記錄便於調試

### 生產環境

- 建議使用 Redis 替代 `Map`
- 設置適當的過期時間
- 監控存儲使用情況

### 環境變數

確保以下環境變數正確設置：

- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_BIND_REDIRECT_URI`

## 錯誤處理

### 常見錯誤及解決方案

1. **"綁定狀態無效或已過期"**
   - 檢查 state 參數是否正確傳遞
   - 確認臨時存儲是否正常工作

2. **"JWT 驗證失敗"**
   - 檢查 token 是否正確傳遞
   - 確認 JWT_SECRET 環境變數

3. **"用戶認證失效"**
   - 檢查用戶是否已登錄
   - 確認 token 是否有效

## 監控和維護

### 日誌監控

- 監控臨時存儲的創建和清理
- 追蹤綁定成功和失敗的統計
- 檢查過期清理的執行情況

### 性能監控

- 監控臨時存儲的大小
- 檢查記憶體使用情況
- 追蹤綁定流程的響應時間

## 總結

這個解決方案通過引入臨時存儲機制，成功解決了彈出視窗 Session 管理的問題。主要優勢：

1. **可靠性**：不依賴瀏覽器的 Session Cookie 限制
2. **安全性**：使用 JWT 驗證和自動過期機制
3. **可維護性**：清晰的代碼結構和詳細的日誌記錄
4. **可擴展性**：易於遷移到 Redis 等持久化存儲

這個方案確保了 OAuth 綁定流程在各種瀏覽器環境下都能正常工作。
