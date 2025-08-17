import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import jwt from 'jsonwebtoken'

async function diagnoseRateLimit() {
  console.log('🔍 開始診斷 rate limit 問題...')

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
  console.log(`🔑 Token: ${token.substring(0, 20)}...`)

  // 測試不同的檢舉目標
  const testTargets = [
    {
      target_type: 'meme',
      target_id: '507f1f77bcf86cd799439011',
      reason: 'spam',
      description: '測試檢舉 1',
    },
    {
      target_type: 'meme',
      target_id: '507f1f77bcf86cd799439012',
      reason: 'inappropriate',
      description: '測試檢舉 2',
    },
    {
      target_type: 'meme',
      target_id: '507f1f77bcf86cd799439013',
      reason: 'copyright',
      description: '測試檢舉 3',
    },
  ]

  console.log('\n📝 開始測試不同目標的檢舉...')

  for (let i = 0; i < testTargets.length; i++) {
    const target = testTargets[i]
    console.log(`\n--- 第 ${i + 1} 次檢舉 (目標: ${target.target_id}) ---`)

    try {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(target)

      console.log(`狀態碼: ${response.status}`)
      console.log(`回應:`, response.body)

      // 檢查 rate limit headers
      console.log('📊 Rate Limit Headers:')
      console.log(`  - ratelimit-limit: ${response.headers['ratelimit-limit']}`)
      console.log(`  - ratelimit-remaining: ${response.headers['ratelimit-remaining']}`)
      console.log(`  - ratelimit-reset: ${response.headers['ratelimit-reset']}`)
      console.log(`  - ratelimit-used: ${response.headers['ratelimit-used']}`)

      if (response.status === 429) {
        console.log('🚫 被 rate limit 阻擋')
        console.log('💡 這表示 rate limit 正在工作，但可能限制太嚴格')
        break
      }

      if (response.status === 409) {
        console.log('⚠️  重複檢舉錯誤 - 這表示目標可能已經被檢舉過')
      }

      if (response.status === 201) {
        console.log('✅ 檢舉成功')
      }

      // 等待 2 秒
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.log(`❌ 請求失敗: ${error.message}`)
    }
  }

  // 測試重複檢舉同一個目標
  console.log('\n🔄 測試重複檢舉同一個目標...')

  const duplicateTarget = {
    target_type: 'meme',
    target_id: '507f1f77bcf86cd799439014',
    reason: 'spam',
    description: '重複檢舉測試',
  }

  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- 重複檢舉第 ${i} 次 ---`)

    try {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send(duplicateTarget)

      console.log(`狀態碼: ${response.status}`)
      console.log(`回應:`, response.body)

      if (response.status === 409) {
        console.log('✅ 正確地阻止了重複檢舉')
        break
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

  console.log('\n✅ 診斷完成')
}

// 執行診斷
diagnoseRateLimit().catch(console.error)
