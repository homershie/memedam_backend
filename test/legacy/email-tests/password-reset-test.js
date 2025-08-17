import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { StatusCodes } from 'http-status-codes'

describe('密碼重設功能測試', () => {
  let testUser
  let resetToken

  beforeAll(async () => {
    // 建立測試用戶
    await User.deleteMany({ email: 'test@example.com' })
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'oldpassword123',
      email_verified: true,
    })
  })

  afterAll(async () => {
    // 清理測試資料
    if (testUser?._id) {
      await VerificationToken.deleteMany({ userId: testUser._id })
    }
    await User.deleteMany({ email: 'test@example.com' })
  })

  describe('POST /api/users/forgot-password', () => {
    it('應該成功發送密碼重設 email', async () => {
      const response = await request(app)
        .post('/api/users/forgot-password')
        .send({
          email: 'test@example.com',
        })
        .expect(StatusCodes.OK)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('密碼重設 email 已發送')

      // 檢查是否建立了密碼重設 token
      const token = await VerificationToken.findOne({
        userId: testUser._id,
        type: 'password_reset',
        used: false,
      })
      expect(token).toBeTruthy()
      resetToken = token.token
    })

    it('應該拒絕無效的 email 格式', async () => {
      const response = await request(app)
        .post('/api/users/forgot-password')
        .send({
          email: 'invalid-email',
        })
        .expect(StatusCodes.BAD_REQUEST)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('請提供有效的 email 地址')
    })

    it('應該拒絕不存在的 email', async () => {
      const response = await request(app)
        .post('/api/users/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(StatusCodes.NOT_FOUND)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('找不到此 email 對應的用戶')
    })
  })

  describe('POST /api/users/reset-password', () => {
    it('應該成功重設密碼', async () => {
      const response = await request(app)
        .post('/api/users/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newpassword123',
        })
        .expect(StatusCodes.OK)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('密碼重設成功，請使用新密碼登入')

      // 檢查密碼是否已更新
      // 重新登入驗證新密碼有效
      const reLogin = await request(app)
        .post('/api/users/login')
        .send({ login: 'test@example.com', password: 'newpassword123' })
        .expect(StatusCodes.OK)

      expect(reLogin.body.token).toBeDefined()

      // 檢查 token 是否已標記為使用
      const usedToken = await VerificationToken.findOne({
        token: resetToken,
        used: true,
      })
      expect(usedToken).toBeTruthy()
    })

    it('應該拒絕無效的 token', async () => {
      const response = await request(app)
        .post('/api/users/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newpassword123',
        })
        .expect(StatusCodes.BAD_REQUEST)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('無效或已過期的重設連結')
    })

    it('應該拒絕太短的密碼', async () => {
      const response = await request(app)
        .post('/api/users/reset-password')
        .send({
          token: resetToken,
          newPassword: '123',
        })
        .expect(StatusCodes.BAD_REQUEST)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('新密碼長度必須在8到20個字元之間')
    })

    it('應該拒絕太長的密碼', async () => {
      const response = await request(app)
        .post('/api/users/reset-password')
        .send({
          token: resetToken,
          newPassword: 'a'.repeat(21),
        })
        .expect(StatusCodes.BAD_REQUEST)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('新密碼長度必須在8到20個字元之間')
    })
  })
})
