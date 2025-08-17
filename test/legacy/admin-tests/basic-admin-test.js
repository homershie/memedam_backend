import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import '../../../config/loadEnv.js'

describe('Admin Routes 基礎測試', () => {
  let adminToken = ''

  beforeAll(async () => {
    // 清理殘留測試帳號
    await User.deleteMany({ username: { $regex: /^admin_test_/ } })

    // 建立測試管理員用戶（username 5-30 小寫英數與 _ .）
    const ts = Date.now().toString().slice(-8)
    const adminUsername = `admin_test_${ts}`
    const adminEmail = `admin_${ts}@test.com`

    await User.create({
      username: adminUsername,
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
      status: 'active',
      is_verified: true,
    })

    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({ login: adminEmail, password: 'admin123' })

    expect(loginResponse.status).toBe(200)
    adminToken = loginResponse.body.token
    expect(adminToken).toBeDefined()
  })

  afterAll(async () => {
    await User.deleteMany({ username: { $regex: /^admin_test_/ } })
  })

  test('未認證用戶無法訪問管理員路由', async () => {
    const res = await request(app).get('/api/admin/count-statistics')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  test('管理員用戶可以訪問管理員路由', async () => {
    const res = await request(app)
      .get('/api/admin/count-statistics')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  test('獲取維護狀態', async () => {
    const res = await request(app)
      .get('/api/admin/maintenance-status')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('獲取系統性能統計', async () => {
    const res = await request(app)
      .get('/api/admin/system-performance-stats')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  test('獲取資料庫統計', async () => {
    const res = await request(app)
      .get('/api/admin/database-stats')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  test('清理過期快取', async () => {
    const res = await request(app)
      .post('/api/admin/cleanup-expired-cache')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test('重建資料庫索引', async () => {
    const res = await request(app)
      .post('/api/admin/rebuild-indexes')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })

  test('創建測試報告', async () => {
    const res = await request(app)
      .post('/api/admin/create-test-reports')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
  })
})
