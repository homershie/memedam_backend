import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { cleanupTestData } from '../../setup.js'
import { StatusCodes } from 'http-status-codes'

describe('密碼重設流程', () => {
  let testUser
  let resetToken

  beforeAll(async () => {
    testUser = await User.create({
      username: `testuser_${Date.now()}`,
      email: 'test_reset@example.com',
      password: 'oldpassword123',
      email_verified: true,
    })
  })

  afterAll(async () => {
    await cleanupTestData({ User, VerificationToken })
  })

  it('POST /api/users/forgot-password 應該成功發送密碼重設 email 並建立 token', async () => {
    const res = await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'test_reset@example.com' })
      .expect(StatusCodes.OK)

    expect(res.body.success).toBe(true)

    const tokenDoc = await VerificationToken.findOne({
      userId: testUser._id,
      type: 'password_reset',
      used: false,
    })
    expect(tokenDoc).toBeTruthy()
    resetToken = tokenDoc.token
  })

  it('POST /api/users/forgot-password 應該拒絕無效的 email 格式', async () => {
    const res = await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'invalid-email' })
      .expect(StatusCodes.BAD_REQUEST)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/users/forgot-password 應該拒絕不存在的 email', async () => {
    const res = await request(app)
      .post('/api/users/forgot-password')
      .send({ email: 'notfound@example.com' })
      .expect(StatusCodes.NOT_FOUND)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/users/reset-password 應該成功重設密碼並可用新密碼登入', async () => {
    const res = await request(app)
      .post('/api/users/reset-password')
      .send({ token: resetToken, newPassword: 'newpassword123' })
      .expect(StatusCodes.OK)

    expect(res.body.success).toBe(true)

    const reLogin = await request(app)
      .post('/api/users/login')
      .send({ login: 'test_reset@example.com', password: 'newpassword123' })
      .expect(StatusCodes.OK)
    expect(reLogin.body.token).toBeDefined()
  })

  it('POST /api/users/reset-password 應該拒絕無效的 token', async () => {
    const res = await request(app)
      .post('/api/users/reset-password')
      .send({ token: 'invalid-token', newPassword: 'newpassword123' })
      .expect(StatusCodes.BAD_REQUEST)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/users/reset-password 應該拒絕太短的密碼', async () => {
    const res = await request(app)
      .post('/api/users/reset-password')
      .send({ token: resetToken, newPassword: '123' })
      .expect(StatusCodes.BAD_REQUEST)
    expect(res.body.success).toBe(false)
  })
})