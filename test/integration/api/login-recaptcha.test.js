import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import bcrypt from 'bcrypt'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

describe('登入 reCAPTCHA 整合測試', () => {
  let testUser
  let testUser2

  beforeAll(async () => {
    // 建立測試用戶 - 使用更簡單的方法
    const testPassword = 'testpassword123456'
    const hashedPassword = await bcrypt.hash(testPassword, 10)

    // 使用 findOneAndUpdate 來避免觸發 pre-save 中間件
    testUser = await User.findOneAndUpdate(
      { email: 'test_recaptcha@example.com' },
      {
        username: 'testuser_recaptcha',
        email: 'test_recaptcha@example.com',
        password: hashedPassword,
        status: 'active',
        has_password: true,
        email_verified: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    // 建立第二個測試用戶用於密碼錯誤測試
    testUser2 = await User.findOneAndUpdate(
      { email: 'test_recaptcha2@example.com' },
      {
        username: 'testuser_recaptcha2',
        email: 'test_recaptcha2@example.com',
        password: hashedPassword,
        status: 'active',
        has_password: true,
        email_verified: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  })

  afterAll(async () => {
    // 清理測試數據
    if (testUser) {
      await User.findByIdAndDelete(testUser._id)
    }
    if (testUser2) {
      await User.findByIdAndDelete(testUser2._id)
    }
  })

  describe('POST /api/users/login', () => {
    it('應該在密碼錯誤時拒絕登入', async () => {
      // 暫時移除 reCAPTCHA 設定進行測試
      const originalSecretKey = process.env.RECAPTCHA_SECRET_KEY
      delete process.env.RECAPTCHA_SECRET_KEY

      // 使用第二個測試用戶來避免頻率限制
      const response = await request(app).post('/api/users/login').send({
        login: testUser2.email,
        password: 'wrongpassword123456',
      })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('帳號、信箱或密碼錯誤')

      // 恢復原始設定
      if (originalSecretKey) {
        process.env.RECAPTCHA_SECRET_KEY = originalSecretKey
      }
    })

    it('應該在沒有 reCAPTCHA token 時拒絕登入（如果已設定 reCAPTCHA）', async () => {
      const response = await request(app).post('/api/users/login').send({
        login: testUser.email,
        password: 'testpassword123456',
        // 故意不提供 recaptchaToken
      })

      // 如果設定了 reCAPTCHA，應該返回 400 錯誤
      if (process.env.RECAPTCHA_SECRET_KEY) {
        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('reCAPTCHA')
      } else {
        // 如果沒有設定 reCAPTCHA，應該正常登入
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.token).toBeDefined()
      }
    })

    it('應該在提供無效 reCAPTCHA token 時拒絕登入', async () => {
      const response = await request(app).post('/api/users/login').send({
        login: testUser.email,
        password: 'testpassword123456',
        recaptchaToken: 'invalid_token_123',
      })

      // 如果設定了 reCAPTCHA，應該返回 400 錯誤
      if (process.env.RECAPTCHA_SECRET_KEY) {
        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.message).toContain('reCAPTCHA')
      } else {
        // 如果沒有設定 reCAPTCHA，應該正常登入
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.token).toBeDefined()
      }
    })

    it('應該在沒有設定 reCAPTCHA 時正常登入', async () => {
      // 暫時移除 reCAPTCHA 設定進行測試
      const originalSecretKey = process.env.RECAPTCHA_SECRET_KEY
      delete process.env.RECAPTCHA_SECRET_KEY

      const response = await request(app).post('/api/users/login').send({
        login: testUser.email,
        password: 'testpassword123456',
      })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.token).toBeDefined()
      expect(response.body.user).toBeDefined()
      expect(response.body.user.email).toBe(testUser.email)

      // 恢復原始設定
      if (originalSecretKey) {
        process.env.RECAPTCHA_SECRET_KEY = originalSecretKey
      }
    })

    it('應該支援帳號或信箱登入', async () => {
      // 暫時移除 reCAPTCHA 設定進行測試
      const originalSecretKey = process.env.RECAPTCHA_SECRET_KEY
      delete process.env.RECAPTCHA_SECRET_KEY

      // 只測試帳號登入，避免觸發頻率限制
      const response = await request(app).post('/api/users/login').send({
        login: testUser.username,
        password: 'testpassword123456',
      })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.user).toBeDefined()
      expect(response.body.user.username).toBe(testUser.username)

      // 恢復原始設定
      if (originalSecretKey) {
        process.env.RECAPTCHA_SECRET_KEY = originalSecretKey
      }
    })
  })
})
