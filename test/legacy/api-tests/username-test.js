/**
 * Username 驗證和變更功能測試
 */

import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'

describe('Username 功能測試', () => {
  let authToken
  let testEmail

  beforeAll(async () => {
    // 清理測試數據
    await User.deleteMany({ username: /^testuser/ })

    // 創建測試用戶
    const ts = Date.now().toString().slice(-6)
    testEmail = `test_${ts}@example.com`
    await User.create({
      username: 'testuser123',
      email: testEmail,
      password: 'password1234',
      display_name: '測試用戶',
      status: 'active',
      is_verified: true,
    })
  })

  afterAll(async () => {
    // 清理測試數據
    await User.deleteMany({ $or: [{ username: /^testuser/ }, { email: testEmail }] })
  })

  describe('POST /api/users/login', () => {
    it('應該能夠登入並獲取 token', async () => {
      const response = await request(app).post('/api/users/login').send({
        login: 'testuser123',
        password: 'password1234',
      })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.token).toBeDefined()

      authToken = response.body.token
    })
  })

  describe('GET /api/users/validate-username/:username', () => {
    it('應該驗證有效的 username', async () => {
      const response = await request(app).get('/api/users/validate-username/newusername123')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.available).toBe(true)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕太短的 username', async () => {
      const response = await request(app).get('/api/users/validate-username/abc')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕格式無效的 username', async () => {
      const response = await request(app).get('/api/users/validate-username/username@test')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕已使用的 username', async () => {
      const response = await request(app).get('/api/users/validate-username/testuser123')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.available).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })

    it('應該拒絕保留的 username', async () => {
      const response = await request(app).get('/api/users/validate-username/admin')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.available).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })
  })

  describe('POST /api/users/change-username', () => {
    it('應該能夠變更 username', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'newtestuser123', // 介於 5-30 且小寫英數/._
          currentPassword: 'password1234',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('username 已成功變更')
      expect(response.body.user.username).toBe('newtestuser123')
    })

    it('應該拒絕重複變更相同的 username', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'newtestuser123',
          currentPassword: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('新 username 不能與目前 username 相同')
    })

    it('應該拒絕錯誤的密碼', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'anotheruser123',
          currentPassword: 'wrongpassword',
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('目前密碼不正確')
    })

    it('應該拒絕格式無效的 username', async () => {
      const response = await request(app)
        .post('/api/users/change-username')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'invalid@user',
          currentPassword: 'password123',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(typeof response.body.message).toBe('string')
    })
  })
})
