import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import jwt from 'jsonwebtoken'

async function simpleRateLimitTest() {
  console.log('🚀 開始簡單的 rate limit 測試...')

  // 查找測試用戶
  const testUser = await User.findOne({ email: 'test@example.com' })
  if (!testUser) {
    console.log('❌ 請先創建測試用戶: test@example.com')
    return
  }

  // 生成 token
  const token = jwt.sign(
    { _id: testUser._id, email: testUser.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' },
  )

  console.log(`👤 測試用戶: ${testUser.email}`)
  console.log(`🆔 用戶ID: ${testUser._id}`)

  // 測試檢舉 API
  const testData = {
    target_type: 'meme',
    target_id: '507f1f77bcf86cd799439011', // 示例 ID
    reason: 'spam',
    description: '測試檢舉',
  }

  console.log('\n📝 開始測試檢舉...')

  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- 第 ${i} 次檢舉 ---`)

    try {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(testData)

      console.log(`狀態碼: ${response.status}`)
      console.log(`回應:`, response.body)

      // 檢查 rate limit headers
      if (response.headers['ratelimit-remaining']) {
        console.log(`剩餘次數: ${response.headers['ratelimit-remaining']}`)
      }
      if (response.headers['ratelimit-limit']) {
        console.log(`總限制: ${response.headers['ratelimit-limit']}`)
      }

      if (response.status === 429) {
        console.log('🚫 被 rate limit 阻擋')
        break
      }

      // 等待 1 秒
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.log(`❌ 請求失敗: ${error.message}`)
    }
  }

  console.log('\n✅ 測試完成')
}

// 執行測試
simpleRateLimitTest().catch(console.error)
