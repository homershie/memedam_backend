# has_password 功能實作總結

## 概述

為了解決前端需要判斷使用者是否已經設定密碼的需求，我們在 User 模型中新增了 `has_password` 欄位，並建立了專用的 API 端點讓前端可以查詢密碼狀態。

## 實作內容

### 1. 資料庫模型更新

#### User 模型新增欄位

- 在 `models/User.js` 中新增 `has_password` 布林值欄位
- 預設值為 `false`
- 包含驗證器確保值為布林類型

```javascript
has_password: {
  type: Boolean,
  default: false,
  validate: {
    validator(value) {
      return typeof value === 'boolean'
    },
    message: 'has_password 必須是布林值',
  },
}
```

#### 自動更新機制

- 在 User 模型的 pre-save hook 中自動管理 `has_password` 欄位
- 當用戶設定或變更密碼時，自動設為 `true`
- 社群登入用戶預設為 `false`

### 2. API 端點

#### 新增路由

- 路徑：`GET /api/users/password-status`
- 需要 JWT token 驗證
- 需要用戶權限 (`isUser` middleware)

#### 控制器函數

- 函數名稱：`checkPasswordStatus`
- 位置：`controllers/userController.js`
- 功能：檢查當前登入用戶的密碼狀態

### 3. 資料庫遷移

#### 遷移腳本

- 檔案：`utils/updateHasPassword.js`
- 功能：更新現有用戶的 `has_password` 欄位
- 自動識別有密碼和無密碼的用戶

#### 執行結果

- 成功更新了 9 個現有用戶的 `has_password` 欄位
- 有密碼的用戶設為 `true`
- 社群登入用戶設為 `false`

### 4. 測試

#### 測試腳本

- 功能測試：`test/user-cleanup-tests/has-password-test.js`
- API 測試：`test/user-cleanup-tests/test-password-status-api.js`
- 資料庫遷移測試：`utils/updateHasPassword.js`

## API 使用方式

### 請求格式

```http
GET /api/users/password-status
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### 回應格式

```json
{
  "success": true,
  "hasPassword": true,
  "message": "成功獲取密碼狀態"
}
```

### 前端整合範例

```javascript
const checkPasswordStatus = async () => {
  try {
    const response = await fetch('/api/users/password-status', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (data.success) {
      if (data.hasPassword) {
        // 用戶已設定密碼，顯示變更密碼選項
        showChangePasswordOption()
      } else {
        // 用戶未設定密碼，顯示設定密碼選項
        showSetPasswordOption()
      }
    }
  } catch (error) {
    console.error('檢查密碼狀態失敗:', error)
  }
}
```

## 使用場景

### 1. 社群登入用戶

- 通常沒有設定密碼
- `hasPassword` 回傳 `false`
- 前端可以顯示「設定密碼」選項

### 2. 本地註冊用戶

- 通常有設定密碼
- `hasPassword` 回傳 `true`
- 前端可以顯示「變更密碼」選項

### 3. 混合登入用戶

- 社群登入後設定密碼的用戶
- `hasPassword` 回傳 `true`
- 前端可以顯示完整的密碼管理功能

## 安全性考量

1. **權限控制**：只有已登入的用戶可以檢查自己的密碼狀態
2. **資料保護**：API 不會回傳實際密碼，只回傳布林值狀態
3. **Token 驗證**：需要有效的 JWT token 才能存取

## 錯誤處理

- 401: 未授權（無效或過期的 token）
- 404: 找不到使用者
- 500: 伺服器內部錯誤

## 相關檔案

### 修改的檔案

- `models/User.js` - 新增 has_password 欄位和自動更新邏輯
- `controllers/userController.js` - 新增 checkPasswordStatus 函數
- `routes/userRoutes.js` - 新增 /password-status 路由

### 新增的檔案

- `utils/updateHasPassword.js` - 資料庫遷移腳本
- `test/user-cleanup-tests/has-password-test.js` - 功能測試
- `test/user-cleanup-tests/test-password-status-api.js` - API 測試
- `docs/api-docs/password-status-api.md` - API 文檔
- `docs/user-docs/has-password-feature-implementation.md` - 實作總結

## 部署注意事項

1. **資料庫遷移**：部署前需要執行 `node utils/updateHasPassword.js` 來更新現有用戶資料
2. **環境變數**：確保 `MONGO_URI` 環境變數正確設定
3. **測試**：建議在測試環境中先驗證功能正常運作

## 未來擴展

1. **密碼強度檢查**：可以根據 `has_password` 狀態提供不同的密碼強度要求
2. **安全提醒**：對於沒有密碼的社群用戶，可以定期提醒設定密碼
3. **登入方式限制**：根據密碼狀態限制某些敏感操作的登入方式
