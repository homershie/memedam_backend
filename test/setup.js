import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { MongoMemoryServer } from 'mongodb-memory-server'

// 先 mock 掉會在載入時檢查雲端設定的模組，避免測試環境因未設 CLOUDINARY_* 失敗
vi.mock('../config/cloudinary.js', () => ({ default: {} }))

// 載入環境變數
dotenv.config({ path: '.env.test' })

// 測試環境配置（僅保留安全檢查）
const TEST_CONFIG = {
  safety: {
    preventProduction: true,
    productionKeywords: ['production', 'prod', 'live'],
    testUserPattern: /^test_/,
    testEmailPattern: /^test_.*@example\.com$/,
  },
}

// 環境安全檢查
const checkTestEnvironment = () => {
  const { safety } = TEST_CONFIG

  if (safety.preventProduction) {
    const mongoUri = process.env.MONGODB_URI || ''
    const nodeEnv = process.env.NODE_ENV || 'development'

    // 檢查是否為生產環境
    const isProduction = safety.productionKeywords.some(
      (keyword) =>
        mongoUri.toLowerCase().includes(keyword) || nodeEnv.toLowerCase().includes(keyword),
    )

    if (isProduction) {
      throw new Error(`
❌ 安全警告：檢測到生產環境！
- 資料庫連接：${mongoUri}
- 環境變數：${nodeEnv}
- 為保護生產資料，測試已停止執行

請設置 MONGODB_TEST_URI 環境變數指向測試資料庫。
      `)
    }
  }

  console.log('🔒 測試環境檢查通過')
  console.log(`🌍 環境：${process.env.NODE_ENV || 'development'}`)
}

// 執行環境檢查
checkTestEnvironment()

// 測試環境旗標，阻止應用自動啟動與重度背景任務
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.SKIP_SERVER = process.env.SKIP_SERVER || 'true'
process.env.REDIS_ENABLED = 'true'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.REDIS_DB = '1'
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret'
process.env.SKIP_REDIS = 'true'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

// 全域 mock 郵件，避免外部 I/O
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}))

let mongo

// 全局測試設置：啟動記憶體 MongoDB 並連線
beforeAll(async () => {
  try {
    mongo = await MongoMemoryServer.create()
    const uri = mongo.getUri()
    await mongoose.connect(uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
    })
    console.log('✅ 記憶體 MongoDB 已啟動並連線成功')

    // 在單節點 memory server 下，禁用 Mongoose transaction sessions，避免 500
    try {
      const UserModule = await import('../models/User.js')
      const fakeSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      }
      if (UserModule?.default?.startSession) {
        vi.spyOn(UserModule.default, 'startSession').mockResolvedValue(fakeSession)
      }
      // 注意：Meme.startSession 會在測試文件中通過 vi.mock 處理
      // 也防禦性覆寫 mongoose.startSession
      if (typeof mongoose.startSession === 'function') {
        vi.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession)
      }
    } catch (e) {
      console.warn('跳過 startSession stub 設定:', e?.message)
    }
  } catch (error) {
    console.error('❌ 記憶體 MongoDB 連線失敗:', error.message)
    throw error
  }
})

// 每次測試後清理：還原所有 mock 並清空資料庫
afterEach(async () => {
  vi.restoreAllMocks()
  // 保留資料以維持同一測試檔內的登入/授權流程穩定
  // 若個別測試需要清庫，請在該測試中自行清理
})

// 全局測試清理：關閉連線並停止記憶體 MongoDB
afterAll(async () => {
  try {
    await mongoose.disconnect()
    if (mongo) await mongo.stop()
    console.log('✅ 測試資料庫連接已關閉並釋放資源')
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
    email_verified: true,
    ...userData,
  }

  // 創建用戶實例，確保中間件正確執行
  const user = new User(defaultData)
  await user.save()
  return user
}

// 檢查是否為測試資料
//（移除未使用的測試工具：isTestData / generateTestUserData / safeCleanup）

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
