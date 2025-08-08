import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3000/api'

// 測試用的用戶資料
const testUser = {
  username: 'testuser123',
  email: 'test@example.com',
  password: 'password123',
}

let authToken = null
let userId = null

// 輔助函數：登入並取得 token
async function login() {
  try {
    const response = await fetch(`${BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      authToken = data.token
      console.log('✅ 登入成功')
      return true
    } else {
      console.log('❌ 登入失敗，可能需要先註冊用戶')
      return false
    }
  } catch (error) {
    console.error('登入錯誤:', error)
    return false
  }
}

// 測試密碼變更 API
async function testChangePassword() {
  console.log('\n🧪 測試密碼變更 API...')

  try {
    const response = await fetch(`${BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        currentPassword: testUser.password,
        newPassword: 'newpassword123',
      }),
    })

    const data = await response.json()
    console.log('狀態碼:', response.status)
    console.log('回應:', data)

    if (response.ok) {
      console.log('✅ 密碼變更成功')
      // 更新測試用的密碼
      testUser.password = 'newpassword123'
    } else {
      console.log('❌ 密碼變更失敗')
    }
  } catch (error) {
    console.error('密碼變更錯誤:', error)
  }
}

// 測試電子信箱變更 API
async function testChangeEmail() {
  console.log('\n🧪 測試電子信箱變更 API...')

  try {
    const response = await fetch(`${BASE_URL}/users/change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        newEmail: 'newemail@example.com',
        currentPassword: testUser.password,
      }),
    })

    const data = await response.json()
    console.log('狀態碼:', response.status)
    console.log('回應:', data)

    if (response.ok) {
      console.log('✅ 電子信箱變更成功')
    } else {
      console.log('❌ 電子信箱變更失敗')
    }
  } catch (error) {
    console.error('電子信箱變更錯誤:', error)
  }
}

// 測試社群帳號解除綁定 API
async function testUnbindSocialAccount() {
  console.log('\n🧪 測試社群帳號解除綁定 API...')

  try {
    const response = await fetch(`${BASE_URL}/users/unbind/google`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    const data = await response.json()
    console.log('狀態碼:', response.status)
    console.log('回應:', data)

    if (response.ok) {
      console.log('✅ 社群帳號解除綁定成功')
    } else {
      console.log('❌ 社群帳號解除綁定失敗')
    }
  } catch (error) {
    console.error('社群帳號解除綁定錯誤:', error)
  }
}

// 測試取得自己的資料 API
async function testGetMe() {
  console.log('\n🧪 測試取得自己的資料 API...')

  try {
    const response = await fetch(`${BASE_URL}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    const data = await response.json()
    console.log('狀態碼:', response.status)

    if (response.ok) {
      console.log('✅ 取得自己的資料成功')
      console.log('用戶資料:', {
        username: data.user.username,
        email: data.user.email,
        notificationSettings: data.user.notificationSettings,
        preferences: data.user.preferences,
      })
    } else {
      console.log('❌ 取得自己的資料失敗')
      console.log('回應:', data)
    }
  } catch (error) {
    console.error('取得自己的資料錯誤:', error)
  }
}

// 主測試函數
async function runTests() {
  console.log('🚀 開始測試用戶 API...')

  // 先嘗試登入
  const loginSuccess = await login()

  if (!loginSuccess) {
    console.log('❌ 無法登入，請確保測試用戶已存在')
    return
  }

  // 執行測試
  await testGetMe()
  await testChangePassword()
  await testChangeEmail()
  await testUnbindSocialAccount()

  console.log('\n✨ 測試完成！')
}

// 執行測試
runTests().catch(console.error)
