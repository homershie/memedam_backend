# 用戶 API 功能增強

## 概述

本次更新為 MemeDam 後端新增了三個重要的用戶管理功能，並擴展了用戶模型以支援更多個人化設定。

## 新增功能

### 1. 密碼變更 API

**端點：** `POST /api/users/change-password`

**功能：** 允許已登入的用戶變更自己的密碼

**請求格式：**

```json
{
  "currentPassword": "目前密碼",
  "newPassword": "新密碼"
}
```

**回應格式：**

```json
{
  "success": true,
  "message": "密碼已成功變更，請重新登入"
}
```

**安全特性：**

- 驗證目前密碼正確性
- 新密碼長度驗證（8-20字元）
- 防止新密碼與目前密碼相同
- 變更後清除所有登入 token，強制重新登入
- 使用資料庫事務確保原子性操作

### 2. 電子信箱變更 API

**端點：** `POST /api/users/change-email`

**功能：** 允許已登入的用戶變更自己的電子信箱

**請求格式：**

```json
{
  "newEmail": "新電子信箱",
  "currentPassword": "目前密碼"
}
```

**回應格式：**

```json
{
  "success": true,
  "message": "電子信箱已成功變更，請重新驗證"
}
```

**安全特性：**

- 驗證目前密碼正確性
- 電子信箱格式驗證
- 檢查新電子信箱是否已被其他用戶使用
- 變更後重置電子信箱驗證狀態
- 使用資料庫事務確保原子性操作

### 3. 社群帳號解除綁定 API

**端點：** `DELETE /api/users/unbind/:provider`

**功能：** 允許已登入的用戶解除綁定社群帳號

**支援的社群平台：**

- `google` - Google 帳號
- `facebook` - Facebook 帳號
- `discord` - Discord 帳號
- `twitter` - Twitter 帳號

**回應格式：**

```json
{
  "success": true,
  "message": "成功解除綁定google帳號"
}
```

**安全特性：**

- 檢查是否已綁定該社群帳號
- 防止解除綁定主要登入方式
- 使用資料庫事務確保原子性操作

## 用戶模型擴展

### 新增通知設定

```javascript
notificationSettings: {
  browser: { type: Boolean, default: false },        // 瀏覽器通知
  newFollower: { type: Boolean, default: true },     // 新粉絲通知
  newComment: { type: Boolean, default: true },      // 新評論通知
  newLike: { type: Boolean, default: true },         // 新讚通知
  newMention: { type: Boolean, default: true },      // 新提及通知
  trendingContent: { type: Boolean, default: false }, // 熱門內容通知
  weeklyDigest: { type: Boolean, default: true },    // 週報通知
}
```

### 偏好設定（已存在，保持相容性）

```javascript
preferences: {
  type: mongoose.Schema.Types.Mixed,
  default: {},
  // 可包含各種個人化設定
}
```

## API 文件

所有新增的 API 都已在 Swagger 文件中完整記錄，包括：

- 請求參數說明
- 回應格式
- 錯誤狀態碼
- 安全要求

## 測試

提供了完整的測試檔案 `test/user-api-test.js`，包含：

- 密碼變更測試
- 電子信箱變更測試
- 社群帳號解除綁定測試
- 用戶資料取得測試

## 安全性考量

1. **密碼安全：**
   - 使用 bcrypt 進行密碼加密
   - 密碼變更後強制重新登入
   - 密碼長度驗證

2. **電子信箱安全：**
   - 格式驗證
   - 重複性檢查
   - 變更後重置驗證狀態

3. **社群帳號安全：**
   - 防止解除主要登入方式
   - 支援的社群平台限制

4. **資料庫安全：**
   - 所有操作使用資料庫事務
   - 原子性操作確保資料一致性

## 使用範例

### 密碼變更

```javascript
const response = await fetch('/api/users/change-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  },
  body: JSON.stringify({
    currentPassword: 'oldpassword',
    newPassword: 'newpassword123',
  }),
})
```

### 電子信箱變更

```javascript
const response = await fetch('/api/users/change-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  },
  body: JSON.stringify({
    newEmail: 'newemail@example.com',
    currentPassword: 'password',
  }),
})
```

### 解除社群帳號綁定

```javascript
const response = await fetch('/api/users/unbind/google', {
  method: 'DELETE',
  headers: {
    Authorization: 'Bearer ' + token,
  },
})
```

## 相容性

- 所有新增功能都向後相容
- 現有的用戶資料不會受到影響
- 新增的欄位都有預設值
- API 回應格式保持一致性

## 部署注意事項

1. 確保 bcrypt 和 validator 套件已安裝
2. 資料庫遷移（如果需要）
3. 更新 API 文件
4. 測試所有新功能
