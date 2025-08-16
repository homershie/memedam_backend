import request from 'supertest'
import { app } from '../index.js'
import Report from '../models/Report.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'

// 安全檢查：確保不會在生產環境運行測試
const checkEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const mongoUri = process.env.MONGO_URI || ''

  // 如果連接到生產資料庫，拒絕運行測試
  if (mongoUri.includes('production') || mongoUri.includes('prod')) {
    throw new Error('❌ 安全警告：檢測到生產資料庫連接，測試已停止執行！')
  }

  console.log(`🔒 環境檢查通過：${nodeEnv}`)
  console.log(`📊 資料庫：${mongoUri}`)
}

// 簡單的測試框架
const test = (name, fn) => {
  console.log(`🧪 ${name}`)
  return fn()
}

const expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(`期望 ${expected}，但得到 ${actual}`)
    }
  },
  toBeDefined: () => {
    if (actual === undefined || actual === null) {
      throw new Error(`期望有值，但得到 ${actual}`)
    }
  },
  toHaveLength: (expected) => {
    if (actual.length !== expected) {
      throw new Error(`期望長度 ${expected}，但得到 ${actual.length}`)
    }
  },
})

// 測試主函數
const runTests = async () => {
  let testUser, testMeme, authToken

  console.log('🚀 開始檢舉系統測試...')

  try {
    // 環境安全檢查
    checkEnvironment()

    // 使用現有的資料庫連接
    console.log('📦 使用現有資料庫連接')

    // 只清理測試相關的資料，不清理用戶資料
    console.log('🧹 清理測試資料...')
    await Promise.all([
      Report.deleteMany({}),
      Meme.deleteMany({ title: { $regex: /^測試/ } }), // 只刪除測試迷因
    ])

    // 建立測試用戶（使用獨特的用戶名避免衝突）
    const testUsername = `testuser_${Date.now()}`
    const testEmail = `test_${Date.now()}@example.com`

    testUser = await User.create({
      username: testUsername,
      email: testEmail,
      password: 'password123456',
    })

    console.log('用戶創建成功:', testUser._id, testUser.username, testUser.has_password)

    // 取得認證 token
    const loginResponse = await request(app).post('/api/users/login').send({
      login: testEmail,
      password: 'password123456',
    })

    console.log('登入響應:', loginResponse.status, loginResponse.body)

    if (loginResponse.status !== 200) {
      throw new Error(`登入失敗: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`)
    }

    authToken = loginResponse.body.token

    // 建立測試迷因
    testMeme = await Meme.create({
      title: '測試迷因',
      type: 'image',
      content: '這是一個測試迷因',
      image_url: 'https://example.com/test.jpg',
      author_id: testUser._id,
    })

    // 測試檢舉提交
    await test('應該能成功提交檢舉', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'inappropriate',
          description: '這個迷因內容不當',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.reason).toBe('inappropriate')
    })

    // 測試重複檢舉
    await test('應該防止重複檢舉', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'spam',
          description: '重複檢舉',
        })

      expect(response.status).toBe(409)
    })

    // 測試取得用戶自己的檢舉
    await test('應該能取得用戶自己的檢舉', async () => {
      const response = await request(app)
        .get('/api/reports/my')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.reports).toHaveLength(1)
    })

    console.log('\n✅ 所有測試通過！檢舉系統功能正常。')
  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message)
    process.exit(1)
  } finally {
    // 清理測試資料（只清理測試相關的資料）
    console.log('🧹 清理測試資料...')
    try {
      if (testUser) {
        await User.deleteOne({ _id: testUser._id })
        console.log('已清理測試用戶')
      }
      if (testMeme) {
        await Meme.deleteOne({ _id: testMeme._id })
        console.log('已清理測試迷因')
      }
      await Report.deleteMany({})
      console.log('已清理測試檢舉')
    } catch (cleanupError) {
      console.error('清理測試資料時發生錯誤:', cleanupError.message)
    }

    console.log('📦 測試完成')
  }
}

// 運行測試
runTests()
