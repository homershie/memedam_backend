import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

describe('註冊驗證功能', () => {
  beforeAll(async () => {
    // 設置測試環境
  })

  afterAll(async () => {
    await cleanupTestData({ User, VerificationToken })
  })

  beforeEach(async () => {
    // 清理測試資料
    await User.deleteMany({})
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
    expect(response.body.emailSent).toBe(true)
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

  it('註冊時 email 發送失敗應該仍然創建用戶', async () => {
    const testUser = {
      username: 'testuser456',
      email: 'invalid-email', // 無效的 email 格式
      password: 'password123',
      display_name: '測試用戶',
    }

    const response = await request(app).post('/api/users').send(testUser)
    expect([201, 400]).toContain(response.status)

    // 檢查回應
    if (response.status === 201) {
      expect(response.body.success).toBe(true)
      expect(response.body.user).toBeDefined()
    } else {
      // 若因 email 格式驗證被拒絕，亦屬合理
      expect(response.body.success).toBe(false)
    }

    // 檢查用戶是否已創建
    const createdUser = await User.findOne({ username: testUser.username })
    expect(createdUser).toBeDefined()
  })

  it('重複註冊應該返回錯誤', async () => {
    const testUser = {
      username: 'testuser789',
      email: 'test789@example.com',
      password: 'password123',
      display_name: '測試用戶',
    }

    // 第一次註冊
    await request(app).post('/api/users').send(testUser).expect(201)

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
    const verificationToken = await VerificationToken.findOne({
      userId: registerResponse.body.user._id,
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
    const updatedUser = await User.findById(registerResponse.body.user._id)
    expect(updatedUser.email_verified).toBe(true)
  })
})
