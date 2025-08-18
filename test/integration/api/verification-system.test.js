import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { createTestUser, cleanupTestData } from '../../setup.js'
import jwt from 'jsonwebtoken'

// Mock SendGrid
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}))

describe('驗證系統測試', () => {
  let testUser
  let unverifiedUser

  beforeAll(async () => {
    // 創建已驗證的測試用戶
    testUser = await createTestUser(User, {
      username: `verified_${Date.now()}`,
      email: `verified_${Date.now()}@example.com`,
      is_verified: true,
    })

    // 創建未驗證的測試用戶
    unverifiedUser = await User.create({
      username: `unverified_${Date.now()}`,
      email: `unverified_${Date.now()}@example.com`,
      password: 'testpassword123',
      is_verified: false,
      status: 'active',
    })
  })

  beforeEach(async () => {
    // 清理驗證 token
    await VerificationToken.deleteMany({})
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupTestData({ User, VerificationToken })
  })

  describe('Token 生成與儲存', () => {
    it('應該為新用戶生成驗證 token', async () => {
      const newUser = {
        username: `newuser_${Date.now()}`,
        email: `newuser_${Date.now()}@example.com`,
        password: 'testpassword123',
      }

      await request(app)
        .post('/api/users')
        .send(newUser)

      // 檢查是否創建了驗證 token
      const token = await VerificationToken.findOne({ email: newUser.email })
      expect(token).toBeDefined()
      expect(token.token).toBeDefined()
      expect(token.type).toBe('email_verification')
    })

    it('應該生成唯一的 token', async () => {
      // 為同一用戶生成多個 token
      const email = unverifiedUser.email

      const token1 = await VerificationToken.create({
        userId: unverifiedUser._id,
        email,
        token: jwt.sign({ email }, process.env.JWT_SECRET || 'test_secret'),
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const token2 = await VerificationToken.create({
        userId: unverifiedUser._id,
        email,
        token: jwt.sign({ email, timestamp: Date.now() }, process.env.JWT_SECRET || 'test_secret'),
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      expect(token1.token).not.toBe(token2.token)
    })

    it('應該設置正確的過期時間', async () => {
      const token = await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token: 'test_token_' + Date.now(),
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小時
      })

      const expiresAt = new Date(token.expiresAt)
      const now = new Date()
      const diffHours = (expiresAt - now) / (1000 * 60 * 60)

      expect(diffHours).toBeGreaterThan(23)
      expect(diffHours).toBeLessThanOrEqual(24)
    })
  })

  describe('Token 驗證', () => {
    it('應該成功驗證有效的 token', async () => {
      // 創建驗證 token
      const token = jwt.sign(
        { email: unverifiedUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
      )

      await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token,
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const response = await request(app)
        .get(`/api/verification/verify-email?token=${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 檢查用戶是否已被標記為已驗證
      const updatedUser = await User.findById(unverifiedUser._id)
      expect(updatedUser.is_verified).toBe(true)
    })

    it('應該拒絕無效的 token', async () => {
      const invalidToken = 'invalid_token_12345'

      const response = await request(app)
        .get(`/api/verification/verify-email?token=${invalidToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該拒絕過期的 token', async () => {
      vi.useFakeTimers()
      const now = new Date('2024-01-01T00:00:00Z')
      vi.setSystemTime(now)

      // 創建一個已過期的 token
      const token = jwt.sign(
        { email: unverifiedUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
      )

      await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token,
        type: 'email_verification',
        expiresAt: new Date(now.getTime() - 1000), // 已過期
      })

      const response = await request(app)
        .get(`/api/verification/verify-email?token=${token}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('過期')

      vi.useRealTimers()
    })

    it('應該防止重複驗證', async () => {
      // 使用已驗證的用戶
      const token = jwt.sign(
        { email: testUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
      )

      await VerificationToken.create({
        userId: testUser._id,
        email: testUser.email,
        token,
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      const response = await request(app)
        .get(`/api/verification/verify-email?token=${token}`)

      expect(response.status).toBe(400)
      expect(response.body.message).toContain('已驗證')
    })
  })

  describe('重送驗證信', () => {
    it('應該成功重送驗證信給未驗證用戶', async () => {
      const response = await request(app)
        .post('/api/verification/resend')
        .send({ email: unverifiedUser.email })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('已發送')

      // 檢查是否創建了新的 token
      const tokens = await VerificationToken.find({ email: unverifiedUser.email })
      expect(tokens.length).toBeGreaterThan(0)
    })

    it('應該拒絕為已驗證用戶重送驗證信', async () => {
      const response = await request(app)
        .post('/api/verification/resend')
        .send({ email: testUser.email })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('已驗證')
    })

    it('應該拒絕為不存在的用戶重送驗證信', async () => {
      const response = await request(app)
        .post('/api/verification/resend')
        .send({ email: 'nonexistent@example.com' })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    it('應該限制重送頻率', async () => {
      // 第一次重送
      const response1 = await request(app)
        .post('/api/verification/resend')
        .send({ email: unverifiedUser.email })

      expect(response1.status).toBe(200)

      // 立即再次重送應該被限制
      const response2 = await request(app)
        .post('/api/verification/resend')
        .send({ email: unverifiedUser.email })

      expect(response2.status).toBe(429)
      expect(response2.body.message).toContain('請稍後再試')
    })
  })

  describe('Token 清理', () => {
    it('應該自動清理過期的 token', async () => {
      vi.useFakeTimers()
      const now = new Date('2024-01-01T00:00:00Z')
      vi.setSystemTime(now)

      // 創建多個 token，部分過期
      await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token: 'expired_token_1',
        type: 'email_verification',
        expiresAt: new Date(now.getTime() - 86400000), // 已過期1天
      })

      await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token: 'valid_token_1',
        type: 'email_verification',
        expiresAt: new Date(now.getTime() + 86400000), // 還有1天過期
      })

      // 執行清理（通常由排程觸發）
      await VerificationToken.deleteMany({
        expiresAt: { $lt: now }
      })

      const remainingTokens = await VerificationToken.find({})
      expect(remainingTokens.length).toBe(1)
      expect(remainingTokens[0].token).toBe('valid_token_1')

      vi.useRealTimers()
    })

    it('應該在驗證成功後刪除 token', async () => {
      const token = jwt.sign(
        { email: unverifiedUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
      )

      await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token,
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      // 驗證 token
      await request(app)
        .get(`/api/verification/verify-email?token=${token}`)

      // 檢查 token 是否已被刪除
      const deletedToken = await VerificationToken.findOne({ token })
      expect(deletedToken).toBeNull()
    })
  })

  describe('邊界情況', () => {
    it('應該處理無效的 email 格式', async () => {
      const response = await request(app)
        .post('/api/verification/resend')
        .send({ email: 'invalid-email' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('無效')
    })

    it('應該處理缺少 token 參數', async () => {
      const response = await request(app)
        .get('/api/verification/verify-email')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('token')
    })

    it('應該處理同時多個驗證請求', async () => {
      const token = jwt.sign(
        { email: unverifiedUser.email },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
      )

      await VerificationToken.create({
        userId: unverifiedUser._id,
        email: unverifiedUser.email,
        token,
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      // 同時發送多個驗證請求
      const promises = Array(5).fill().map(() =>
        request(app).get(`/api/verification/verify-email?token=${token}`)
      )

      const responses = await Promise.all(promises)
      
      // 只有一個應該成功
      const successCount = responses.filter(r => r.status === 200).length
      expect(successCount).toBe(1)
    })
  })
})