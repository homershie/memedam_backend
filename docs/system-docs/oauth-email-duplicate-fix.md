# OAuth Email 重複問題修復

## 問題描述

當用戶使用 Discord OAuth 登入時，如果該 email 已經被其他用戶使用（例如通過本地註冊或其他 OAuth 提供商），會出現以下錯誤：

```json
{
  "success": false,
  "error": "email 已存在",
  "details": "重複的 email: homershie@gmail.com",
  "suggestion": "請使用不同的值或檢查是否已存在相同資料"
}
```

## 問題原因

在 OAuth 策略中，當創建新用戶時，程式碼只檢查了 OAuth ID 是否已存在，但沒有檢查 email 是否已被其他用戶使用。這導致了 MongoDB 的唯一性約束錯誤。

## 修復方案

### 修改的檔案

- `config/passport.js`

### 修復邏輯

在所有 OAuth 策略（Google、Facebook、Discord、Twitter）中，在創建新用戶之前，先檢查 email 是否已被其他用戶使用：

1. **檢查 OAuth ID 是否存在**
2. **如果 OAuth ID 不存在，檢查 email 是否已被使用**
3. **如果 email 已存在，將 OAuth ID 綁定到現有用戶**
4. **如果 email 不存在，創建新用戶**

### 修復前後的程式碼對比

#### 修復前（Discord 策略）

```javascript
let user = await User.findOne({ discord_id: profile.id })
if (!user) {
  // 直接創建新用戶，可能導致 email 重複錯誤
  user = new User({
    username: finalUsername,
    email: profile.email || '',
    discord_id: profile.id,
    // ...
  })
  await user.save()
}
```

#### 修復後（Discord 策略）

```javascript
let user = await User.findOne({ discord_id: profile.id })
if (!user) {
  // 檢查 email 是否已被其他用戶使用
  if (profile.email) {
    const existingUserWithEmail = await User.findOne({ email: profile.email })
    if (existingUserWithEmail) {
      // 如果 email 已存在，直接返回該用戶（允許綁定 Discord 帳號）
      existingUserWithEmail.discord_id = profile.id
      await existingUserWithEmail.save()
      return done(null, existingUserWithEmail)
    }
  }

  // 如果 email 不存在，創建新用戶
  user = new User({
    username: finalUsername,
    email: profile.email || '',
    discord_id: profile.id,
    // ...
  })
  await user.save()
}
```

## 修復的 OAuth 提供商

1. **Google OAuth** - 檢查 `profile.emails[0].value`
2. **Facebook OAuth** - 檢查 `profile.emails[0].value`
3. **Discord OAuth** - 檢查 `profile.email`
4. **Twitter OAuth** - 檢查 `profile.emails[0].value`

## 測試

創建了測試檔案 `test/oauth-tests/discord-email-fix-test.js` 來驗證修復是否有效。

### 測試步驟

1. 創建一個使用特定 email 的本地用戶
2. 模擬使用相同 email 的 Discord OAuth 登入
3. 驗證 Discord ID 是否成功綁定到現有用戶
4. 確認沒有出現 email 重複錯誤

## 預期效果

修復後，當用戶使用 Discord OAuth 登入時：

- 如果該 Discord 帳號已經綁定過，直接登入
- 如果該 email 已被其他用戶使用，將 Discord 帳號綁定到現有用戶
- 如果該 email 未被使用，創建新用戶

這樣可以避免 email 重複錯誤，並允許用戶將多個 OAuth 帳號綁定到同一個 email。

## 注意事項

1. 此修復會自動將 OAuth 帳號綁定到具有相同 email 的現有用戶
2. 用戶可以通過多個 OAuth 提供商登入同一個帳號
3. 建議在前端提供帳號綁定功能，讓用戶可以主動管理多個登入方式
