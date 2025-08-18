import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

// Mock email service
vi.mock('../../../utils/emailService.js', () => ({
  sendVerificationEmail: vi.fn(() => Promise.resolve(true)),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve(true)),
}))

describe('註冊驗證功能', () => {
  beforeAll(async () => {
    // 設置測試環境
    await cleanupTestData({ User, VerificationToken })
  })

  afterAll(async () => {
    await cleanupTestData({ User, VerificationToken })
  })

  beforeEach(async () => {
    // 清理測試資料
    await User.deleteMany({ email: { $regex: /test.*@example\.com/ } })
    await VerificationToken.deleteMany({})
  })

  it('註冊新用戶時應該發送驗證信', async () => {
    const testUser = {
      username: 'testuser123',
      email: 'test@example.com',
      password: 'password123',
      display_name: '測試用戶',
    }

    const response = await request(app).post('/api/users').send(testUser)

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.message).toContain('註冊成功')
    
    // 檢查回應中的 emailSent 欄位（如果存在）
    if (response.body.emailSent !== undefined) {
      expect(response.body.emailSent).toBe(true)
    }
    
    expect(response.body.user).toBeDefined()
    expect(response.body.user.email_verified).toBe(false)

    // 檢查用戶是否已創建
    const createdUser = await User.findOne({ email: testUser.email })
    expect(createdUser).toBeDefined()
    expect(createdUser.email_verified).toBe(false)

    // 檢查是否產生了驗證 token
    const verificationToken = await VerificationToken.findOne({
      userId: createdUser._id,
      type: 'email_verification',
      used: false,
    })
    expect(verificationToken).toBeDefined()
    expect(verificationToken.expiresAt).toBeDefined()
  })

  it('註冊時 email 格式無效應該返回錯誤', async () => {
    const testUser = {
      username: 'testuser456',
      email: 'invalid-email', // 無效的 email 格式
      password: 'password123',
      display_name: '測試用戶',
    }

    const response = await request(app).post('/api/users').send(testUser)
    
    // 應該返回 400 錯誤
    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.message).toBeDefined()

    // 確認用戶沒有被創建
    const createdUser = await User.findOne({ username: testUser.username })
    expect(createdUser).toBeNull()
  })

  it('重複註冊應該返回錯誤', async () => {
    const testUser = {
      username: 'testuser789',
      email: 'test789@example.com',
      password: 'password123',
      display_name: '測試用戶',
    }

    // 第一次註冊
    const firstResponse = await request(app).post('/api/users').send(testUser)
    expect(firstResponse.status).toBe(201)

    // 第二次註冊相同 email
    const response = await request(app).post('/api/users').send(testUser)
    expect([409, 400]).toContain(response.status)

    expect(response.body.success).toBe(false)
    expect(typeof response.body.message).toBe('string')
  })

  it('應該能驗證 email', async () => {
    // 先註冊用戶
    const testUser = {
      username: 'testuser_verify',
      email: 'verify@example.com',
      password: 'password123',
      display_name: '驗證用戶',
    }

    const registerResponse = await request(app).post('/api/users').send(testUser)
    expect(registerResponse.status).toBe(201)

    // 獲取驗證 token
    const createdUser = await User.findOne({ email: testUser.email })
    const verificationToken = await VerificationToken.findOne({
      userId: createdUser._id,
      type: 'email_verification',
      used: false,
    })
    expect(verificationToken).toBeDefined()

    // 驗證 email
    const verifyResponse = await request(app)
      .post('/api/verification/verify-email')
      .send({ token: verificationToken.token })

    expect(verifyResponse.status).toBe(200)
    expect(verifyResponse.body.success).toBe(true)

    // 檢查用戶狀態
    const updatedUser = await User.findById(createdUser._id)
    expect(updatedUser.email_verified).toBe(true)
  })

  it('使用無效的驗證 token 應該返回錯誤', async () => {
    const verifyResponse = await request(app)
      .post('/api/verification/verify-email')
      .send({ token: 'invalid-token-12345' })

    expect(verifyResponse.status).toBe(400)
    expect(verifyResponse.body.success).toBe(false)
    expect(verifyResponse.body.message).toBeDefined()
  })

  it('使用過期的驗證 token 應該返回錯誤', async () => {
    // 創建一個過期的 token
    const testUser = await createTestUser(User, {
      username: 'expired_token_user',
      email: 'expired@example.com',
      password: 'password123',
    })

    const expiredToken = await VerificationToken.create({
      userId: testUser._id,
      token: 'expired-token-12345',
      type: 'email_verification',
      expiresAt: new Date(Date.now() - 3600000), // 1小時前過期
      used: false,
    })

    const verifyResponse = await request(app)
      .post('/api/verification/verify-email')
      .send({ token: expiredToken.token })

    expect(verifyResponse.status).toBe(400)
    expect(verifyResponse.body.success).toBe(false)
    expect(verifyResponse.body.message).toContain('過期')
  })
})
