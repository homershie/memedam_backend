# 註冊完成頁面範例

## 概述

當用戶註冊成功後，前端應該顯示一個註冊完成頁面，告知用戶需要驗證 email。

## 頁面結構

### 1. 註冊成功頁面 (RegistrationSuccess.jsx)

```jsx
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const RegistrationSuccess = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [isResending, setIsResending] = useState(false)

  // 從註冊頁面傳遞過來的用戶資料
  const { user, emailSent } = location.state || {}

  const handleResendEmail = async () => {
    if (!user?.email) return

    setIsResending(true)
    try {
      const response = await fetch('/api/verification/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email }),
      })

      const data = await response.json()

      if (data.success) {
        alert('驗證信已重新發送！')
      } else {
        alert(data.message || '發送失敗，請稍後再試')
      }
    } catch (error) {
      alert('發送失敗，請稍後再試')
    } finally {
      setIsResending(false)
    }
  }

  const handleGoToLogin = () => {
    navigate('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">註冊成功</h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900">註冊完成！</h3>
              <p className="mt-2 text-sm text-gray-600">請檢查您的信箱並點擊驗證連結來完成註冊。</p>
              <div className="mt-6">
                <button
                  onClick={handleGoToLogin}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  前往登入
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">註冊成功！</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {/* 成功圖示 */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h3 className="mt-4 text-lg font-medium text-gray-900">歡迎加入 MemeDam！</h3>

            <p className="mt-2 text-sm text-gray-600">
              您的帳號 <strong>{user.username}</strong> 已成功創建。
            </p>

            {/* Email 驗證狀態 */}
            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">請驗證您的 Email</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      我們已向 <strong>{user.email}</strong> 發送驗證信。
                    </p>
                    <p className="mt-1">請檢查您的信箱並點擊驗證連結來完成註冊。</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isResending ? '發送中...' : '重新發送驗證信'}
              </button>

              <button
                onClick={handleGoToLogin}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                前往登入
              </button>
            </div>

            {/* 注意事項 */}
            <div className="mt-6 text-xs text-gray-500">
              <p>• 驗證信可能會被歸類到垃圾郵件資料夾</p>
              <p>• 驗證連結將在 24 小時後失效</p>
              <p>• 如果沒有收到驗證信，請檢查垃圾郵件資料夾</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegistrationSuccess
```

### 2. 註冊頁面修改 (Registration.jsx)

```jsx
// 在註冊成功後的處理
const handleRegistrationSuccess = (response) => {
  if (response.success) {
    // 導向註冊成功頁面，並傳遞用戶資料
    navigate('/registration-success', {
      state: {
        user: response.user,
        emailSent: response.emailSent,
      },
    })
  }
}
```

### 3. 路由設定

```jsx
// App.jsx 或路由設定檔案
import RegistrationSuccess from './pages/RegistrationSuccess'

// 在路由配置中加入
;<Route path="/registration-success" element={<RegistrationSuccess />} />
```

## API 回應格式

註冊 API (`POST /api/users`) 現在會回傳：

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

## 驗證流程

1. 用戶註冊成功
2. 後端自動發送驗證信
3. 前端顯示註冊成功頁面
4. 用戶點擊 email 中的驗證連結
5. 前端處理驗證並更新用戶狀態

## 注意事項

- 確保前端路由正確設定
- 處理 email 發送失敗的情況
- 提供重新發送驗證信的功能
- 考慮不同 email 服務商的垃圾郵件過濾
- 提供清晰的用戶指引
