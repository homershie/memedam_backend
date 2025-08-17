import fetch from 'node-fetch'
import '../../config/loadEnv.js'

// 測試密碼狀態 API
const testPasswordStatusAPI = async () => {
  try {
    console.log('開始測試密碼狀態 API...')

    // 這裡需要一個有效的 JWT token，實際測試時需要先登入取得 token
    const token = process.env.TEST_JWT_TOKEN || 'your-test-token-here'

    if (token === 'your-test-token-here') {
      console.log('⚠️  請設定 TEST_JWT_TOKEN 環境變數來進行完整測試')
      console.log('或者手動測試以下 API 端點:')
      console.log('GET /api/users/password-status')
      console.log('Headers: Authorization: Bearer <your-jwt-token>')
      return
    }

    const response = await fetch('http://localhost:3000/api/users/password-status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    console.log('回應狀態:', response.status)
    console.log('回應資料:', JSON.stringify(data, null, 2))

    if (response.ok && data.success) {
      console.log('✅ API 測試成功')
      console.log(`用戶密碼狀態: ${data.hasPassword ? '已設定密碼' : '未設定密碼'}`)
    } else {
      console.log('❌ API 測試失敗')
    }
  } catch (error) {
    console.error('測試過程中發生錯誤:', error)
  }
}

// 執行測試
testPasswordStatusAPI()
