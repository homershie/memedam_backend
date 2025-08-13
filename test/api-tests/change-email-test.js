import fetch from 'node-fetch'

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api'

/**
 * 測試 change-email API 的自動發送驗證信功能
 */
async function testChangeEmailWithVerification() {
  console.log('\n🧪 測試 change-email API 的自動發送驗證信功能...')

  try {
    // 1. 首先登入獲取 token
    console.log('1. 登入獲取 token...')
    const loginResponse = await fetch(`${BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
      }),
    })

    if (!loginResponse.ok) {
      console.log('❌ 登入失敗，請確保測試用戶存在')
      return
    }

    const loginData = await loginResponse.json()
    const authToken = loginData.token

    console.log('✅ 登入成功')

    // 2. 測試變更電子信箱
    console.log('2. 測試變更電子信箱...')
    const changeEmailResponse = await fetch(`${BASE_URL}/users/change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        newEmail: 'newemail@example.com',
        currentPassword: 'testpassword123',
      }),
    })

    const changeEmailData = await changeEmailResponse.json()
    console.log('狀態碼:', changeEmailResponse.status)
    console.log('回應:', changeEmailData)

    if (changeEmailResponse.ok) {
      console.log('✅ 電子信箱變更成功')
      console.log('📧 驗證信發送狀態:', changeEmailData.emailSent ? '成功' : '失敗')
      console.log('💬 回應訊息:', changeEmailData.message)
    } else {
      console.log('❌ 電子信箱變更失敗')
      console.log('錯誤訊息:', changeEmailData.message)
    }

    // 3. 測試驗證信發送失敗的情況（使用無效的 email）
    console.log('\n3. 測試無效 email 的情況...')
    const invalidEmailResponse = await fetch(`${BASE_URL}/users/change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        newEmail: 'invalid-email',
        currentPassword: 'testpassword123',
      }),
    })

    const invalidEmailData = await invalidEmailResponse.json()
    console.log('無效 email 狀態碼:', invalidEmailResponse.status)
    console.log('無效 email 回應:', invalidEmailData.message)

    // 4. 測試密碼錯誤的情況
    console.log('\n4. 測試密碼錯誤的情況...')
    const wrongPasswordResponse = await fetch(`${BASE_URL}/users/change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        newEmail: 'another@example.com',
        currentPassword: 'wrongpassword',
      }),
    })

    const wrongPasswordData = await wrongPasswordResponse.json()
    console.log('密碼錯誤狀態碼:', wrongPasswordResponse.status)
    console.log('密碼錯誤回應:', wrongPasswordData.message)

    // 5. 測試相同 email 的情況
    console.log('\n5. 測試相同 email 的情況...')
    const sameEmailResponse = await fetch(`${BASE_URL}/users/change-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        newEmail: 'newemail@example.com', // 使用剛才變更的 email
        currentPassword: 'testpassword123',
      }),
    })

    const sameEmailData = await sameEmailResponse.json()
    console.log('相同 email 狀態碼:', sameEmailResponse.status)
    console.log('相同 email 回應:', sameEmailData.message)

    console.log('\n✅ change-email API 測試完成')
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error)
  }
}

// 執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  testChangeEmailWithVerification()
}

export default testChangeEmailWithVerification
