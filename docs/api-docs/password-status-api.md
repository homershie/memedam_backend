# 密碼狀態 API 文檔

## 概述

密碼狀態 API 允許前端檢查使用者是否已經設定密碼，以便根據不同情況提供不同的功能選項。

## API 端點

### GET /api/users/password-status

檢查當前登入使用者是否已設定密碼。

#### 請求標頭
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### 請求參數
無

#### 回應格式

**成功回應 (200)**
```json
{
  "success": true,
  "hasPassword": true,
  "message": "成功獲取密碼狀態"
}
```

**錯誤回應 (401)**
```json
{
  "success": false,
  "message": "未授權"
}
```

**錯誤回應 (404)**
```json
{
  "success": false,
  "message": "找不到使用者"
}
```

**錯誤回應 (500)**
```json
{
  "success": false,
  "message": "伺服器錯誤"
}
```

## 使用場景

### 1. 社群登入用戶
- 社群登入用戶（Google、Facebook、Discord、Twitter）通常沒有設定密碼
- `hasPassword` 會回傳 `false`
- 前端可以顯示「設定密碼」選項，讓用戶可以為帳號增加額外的安全性

### 2. 本地註冊用戶
- 透過電子郵件註冊的用戶通常有設定密碼
- `hasPassword` 會回傳 `true`
- 前端可以顯示「變更密碼」選項

### 3. 混合登入用戶
- 社群登入用戶後來設定密碼的情況
- `hasPassword` 會回傳 `true`
- 前端可以顯示完整的密碼管理功能

## 前端整合範例

```javascript
// 檢查用戶密碼狀態
const checkPasswordStatus = async () => {
  try {
    const response = await fetch('/api/users/password-status', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (data.hasPassword) {
        // 用戶已設定密碼，顯示變更密碼選項
        showChangePasswordOption();
      } else {
        // 用戶未設定密碼，顯示設定密碼選項
        showSetPasswordOption();
      }
    }
  } catch (error) {
    console.error('檢查密碼狀態失敗:', error);
  }
};
```

## 資料庫欄位

### User 模型新增欄位

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

### 自動更新機制

- 當用戶設定或變更密碼時，`has_password` 會自動設為 `true`
- 社群登入用戶預設為 `false`
- 透過 User 模型的 pre-save hook 自動管理

## 安全性考量

1. **權限控制**: 只有已登入的用戶可以檢查自己的密碼狀態
2. **資料保護**: API 不會回傳實際密碼，只回傳布林值狀態
3. **Token 驗證**: 需要有效的 JWT token 才能存取

## 錯誤處理

- 401: 未授權（無效或過期的 token）
- 404: 找不到使用者
- 500: 伺服器內部錯誤

## 相關 API

- `POST /api/users/change-password`: 變更密碼
- `POST /api/users/bind/{provider}`: 綁定社群帳號
- `DELETE /api/users/unbind/{provider}`: 解除社群帳號綁定
