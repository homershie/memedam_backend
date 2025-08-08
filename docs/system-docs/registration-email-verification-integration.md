# 註冊時 Email 驗證整合

## 概述

根據您的需求，我們已經完成了註冊時自動發送驗證信的功能整合。現在當用戶註冊時，系統會：

1. 創建用戶帳號
2. 自動發送驗證信
3. 回傳適當的訊息給前端
4. 前端顯示註冊完成頁面

## 後端修改

### 1. 修改 `createUser` 函數

**檔案：** `controllers/userController.js`

**修改內容：**

- 在用戶創建成功後自動產生驗證 token
- 發送驗證 email
- 回傳包含驗證提示的訊息

**主要變更：**

```javascript
// 產生驗證 token 並發送驗證 email
let verificationToken = null
try {
  verificationToken = await VerificationController.generateVerificationToken(
    createdUser._id,
    'email_verification',
    24, // 24 小時過期
  )

  // 發送驗證 email
  await EmailService.sendVerificationEmail(
    createdUser.email,
    verificationToken,
    createdUser.username,
  )
} catch (emailError) {
  logger.error('發送驗證 email 失敗:', emailError)
  // 即使 email 發送失敗，仍然創建用戶，但記錄錯誤
}

// 回傳成功訊息，包含 email 驗證提示
res.status(StatusCodes.CREATED).json({
  success: true,
  user: userObj,
  message: '註冊成功！請檢查您的信箱並點擊驗證連結來完成註冊。',
  emailSent: !!verificationToken,
})
```

### 2. 現有的驗證系統

系統已經具備完整的 email 驗證功能：

- **VerificationToken 模型：** 管理驗證 token
- **VerificationController：** 處理驗證邏輯
- **EmailService：** 發送驗證信
- **驗證路由：** `/api/verification/send`, `/api/verification/verify`, `/api/verification/resend`

## 前端建議

### 1. 註冊完成頁面

建議創建一個註冊成功頁面，包含：

- 成功訊息和用戶資訊
- Email 驗證提示
- 重新發送驗證信功能
- 前往登入頁面的按鈕

### 2. API 回應處理

註冊 API 現在會回傳：

```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "username": "testuser",
    "email": "test@example.com",
    "email_verified": false,
    "display_name": "測試用戶",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "註冊成功！請檢查您的信箱並點擊驗證連結來完成註冊。",
  "emailSent": true
}
```

### 3. 前端路由建議

```jsx
// 註冊成功後導向
navigate('/registration-success', {
  state: {
    user: response.user,
    emailSent: response.emailSent,
  },
})
```

## 驗證流程

1. **用戶註冊：** 填寫註冊表單並提交
2. **後端處理：** 創建用戶並發送驗證信
3. **前端回應：** 顯示註冊成功頁面
4. **用戶驗證：** 點擊 email 中的驗證連結
5. **驗證完成：** 用戶狀態更新為已驗證

## 安全特性

- ✅ **Token 單次使用：** 驗證後立即失效
- ✅ **24 小時過期：** 自動清理過期 token
- ✅ **防重複發送：** 限制驗證信發送頻率
- ✅ **錯誤處理：** 即使 email 發送失敗仍創建用戶
- ✅ **事務安全：** 使用 MongoDB session 確保資料一致性

## 測試

已創建測試檔案：`test/verification-tests/registration-email-test.js`

測試內容：

- 註冊時自動發送驗證信
- Email 發送失敗的處理
- 重複註冊的錯誤處理

## 環境設定

確保以下環境變數已設定：

```env
# SendGrid 設定
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
SENDGRID_FROM_NAME=MemeDam

# 前端 URL (用於 email 中的連結)
FRONTEND_URL=http://localhost:3000
```

## 注意事項

1. **Email 服務：** 確保 SendGrid 或其他 email 服務已正確設定
2. **垃圾郵件：** 驗證信可能被歸類到垃圾郵件資料夾
3. **前端路由：** 確保註冊成功頁面路由已設定
4. **錯誤處理：** 前端應處理 email 發送失敗的情況
5. **用戶體驗：** 提供重新發送驗證信的功能

## 下一步

1. 前端實作註冊完成頁面
2. 測試完整的註冊和驗證流程
3. 監控 email 發送成功率
4. 根據用戶反饋優化用戶體驗
