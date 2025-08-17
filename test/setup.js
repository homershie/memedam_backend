import { beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

// 載入環境變數
dotenv.config({ path: '.env.test' })

// 測試環境旗標，阻止應用自動啟動與重度背景任務
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.SKIP_SERVER = process.env.SKIP_SERVER || 'true'
process.env.SKIP_REDIS = process.env.SKIP_REDIS || 'true'
process.env.SKIP_METRICS = process.env.SKIP_METRICS || 'true'

// 全局測試設置
beforeAll(async () => {
  // 連接測試資料庫
  const testMongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/memedam_test'

  try {
    await mongoose.connect(testMongoUri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
    })
    console.log('✅ 測試資料庫連接成功')
  } catch (error) {
    console.error('❌ 測試資料庫連接失敗:', error.message)
    throw error
  }
})

// 全局測試清理
afterAll(async () => {
  try {
    await mongoose.disconnect()
    console.log('✅ 測試資料庫連接已關閉')
  } catch (error) {
    console.error('❌ 關閉測試資料庫連接失敗:', error.message)
  }
})

// 全局測試工具函數
export const createTestUser = async (User, userData = {}) => {
  const defaultData = {
    // username 8-20 字元的限制，使用 timestamp 取前 10 位確保長度
    username: `test_${Date.now().toString().slice(-10)}`,
    email: `test_${Date.now()}@example.com`,
    password: 'testpassword123',
    role: 'user',
    status: 'active',
    is_verified: true,
    ...userData,
  }

  return await User.create(defaultData)
}

export const createTestMeme = async (Meme, authorId, memeData = {}) => {
  const defaultData = {
    title: `test_${Date.now()}`,
    type: 'image',
    content: 'test content',
    image_url: 'https://example.com/test.jpg',
    author_id: authorId,
    status: 'public',
    like_count: 0,
    dislike_count: 0,
    comment_count: 0,
    view_count: 0,
    ...memeData,
  }

  return await Meme.create(defaultData)
}

export const cleanupTestData = async (models) => {
  for (const [modelName, model] of Object.entries(models)) {
    try {
      // 清理測試數據（根據命名規則）
      await model.deleteMany({
        $or: [
          { username: { $regex: /^testuser_/ } },
          { email: { $regex: /^test_/ } },
          { title: { $regex: /^測試迷因 / } },
        ],
      })
      console.log(`✅ ${modelName} 測試數據清理完成`)
    } catch (error) {
      console.error(`❌ ${modelName} 測試數據清理失敗:`, error.message)
    }
  }
}
