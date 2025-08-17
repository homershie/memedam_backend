import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import Meme from '../../models/Meme.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../setup.js'

describe('管理員路由測試 (Vitest)', () => {
  let adminUser, adminToken
  let testUser, testToken
  let testMeme

  beforeAll(async () => {
    // 創建測試管理員用戶（使用帶時間戳的預設隨機帳號避免重複鍵）
    adminUser = await createTestUser(User, {
      role: 'admin',
    })

    // 創建測試普通用戶
    testUser = await createTestUser(User, {
      role: 'user',
    })

    // 創建測試迷因
    testMeme = await createTestMeme(Meme, testUser._id, {
      title: 'Vitest 測試迷因',
    })

    // 獲取管理員 token
    const adminLoginResponse = await request(app).post('/api/users/login').send({
      login: adminUser.email,
      password: 'testpassword123',
    })

    adminToken = adminLoginResponse.body.token

    // 獲取普通用戶 token
    const userLoginResponse = await request(app).post('/api/users/login').send({
      login: testUser.email,
      password: 'testpassword123',
    })

    testToken = userLoginResponse.body.token
  })

  afterAll(async () => {
    // 清理測試數據
    await cleanupTestData({ User, Meme })
  })

  describe('權限測試', () => {
    it('管理員用戶可以訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    it('非管理員用戶無法訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
    })

    it('未認證用戶無法訪問管理員路由', async () => {
      const response = await request(app).get('/api/admin/count-statistics')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('計數檢查功能', () => {
    it('檢查單一迷因計數', async () => {
      const response = await request(app)
        .post(`/api/admin/check-counts/${testMeme._id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.total).toBeDefined()
    })

    it('獲取計數統計', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memes).toBeDefined()
      expect(response.body.data.users).toBeDefined()
    })
  })

  describe('系統監控功能', () => {
    it('獲取系統性能統計', async () => {
      const response = await request(app)
        .get('/api/admin/system-performance-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memory).toBeDefined()
      expect(response.body.data.cpu).toBeDefined()
      expect(response.body.data.uptime).toBeDefined()
    })

    it('獲取資料庫統計', async () => {
      const response = await request(app)
        .get('/api/admin/database-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.database).toBeDefined()
      expect(response.body.data.collectionsCount).toBeDefined()
    })
  })
})
