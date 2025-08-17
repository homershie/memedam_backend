import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

describe('用戶名 API 功能測試', () => {
  let authToken, testUser

  beforeAll(async () => {
    // 清理測試數據
    await cleanupTestData({ User })

    // 創建測試用戶
    testUser = await createTestUser(User, {
      username: 'testuser123',
      display_name: '測試用戶',
      status: 'active',
      is_verified: true,
    })

    // 登入獲取 token
    const loginResponse = await request(app).post('/api/users/login').send({
      login: testUser.email,
      password: 'testpassword123',
    })

    authToken = loginResponse.body.token
  })

  afterAll(async () => {
    await cleanupTestData({ User })
  })

  describe('用戶名驗證', () => {
    it('應該驗證有效的用戶名', async () => {
      const response = await request(app).get('/api/users/validate-username/newusername123')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.available).toBe(true)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕太短的用戶名', async () => {
      const response = await request(app).get('/api/users/validate-username/abc')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕格式無效的用戶名', async () => {
      const response = await request(app).get('/api/users/validate-username/username@test')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕已使用的用戶名', async () => {
      const response = await request(app).get('/api/users/validate-username/testuser123')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.available).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕保留的用戶名', async () => {
      const response = await request(app).get('/api/users/validate-username/admin')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.available).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕包含特殊字符的用戶名', async () => {
      const response = await request(app).get('/api/users/validate-username/user-name')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該拒絕太長的用戶名', async () => {
      const longUsername = 'a'.repeat(31)
      const response = await request(app).get(`/api/users/validate-username/${longUsername}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('用戶名變更', () => {
    it('應該能夠變更用戶名', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_username: 'newusername456',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('用戶名變更成功')
    })

    it('應該拒絕變更為已存在的用戶名', async () => {
      // 先創建另一個用戶
      await createTestUser(User, {
        username: 'existinguser',
        email: 'existing@example.com',
      })

      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_username: 'existinguser',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該拒絕無效的用戶名格式', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_username: 'invalid-username',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該拒絕未認證的請求', async () => {
      const response = await request(app).post('/api/users/change-username').send({
        new_username: 'newusername789',
      })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('應該拒絕空的用戶名', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_username: '',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('用戶名衝突處理', () => {
    it('應該處理用戶名衝突', async () => {
      // 創建多個用戶來測試衝突
      const users = []
      for (let i = 0; i < 3; i++) {
        const user = await createTestUser(User, {
          username: `conflictuser${i}`,
          email: `conflict${i}@example.com`,
        })
        users.push(user)
      }

      // 嘗試變更為已存在的用戶名
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_username: 'conflictuser0',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('用戶名歷史記錄', () => {
    it('應該記錄用戶名變更歷史', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_username: 'historytest123',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 檢查用戶記錄是否更新
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.username).toBe('historytest123')
    })
  })

  describe('用戶名建議功能', () => {
    it('應該提供用戶名建議', async () => {
      const response = await request(app)
        .get('/api/users/suggest-username')
        .query({ base: 'testuser' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.suggestions)).toBe(true)
      expect(response.body.suggestions.length).toBeGreaterThan(0)
    })

    it('應該處理無效的基礎用戶名', async () => {
      const response = await request(app).get('/api/users/suggest-username').query({ base: 'a' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('用戶名可用性檢查', () => {
    it('應該檢查多個用戶名的可用性', async () => {
      const usernames = ['check1', 'check2', 'check3']
      const response = await request(app).post('/api/users/check-usernames').send({ usernames })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.results)).toBe(true)
      expect(response.body.results.length).toBe(usernames.length)
    })

    it('應該處理空列表', async () => {
      const response = await request(app).post('/api/users/check-usernames').send({ usernames: [] })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })
})
