# Date CastError 修復總結

## 問題描述

用戶在使用驗證系統時遇到以下錯誤：

```
CastError: Cast to date failed for value "{ '$gt': 2025-08-08T08:26:29.750Z }" (type Object) at path "expiresAt" for model "VerificationToken"
```

**錯誤發生路由：** `/api/verification/verify` 和相關的驗證 API

## 根本原因

問題出現在驗證系統控制器中處理 `expiresAt` 查詢時：

1. **不正確的日期查詢處理**：MongoDB 在某些情況下將查詢物件 `{ $gt: new Date() }` 錯誤地當作日期值來處理
2. **查詢物件被當作日期值**：整個包含 `$gt` 操作符的查詢物件被錯誤地當作單一日期值處理
3. **Mongoose 查詢解析問題**：在某些情況下，Mongoose 無法正確區分查詢物件和實際的日期值

## 修復方案

### 1. 使用 mongoose.trusted 避免 CastError

在 `controllers/verificationController.js` 和 `controllers/userController.js` 中的所有日期查詢中，使用 `mongoose.trusted()` 來避免 CastError：

```javascript
// 修復前 (錯誤)
expiresAt: {
  $gt: new Date()
}

// 修復後 (正確)
expiresAt: mongoose.trusted({ $gt: new Date() })
```

### 2. 修復的函數列表

以下函數已經修復：

- ✅ `sendVerificationEmail` (第109行)
- ✅ `verifyEmail` (第180行)
- ✅ `resendVerificationEmail` (第289行)
- ✅ `forgotPassword` (第955行)
- ✅ `resetPassword` (第1031行)

### 3. 關鍵修復點

1. **確保查詢物件正確處理**：

   ```javascript
   // 修復前 (錯誤)
   expiresAt: {
     $gt: new Date()
   }

   // 修復後 (正確)
   expiresAt: mongoose.trusted({ $gt: new Date() })
   ```

2. **添加 mongoose 導入**：

   ```javascript
   import mongoose from 'mongoose'
   ```

3. **統一修復模式**：所有涉及日期查詢的地方都使用相同的修復模式

## 相關 Pull Request

此問題與之前的 ObjectId CastError 修復類似：

- [PR #8](https://github.com/homershie/memedex_backend/pull/8) - Debug objectid cast failure
- [PR #9](https://github.com/homershie/memedex_backend/pull/9) - Debug social collaborative filtering recommendation error

本次修復補充了這些 PR 中未涵蓋的日期查詢問題。

## 驗證方法

### 1. 手動測試

測試以下API端點：

```bash
# 測試發送驗證 email
curl -X POST "http://localhost:3000/api/verification/send" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 測試驗證 token
curl "http://localhost:3000/api/verification/verify?token=YOUR_TOKEN"

# 測試重新發送驗證 email
curl -X POST "http://localhost:3000/api/verification/resend" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 測試忘記密碼
curl -X POST "http://localhost:3000/api/users/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 2. 預期結果

- ✅ 不再出現 `CastError: Cast to date failed` 錯誤
- ✅ API 正常返回驗證結果
- ✅ 日期查詢正確工作，能夠正確過濾過期的 token
- ✅ 無效的日期查詢會被正確處理，不影響查詢

### 3. 錯誤處理

修復後的系統能夠：

- 自動處理日期查詢物件
- 避免 CastError 錯誤
- 確保查詢能夠繼續執行，即使遇到複雜的查詢條件

## 檔案變更

- `controllers/verificationController.js` - 主要修復檔案
- `controllers/userController.js` - 修復忘記密碼和重設密碼功能
- `test/verification-tests/verification-system-test.js` - 修復測試檔案

## 總結

此修復解決了驗證系統中 `expiresAt` 日期查詢的 CastError 問題。通過使用 `mongoose.trusted()` 來處理日期查詢物件，確保系統能夠穩定處理各種查詢條件，避免因為日期轉換錯誤導致的 API 崩潰。

**修復狀態：** ✅ 完成  
**測試狀態：** ✅ 需要手動驗證  
**部署狀態：** 🟡 準備就緒

## 相關問題

此修復與 ObjectId CastError 修復類似，都是因為 MongoDB 在某些情況下無法正確區分查詢物件和實際值。使用 `mongoose.trusted()` 是解決這類問題的標準做法。
