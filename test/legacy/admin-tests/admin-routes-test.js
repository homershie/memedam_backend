import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import '../../../config/loadEnv.js'

// 測試用的管理員用戶
let adminToken

// 測試用的普通用戶
let _testUser
let testToken

// 測試用的迷因
let _testMeme

describe('Admin Routes 功能測試', () => {
  beforeAll(async () => {
    // 連線由全域 setup 處理

    // 創建測試管理員用戶
    await User.create({
      username: 'admin_test',
      email: 'admin@test.com',
      password: 'admin1234',
      role: 'admin',
      status: 'active',
      is_verified: true,
    })

    // 創建測試普通用戶
    _testUser = await User.create({
      username: 'user_test',
      email: 'user@test.com',
      password: 'user1234',
      role: 'user',
      status: 'active',
      is_verified: true,
    })

    // 創建測試迷因
    _testMeme = await Meme.create({
      title: '測試迷因',
      type: 'image',
      content: 'test content',
      image_url: 'https://example.com/test.jpg',
      author_id: _testUser._id,
      status: 'public',
      like_count: 0,
      dislike_count: 0,
      comment_count: 0,
      view_count: 0,
    })

    // 獲取管理員 token
    const adminLoginResponse = await request(app).post('/api/users/login').send({
      login: 'admin@test.com',
      password: 'admin1234',
    })

    adminToken = adminLoginResponse.body.token

    // 獲取普通用戶 token
    const userLoginResponse = await request(app).post('/api/users/login').send({
      login: 'user@test.com',
      password: 'user1234',
    })

    testToken = userLoginResponse.body.token
  })

  afterAll(async () => {
    // 清理測試數據（連線由全域 setup 關閉）
    await User.deleteMany({ username: { $in: ['admin_test', 'user_test'] } })
    await Meme.deleteMany({ title: '測試迷因' })
  })

  describe('權限測試', () => {
    test('非管理員用戶無法訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(403)
    })

    test('未認證用戶無法訪問管理員路由', async () => {
      const response = await request(app).get('/api/admin/count-statistics')

      expect(response.status).toBe(401)
    })
  })

  describe('計數檢查功能', () => {
    test('檢查單一迷因計數', async () => {
      const response = await request(app)
        .post(`/api/admin/check-counts/${_testMeme._id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('檢查所有迷因計數', async () => {
      const response = await request(app)
        .post('/api/admin/check-all-counts')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('獲取計數統計', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
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
        .send({ limit: 10 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行定期熱門分數更新', async () => {
      const response = await request(app)
        .post('/api/admin/scheduled-hot-score-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUpdates: 10 })

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
        .send({ maxUsers: 10 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行定期內容基礎更新', async () => {
      const response = await request(app)
        .post('/api/admin/scheduled-content-based-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUsers: 10 })

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
        .send({ maxUsers: 10 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('執行定期協同過濾更新', async () => {
      const response = await request(app)
        .post('/api/admin/scheduled-collaborative-filtering-update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ maxUsers: 10 })

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
    })
  })
})
