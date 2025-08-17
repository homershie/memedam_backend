import request from 'supertest'
import mongoose from 'mongoose'
import { app } from '../../index.js'
import User from '../../models/User.js'
import Meme from '../../models/Meme.js'
import {
  TEST_CONFIG,
  checkTestEnvironment,
  generateTestUserData,
  safeCleanup,
} from '../utils/test-config.js'
import '../../config/loadEnv.js'

// 測試用的管理員用戶
let adminToken

// 測試用的普通用戶
let testUser
let testToken

// 測試用的迷因
let testMeme

describe('Admin Routes 完整功能測試', () => {
  beforeAll(async () => {
    // 檢查測試環境
    checkTestEnvironment()

    // 連接測試資料庫
    const mongoUri = TEST_CONFIG.database.uri
    await mongoose.connect(mongoUri)
    console.log('✅ 已連接到測試資料庫')

    // 生成測試用戶資料
    const adminData = generateTestUserData()
    const userData = generateTestUserData()

    // 創建測試管理員用戶
    await User.create({
      username: `admin_${adminData.username}`,
      email: `admin_${adminData.email}`,
      password: adminData.password,
      role: 'admin',
      status: 'active',
      is_verified: true,
    })

    // 創建測試普通用戶
    testUser = await User.create({
      username: userData.username,
      email: userData.email,
      password: userData.password,
      role: 'user',
      status: 'active',
      is_verified: true,
    })

    // 創建測試迷因
    testMeme = await Meme.create({
      title: '測試迷因',
      author_id: testUser._id,
      status: 'active',
      like_count: 0,
      dislike_count: 0,
      comment_count: 0,
      view_count: 0,
    })

    // 獲取管理員 token
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: `admin_${adminData.email}`,
        password: adminData.password,
      })

    adminToken = adminLoginResponse.body.token
    console.log('✅ 管理員 token 已獲取')

    // 獲取普通用戶 token
    const userLoginResponse = await request(app).post('/api/auth/login').send({
      email: userData.email,
      password: userData.password,
    })

    testToken = userLoginResponse.body.token
    console.log('✅ 普通用戶 token 已獲取')
  })

  afterAll(async () => {
    // 安全清理測試數據
    await safeCleanup({
      User,
      Meme,
    })
    await mongoose.disconnect()
    console.log('✅ 已斷開測試資料庫連接')
  })

  describe('權限測試', () => {
    test('非管理員用戶無法訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
    })

    test('未認證用戶無法訪問管理員路由', async () => {
      const response = await request(app).get('/api/admin/count-statistics')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    test('管理員用戶可以訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('計數檢查功能', () => {
    test('檢查單一迷因計數', async () => {
      const response = await request(app)
        .post(`/api/admin/check-counts/${testMeme._id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.total).toBeDefined()
    })

    test('檢查所有迷因計數', async () => {
      const response = await request(app)
        .post('/api/admin/check-all-counts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchSize: 10 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.total).toBeDefined()
    })

    test('獲取計數統計', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memes).toBeDefined()
      expect(response.body.data.users).toBeDefined()
    })

    test('檢查所有用戶計數', async () => {
      const response = await request(app)
        .post('/api/admin/check-all-user-counts')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行完整數據檢查', async () => {
      const response = await request(app)
        .post('/api/admin/run-full-check')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('維護狀態功能', () => {
    test('獲取維護任務狀態', async () => {
      const response = await request(app)
        .get('/api/admin/maintenance-status')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('熱門分數功能', () => {
    test('批次更新熱門分數', async () => {
      const response = await request(app)
        .post('/api/admin/batch-update-hot-scores')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ limit: 10, force: false })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行定期熱門分數更新', async () => {
      const response = await request(app)
        .post('/api/admin/scheduled-hot-score-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUpdates: 10, force: false })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('獲取熱門分數統計', async () => {
      const response = await request(app)
        .get('/api/admin/hot-score-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('推薦系統功能', () => {
    test('更新所有推薦系統', async () => {
      const response = await request(app)
        .post('/api/admin/update-all-recommendation-systems')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('獲取推薦系統狀態', async () => {
      const response = await request(app)
        .get('/api/admin/recommendation-system-status')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('更新推薦系統配置', async () => {
      const response = await request(app)
        .put('/api/admin/recommendation-system-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          config: {
            contentBasedWeight: 0.7,
            collaborativeWeight: 0.3,
            updateInterval: 24,
          },
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('內容基礎推薦功能', () => {
    test('批次更新用戶偏好', async () => {
      const response = await request(app)
        .post('/api/admin/batch-update-user-preferences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUsers: 10, batchSize: 5 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行定期內容基礎更新', async () => {
      const response = await request(app)
        .post('/api/admin/scheduled-content-based-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUsers: 10, batchSize: 5 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('獲取內容基礎統計', async () => {
      const response = await request(app)
        .get('/api/admin/content-based-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('更新內容基礎配置', async () => {
      const response = await request(app)
        .put('/api/admin/content-based-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          config: {
            similarityThreshold: 0.4,
            maxRecommendations: 15,
            updateInterval: 24,
          },
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('協同過濾功能', () => {
    test('批次更新協同過濾', async () => {
      const response = await request(app)
        .post('/api/admin/batch-update-collaborative-filtering')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUsers: 10, maxMemes: 50 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行定期協同過濾更新', async () => {
      const response = await request(app)
        .post('/api/admin/scheduled-collaborative-filtering-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUsers: 10, maxMemes: 50, includeSocial: true })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('獲取協同過濾統計', async () => {
      const response = await request(app)
        .get('/api/admin/collaborative-filtering-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('更新協同過濾配置', async () => {
      const response = await request(app)
        .put('/api/admin/collaborative-filtering-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          config: {
            minCommonItems: 5,
            maxNeighbors: 25,
            updateInterval: 24,
          },
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('通知管理功能', () => {
    test('發送熱門內容通知', async () => {
      const response = await request(app)
        .post('/api/admin/notifications/hot-content')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('發送週報摘要通知', async () => {
      const response = await request(app)
        .post('/api/admin/notifications/weekly-summary')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('清理舊通知', async () => {
      const response = await request(app)
        .post('/api/admin/notifications/cleanup?days=30')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('系統監控功能', () => {
    test('創建測試報告', async () => {
      const response = await request(app)
        .post('/api/admin/create-test-reports')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('獲取系統性能統計', async () => {
      const response = await request(app)
        .get('/api/admin/system-performance-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memory).toBeDefined()
      expect(response.body.data.cpu).toBeDefined()
      expect(response.body.data.uptime).toBeDefined()
      expect(response.body.data.platform).toBeDefined()
    })

    test('獲取資料庫統計', async () => {
      const response = await request(app)
        .get('/api/admin/database-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.database).toBeDefined()
      expect(response.body.data.collectionsCount).toBeDefined()
      expect(response.body.data.dataSize).toBeDefined()
      expect(response.body.data.storageSize).toBeDefined()
    })

    test('清理過期快取', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup-expired-cache')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('重建資料庫索引', async () => {
      const response = await request(app)
        .post('/api/admin/rebuild-indexes')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.results).toBeDefined()
      expect(Array.isArray(response.body.data.results)).toBe(true)
    })
  })

  describe('錯誤處理測試', () => {
    test('無效的迷因ID應該返回錯誤', async () => {
      const response = await request(app)
        .post('/api/admin/check-counts/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    test('無效的配置參數應該返回錯誤', async () => {
      const response = await request(app)
        .put('/api/admin/recommendation-system-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          config: {
            invalidParam: 'invalid',
          },
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})
