# Feedback 信箱驗證修復

## 問題描述

在使用者提交意見時，如果使用者沒有驗證過的信箱或沒有信箱，會發生 500 錯誤。這是因為：

1. **Feedback model** 要求 `email` 欄位是必填的
2. **feedbackController** 在建立 Feedback 時使用 `req.user.email` 作為 email 值
3. 當使用者沒有驗證過的信箱或沒有信箱時，`req.user.email` 可能是 `undefined` 或空值
4. 這導致 Feedback model 驗證失敗，進而產生 500 錯誤

## 解決方案

### 後端修改 (feedbackController.js)

在 `submitFeedback` 函數中加入了信箱驗證檢查：

```javascript
// 驗證使用者是否有信箱且已驗證
if (!req.user.email) {
  return res.status(400).json({
    success: false,
    message: '您需要先設定並驗證信箱才能提交意見',
  })
}

if (!req.user.email_verified) {
  return res.status(400).json({
    success: false,
    message: '請先驗證您的信箱才能提交意見',
  })
}
```

### 前端修改 (feedback.vue)

1. **錯誤處理增強**：在 `submitFeedback` 函數中加入了對新錯誤訊息的處理：

```javascript
} else if (error.message.includes('請先驗證您的信箱')) {
  errors.general = '請先驗證您的信箱才能提交意見。請前往設定頁面驗證信箱。'
} else if (error.message.includes('您需要先設定並驗證信箱')) {
  errors.general = '您需要先設定並驗證信箱才能提交意見。請前往設定頁面設定信箱。'
}
```

2. **信箱驗證提示**：在頁面頂部加入了信箱驗證狀態的提示：

```vue
<!-- 信箱驗證提示 -->
<div
  v-if="!userStore.user?.email_verified"
  class="bg-yellow-50 border border-yellow-200 text-yellow-700! dark:bg-yellow-900 dark:border-yellow-800 dark:text-yellow-200! rounded-md p-3 mt-4"
>
  <div class="flex items-start">
    <div class="flex-shrink-0">
      <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
    </div>
    <div class="ml-3">
      <p class="text-sm">
        <strong>信箱驗證提醒：</strong>
        提交意見前需要先驗證您的信箱。請前往
        <router-link to="/settings" class="text-yellow-800 dark:text-yellow-200 underline hover:text-yellow-900 dark:hover:text-yellow-100">
          設定頁面
        </router-link>
        驗證信箱。
      </p>
    </div>
  </div>
</div>
```

3. **引入 userStore**：加入了 `useUserStore` 來檢查使用者信箱驗證狀態。

## 測試

建立了 `feedbackController.test.js` 測試檔案，測試以下場景：

- ✅ 拒絕提交當使用者沒有信箱
- ✅ 拒絕提交當使用者信箱未驗證
- ✅ 拒絕提交當使用者未登入

## 影響範圍

- **後端**：`controllers/feedbackController.js`
- **前端**：`pages/feedback.vue`
- **測試**：`test/unit/controllers/feedbackController.test.js`

## 使用者體驗改善

1. **預防性提示**：在頁面載入時就顯示信箱驗證提醒
2. **明確錯誤訊息**：提供具體的錯誤訊息和解決方案
3. **引導性連結**：直接連結到設定頁面方便使用者操作
4. **避免 500 錯誤**：提前驗證避免後端錯誤

## 相關檔案

- `memedam_backend/controllers/feedbackController.js`
- `memedam/src/pages/feedback.vue`
- `memedam_backend/test/unit/controllers/feedbackController.test.js`
- `memedam_backend/models/Feedback.js`
- `memedam_backend/models/User.js`
