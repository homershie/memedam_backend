import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import VerificationToken from '../../models/VerificationToken.js'

describe('註冊時發送驗證信測試', () => {
  beforeEach(async () => {
    // 清理測試資料
    await User.deleteMany({})
    await VerificationToken.deleteMany({})
  })

  test('註冊新用戶時應該發送驗證信', async () => {
    const testUser = {
      username: 'testuser123',
      email: 'test@example.com',
      password: 'password123',
      display_name: '測試用戶',
    }

    const response = await request(app).post('/api/users').send(testUser).expect(201)

    // 檢查回應
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

  test('註冊時 email 發送失敗應該仍然創建用戶', async () => {
    // 模擬 email 服務失敗的情況
    const testUser = {
      username: 'testuser456',
      email: 'invalid-email', // 無效的 email 格式
      password: 'password123',
      display_name: '測試用戶',
    }

    const response = await request(app).post('/api/users').send(testUser).expect(201)

    // 檢查回應
    expect(response.body.success).toBe(true)
    expect(response.body.emailSent).toBe(false) // email 發送失敗
    expect(response.body.user).toBeDefined()

    // 檢查用戶是否已創建
    const createdUser = await User.findOne({ username: testUser.username })
    expect(createdUser).toBeDefined()
  })

  test('重複註冊應該返回錯誤', async () => {
    const testUser = {
      username: 'testuser789',
      email: 'test789@example.com',
      password: 'password123',
      display_name: '測試用戶',
    }

    // 第一次註冊
    await request(app).post('/api/users').send(testUser).expect(201)

    // 第二次註冊相同 email
    const response = await request(app).post('/api/users').send(testUser).expect(409)

    expect(response.body.success).toBe(false)
    expect(response.body.message).toContain('此電子郵件已被註冊')
  })
})
