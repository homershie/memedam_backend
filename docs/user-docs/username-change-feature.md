# Username 變更功能

## 概述

本功能允許用戶變更自己的 username，並包含完整的驗證機制和時間限制。

## 功能特點

### 1. Username 驗證

- 檢查 username 格式（8-20字元，只允許英文字母、數字、點號、底線和連字號）
- 檢查是否已被其他用戶使用
- 檢查是否為系統保留的 username
- 支援即時驗證（前端可以在用戶輸入時檢查）

### 2. Username 變更

- 一個月只能變更一次
- 需要驗證目前密碼
- 記錄變更歷史（最近10次）
- 原子性操作（使用資料庫事務）

### 3. 安全特性

- 密碼驗證
- 時間限制
- 重複檢查
- 格式驗證

## API 端點

### 1. 驗證 Username

**端點：** `GET /api/users/validate-username/:username`

**功能：** 檢查指定的 username 是否可用

**請求範例：**

```bash
GET /api/users/validate-username/testuser123
```

**回應範例：**

```json
{
  "success": true,
  "available": true,
  "message": "此 username 可以使用"
}
```

**錯誤回應：**

```json
{
  "success": true,
  "available": false,
  "message": "此 username 已被使用"
}
```

### 2. 變更 Username

**端點：** `POST /api/users/change-username`

**功能：** 變更用戶的 username

**請求範例：**

```json
{
  "username": "newusername123",
  "currentPassword": "your_current_password"
}
```

**回應範例：**

```json
{
  "success": true,
  "message": "username 已成功變更",
  "user": {
    "_id": "user_id",
    "username": "newusername123",
    "username_changed_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**錯誤回應：**

```json
{
  "success": false,
  "message": "username 一個月只能變更一次，還需要等待 25 天才能再次變更"
}
```

## 資料庫結構

### 新增欄位

在 `User` 模型中新增了以下欄位：

```javascript
// Username 變更相關欄位
username_changed_at: {
  type: Date,
  default: null,
  validate: {
    validator(value) {
      if (!value) return true
      return value instanceof Date && !isNaN(value)
    },
    message: 'username變更時間必須是有效的日期',
  },
},
previous_usernames: [{
  username: {
    type: String,
    trim: true,
    validate: {
      validator(value) {
        return /^[a-zA-Z0-9._-]+$/.test(value)
      },
      message: '用戶名只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)',
    },
  },
  changed_at: {
    type: Date,
    default: Date.now,
    validate: {
      validator(value) {
        return value instanceof Date && !isNaN(value)
      },
      message: '變更時間必須是有效的日期',
    },
  },
}],
```

## 驗證規則

### Username 格式要求

- 長度：8-20個字元
- 字符：只允許英文字母、數字、點號(.)、底線(\_)和連字號(-)
- 不能包含空格或特殊控制字符

### 系統保留的 Username

以下 username 為系統保留，無法使用：

- admin
- administrator
- root
- system
- support
- help
- info
- test
- guest
- anonymous

### 時間限制

- 一個月只能變更一次 username
- 計算方式：從上次變更時間開始計算30天

## 錯誤處理

### 常見錯誤訊息

1. **格式錯誤**
   - `username 長度必須在 8 到 20 個字元之間`
   - `username 只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)`

2. **重複使用**
   - `此 username 已被其他使用者使用`

3. **保留字**
   - `此 username 為系統保留，無法使用`

4. **時間限制**
   - `username 一個月只能變更一次，還需要等待 X 天才能再次變更`

5. **密碼錯誤**
   - `目前密碼不正確`

## 使用範例

### 前端實作範例

```javascript
// 驗證 username
async function validateUsername(username) {
  try {
    const response = await fetch(`/api/users/validate-username/${username}`)
    const data = await response.json()

    if (data.success && data.available) {
      console.log('Username 可以使用')
      return true
    } else {
      console.log(data.message)
      return false
    }
  } catch (error) {
    console.error('驗證失敗:', error)
    return false
  }
}

// 變更 username
async function changeUsername(username, currentPassword) {
  try {
    const response = await fetch('/api/users/change-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username,
        currentPassword,
      }),
    })

    const data = await response.json()

    if (data.success) {
      console.log('Username 變更成功')
      return true
    } else {
      console.log(data.message)
      return false
    }
  } catch (error) {
    console.error('變更失敗:', error)
    return false
  }
}
```

## 注意事項

1. **@提及功能**：變更 username 後，之前的 @提及可能失效，需要更新相關的提及記錄
2. **快取清理**：變更 username 後，可能需要清理相關的快取資料
3. **日誌記錄**：所有 username 變更都會記錄在系統日誌中
4. **備份**：舊的 username 會保存在 `previous_usernames` 陣列中，最多保留10筆記錄

## 測試

可以使用以下測試檔案來驗證功能：

- `test/api-tests/username-test.js`

執行測試：

```bash
npm test username-test.js
```
