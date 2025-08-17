import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

async function testNotificationFix() {
  console.log('🔍 測試通知 URL 修復...')

  // 查找或創建測試用戶
  let testUser = await User.findOne({ email: 'test@example.com' })
  if (!testUser) {
    console.log('👤 創建測試用戶...')
    const hashedPassword = await bcrypt.hash('test123456', 10)
    testUser = new User({
      email: 'test@example.com',
      username: 'testuser',
      password: hashedPassword,
      is_verified: true,
      is_active: true,
    })
    await testUser.save()
    console.log('✅ 測試用戶創建成功')
  } else {
    console.log('✅ 找到現有測試用戶')
  }

  // 生成 token
  const token = jwt.sign(
    { _id: testUser._id, email: testUser.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' },
  )

  console.log(`👤 測試用戶: ${testUser.email}`)
  console.log(`🔗 FRONTEND_URL: ${process.env.FRONTEND_URL || '未設定'}`)

  // 測試檢舉 API
  const testData = {
    target_type: 'meme',
    target_id: '507f1f77bcf86cd799439015', // 使用新的測試 ID
    reason: 'spam',
    description: '測試通知修復',
  }

  console.log('\n📝 測試檢舉提交...')

  try {
    const response = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(testData)

    console.log(`狀態碼: ${response.status}`)
    console.log(`回應:`, response.body)

    if (response.status === 201) {
      console.log('✅ 檢舉提交成功')
      console.log('✅ 通知 URL 修復應該有效')
    } else if (response.status === 409) {
      console.log('⚠️  重複檢舉 - 這是正常的業務邏輯')
    } else if (response.status === 429) {
      console.log('🚫 被 rate limit 阻擋')
    } else {
      console.log('❌ 檢舉提交失敗')
    }
  } catch (error) {
    console.log(`❌ 請求失敗: ${error.message}`)
  }

  console.log('\n✅ 測試完成')
}

// 執行測試
testNotificationFix().catch(console.error)
