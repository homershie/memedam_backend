import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import '../../../config/loadEnv.js'

// 測試用的管理員用戶
let adminToken

describe('Admin Routes 簡單測試', () => {
  beforeAll(async () => {
    // 連線由全域 setup 處理

    // 創建測試管理員用戶
    await User.create({
      username: 'admin_test_simple',
      email: 'admin_simple@test.com',
      password: 'admin123',
      role: 'admin',
      status: 'active',
      is_verified: true,
    })

    // 獲取管理員 token
    const adminLoginResponse = await request(app).post('/api/users/login').send({
      login: 'admin_simple@test.com',
      password: 'admin123',
    })

    adminToken = adminLoginResponse.body.token
    console.log('管理員 token 已獲取:', adminToken ? '成功' : '失敗')
  })

  afterAll(async () => {
    // 清理測試數據（連線由全域 setup 關閉）
    await User.deleteMany({ username: 'admin_test_simple' })
  })

  test('獲取計數統計 - 需要管理員權限', async () => {
    console.log('開始測試獲取計數統計...')

    const response = await request(app)
      .get('/api/admin/count-statistics')
      .set('Authorization', `Bearer ${adminToken}`)

    console.log('回應狀態:', response.status)
    console.log('回應內容:', response.body)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toBeDefined()
  })

  test('獲取維護狀態', async () => {
    console.log('開始測試獲取維護狀態...')

    const response = await request(app)
      .get('/api/admin/maintenance-status')
      .set('Authorization', `Bearer ${adminToken}`)

    console.log('回應狀態:', response.status)
    console.log('回應內容:', response.body)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toBeDefined()
  })

  test('獲取系統性能統計', async () => {
    console.log('開始測試獲取系統性能統計...')

    const response = await request(app)
      .get('/api/admin/system-performance-stats')
      .set('Authorization', `Bearer ${adminToken}`)

    console.log('回應狀態:', response.status)
    console.log('回應內容:', response.body)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toBeDefined()
    expect(response.body.data.memory).toBeDefined()
    expect(response.body.data.cpu).toBeDefined()
  })

  test('獲取資料庫統計', async () => {
    console.log('開始測試獲取資料庫統計...')

    const response = await request(app)
      .get('/api/admin/database-stats')
      .set('Authorization', `Bearer ${adminToken}`)

    console.log('回應狀態:', response.status)
    console.log('回應內容:', response.body)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toBeDefined()
    expect(response.body.data.database).toBeDefined()
    expect(response.body.data.collectionsCount).toBeDefined()
  })
})
