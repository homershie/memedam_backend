import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import mongoose from 'mongoose'

describe('OAuth 綁定功能測試', () => {
  let testUser
  let authToken

  beforeAll(async () => {
    // 創建測試用戶
    testUser = new User({
      username: 'testuser_oauth',
      email: 'testuser_oauth@example.com',
      password: 'password123',
      role: 'user',
    })
    await testUser.save()

    // 登入獲取 token
    const loginResponse = await request(app).post('/api/users/login').send({
      login: 'testuser_oauth@example.com',
      password: 'password123',
    })

    authToken = loginResponse.body.token
  })

  afterAll(async () => {
    // 清理測試用戶
    await User.findByIdAndDelete(testUser._id)
    await mongoose.connection.close()
  })

  describe('GET /api/users/bind-status', () => {
    it('應該能獲取用戶的綁定狀態', async () => {
      const response = await request(app)
        .get('/api/users/bind-status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.bindStatus).toBeDefined()
      expect(response.body.bindStatus).toHaveProperty('google')
      expect(response.body.bindStatus).toHaveProperty('facebook')
      expect(response.body.bindStatus).toHaveProperty('discord')
      expect(response.body.bindStatus).toHaveProperty('twitter')
    })

    it('未授權用戶應該被拒絕', async () => {
      const response = await request(app).get('/api/users/bind-status')

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/users/bind-auth/:provider', () => {
    it('應該能初始化 Google 綁定流程', async () => {
      const response = await request(app)
        .get('/api/users/bind-auth/google')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.authUrl).toBeDefined()
      expect(response.body.state).toBeDefined()
      expect(response.body.message).toContain('Google')
    })

    it('應該能初始化 Facebook 綁定流程', async () => {
      const response = await request(app)
        .get('/api/users/bind-auth/facebook')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.authUrl).toBeDefined()
      expect(response.body.state).toBeDefined()
      expect(response.body.message).toContain('Facebook')
    })

    it('不支援的 provider 應該返回錯誤', async () => {
      const response = await request(app)
        .get('/api/users/bind-auth/invalid')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('不支援的社群平台')
    })

    it('未授權用戶應該被拒絕', async () => {
      const response = await request(app).get('/api/users/bind-auth/google')

      expect(response.status).toBe(401)
    })
  })

  describe('綁定狀態檢查', () => {
    it('新用戶應該沒有綁定任何社群帳號', async () => {
      const response = await request(app)
        .get('/api/users/bind-status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.bindStatus.google).toBe(false)
      expect(response.body.bindStatus.facebook).toBe(false)
      expect(response.body.bindStatus.discord).toBe(false)
      expect(response.body.bindStatus.twitter).toBe(false)
    })
  })

  describe('已綁定帳號的處理', () => {
    beforeEach(async () => {
      // 模擬用戶已綁定 Google 帳號
      testUser.google_id = 'test_google_id'
      await testUser.save()
    })

    afterEach(async () => {
      // 清理綁定
      testUser.google_id = undefined
      await testUser.save()
    })

    it('已綁定 Google 帳號的用戶應該無法再次綁定', async () => {
      const response = await request(app)
        .get('/api/users/bind-auth/google')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(409)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('已經綁定了 google 帳號')
    })
  })
})

console.log('OAuth 綁定功能測試完成')
