import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { createTestUser, cleanupTestData } from '../../setup.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

// Mock SendGrid
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}))

describe('變更 Email 功能測試', () => {
  let testUser
  let authToken
  const originalEmail = `original_${Date.now()}@example.com`
  const newEmail = `new_${Date.now()}@example.com`
  const testPassword = 'testpassword123'

  beforeAll(async () => {
    // 創建測試用戶
    testUser = await User.create({
      username: `changemail_${Date.now()}`,
      email: originalEmail,
      password: testPassword,
      is_verified: true,
      status: 'active',
    })

    // 登入取得 token
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email: originalEmail,
        password: testPassword,
      })

    authToken = loginResponse.body.token
  })

  beforeEach(async () => {
    // 清理驗證 token
    await VerificationToken.deleteMany({})
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupTestData({ User, VerificationToken })
  })

  describe('請求變更 Email', () => {
    it('應該成功發起變更 email 請求', async () => {
      const response = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail,
          password: testPassword,
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('驗證信已發送')

      // 檢查是否創建了驗證 token
      const token = await VerificationToken.findOne({ 
        userId: testUser._id,
        type: 'password_reset',
      })
      expect(token).toBeDefined()
      expect(token.metadata.newEmail).toBe(newEmail)
    })

    it('應該驗證用戶身分（密碼）', async () => {
      const response = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: `another_${Date.now()}@example.com`,
          password: 'wrongpassword',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('密碼錯誤')
    })

    it('應該拒絕未登入的請求', async () => {
      const response = await request(app)
        .post('/api/users/change-email/request')
        .send({
          newEmail,
          password: testPassword,
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('應該拒絕無效的 email 格式', async () => {
      const response = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: 'invalid-email',
          password: testPassword,
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('無效的 email')
    })

    it('應該拒絕已被使用的 email', async () => {
      // 創建另一個用戶使用目標 email
      const existingEmail = `existing_${Date.now()}@example.com`
      await User.create({
        username: `existing_${Date.now()}`,
        email: existingEmail,
        password: 'password123',
        is_verified: true,
        status: 'active',
      })

      const response = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: existingEmail,
          password: testPassword,
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('已被使用')
    })

    it('應該拒絕變更為相同的 email', async () => {
      const response = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: originalEmail,
          password: testPassword,
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('相同')
    })
  })

  describe('驗證 Token 並完成變更', () => {
    let changeToken

    beforeEach(async () => {
      // 創建變更 email 的 token
      changeToken = jwt.sign(
        { 
          userId: testUser._id.toString(),
          oldEmail: originalEmail,
          newEmail,
        },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      )

      await VerificationToken.create({
        userId: testUser._id,
        email: originalEmail,
        token: changeToken,
        type: 'password_reset',
        metadata: { newEmail },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
    })

    it('應該成功驗證 token 並變更 email', async () => {
      const response = await request(app)
        .post('/api/users/change-email/verify')
        .send({ token: changeToken })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('成功變更')

      // 檢查用戶的 email 是否已變更
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.email).toBe(newEmail)

      // 檢查 token 是否已被刪除
      const deletedToken = await VerificationToken.findOne({ token: changeToken })
      expect(deletedToken).toBeNull()
    })

    it('應該拒絕無效的 token', async () => {
      const response = await request(app)
        .post('/api/users/change-email/verify')
        .send({ token: 'invalid_token_12345' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('無效')
    })

    it('應該拒絕過期的 token', async () => {
      vi.useFakeTimers()
      const now = new Date('2024-01-01T00:00:00Z')
      vi.setSystemTime(now)

      // 創建已過期的 token
      const expiredToken = jwt.sign(
        { 
          userId: testUser._id.toString(),
          oldEmail: originalEmail,
          newEmail,
        },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      )

      await VerificationToken.create({
        userId: testUser._id,
        email: originalEmail,
        token: expiredToken,
        type: 'password_reset',
        metadata: { newEmail },
        expiresAt: new Date(now.getTime() - 1000), // 已過期
      })

      const response = await request(app)
        .post('/api/users/change-email/verify')
        .send({ token: expiredToken })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('過期')

      vi.useRealTimers()
    })

    it('應該處理 token 類型錯誤', async () => {
      // 創建錯誤類型的 token
      const wrongTypeToken = jwt.sign(
        { email: originalEmail },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '1h' }
      )

      await VerificationToken.create({
        userId: testUser._id,
        email: originalEmail,
        token: wrongTypeToken,
        type: 'email_verification', // 錯誤的類型
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })

      const response = await request(app)
        .post('/api/users/change-email/verify')
        .send({ token: wrongTypeToken })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('變更流程的完整性', () => {
    it('應該完整執行變更 email 流程', async () => {
      const targetEmail = `complete_${Date.now()}@example.com`

      // Step 1: 請求變更
      const requestResponse = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: targetEmail,
          password: testPassword,
        })

      expect(requestResponse.status).toBe(200)

      // Step 2: 取得 token
      const token = await VerificationToken.findOne({
        userId: testUser._id,
        type: 'password_reset',
      })
      expect(token).toBeDefined()

      // Step 3: 驗證 token
      const verifyResponse = await request(app)
        .post('/api/users/change-email/verify')
        .send({ token: token.token })

      expect(verifyResponse.status).toBe(200)

      // Step 4: 確認變更
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.email).toBe(targetEmail)

      // Step 5: 使用新 email 登入
      const newLoginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: targetEmail,
          password: testPassword,
        })

      expect(newLoginResponse.status).toBe(200)
      expect(newLoginResponse.body.token).toBeDefined()
    })

    it('應該記錄 email 變更歷史', async () => {
      const historyEmail = `history_${Date.now()}@example.com`

      // 請求變更
      await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: historyEmail,
          password: testPassword,
        })

      // 取得並驗證 token
      const token = await VerificationToken.findOne({
        userId: testUser._id,
        type: 'password_reset',
      })

      await request(app)
        .post('/api/users/change-email/verify')
        .send({ token: token.token })

      // 檢查用戶的 email 變更歷史
      const user = await User.findById(testUser._id)
      expect(user.email_history).toBeDefined()
      expect(user.email_history).toContainEqual(
        expect.objectContaining({
          old_email: expect.any(String),
          new_email: historyEmail,
        })
      )
    })
  })

  describe('限制與安全', () => {
    it('應該限制變更頻率', async () => {
      // 第一次請求
      const response1 = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: `first_${Date.now()}@example.com`,
          password: testPassword,
        })

      expect(response1.status).toBe(200)

      // 立即再次請求應該被限制
      const response2 = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: `second_${Date.now()}@example.com`,
          password: testPassword,
        })

      expect(response2.status).toBe(429)
      expect(response2.body.message).toContain('請稍後再試')
    })

    it('應該在多次密碼錯誤後鎖定', async () => {
      const attempts = 5
      const responses = []

      for (let i = 0; i < attempts; i++) {
        const response = await request(app)
          .post('/api/users/change-email/request')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            newEmail: `attempt_${i}@example.com`,
            password: 'wrongpassword',
          })
        responses.push(response)
      }

      // 最後一次應該被鎖定
      const lastResponse = responses[responses.length - 1]
      expect(lastResponse.status).toBe(429)
      expect(lastResponse.body.message).toContain('鎖定')
    })

    it('應該防止同時多個變更請求', async () => {
      // 創建第一個變更請求
      await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: `concurrent1_${Date.now()}@example.com`,
          password: testPassword,
        })

      // 在第一個請求還未完成前，發起第二個請求
      const response = await request(app)
        .post('/api/users/change-email/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newEmail: `concurrent2_${Date.now()}@example.com`,
          password: testPassword,
        })

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('進行中')
    })
  })
})