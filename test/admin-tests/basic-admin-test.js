import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import '../../config/loadEnv.js'

// 安全檢查：確保不會在生產環境運行測試
const checkEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const mongoUri = process.env.MONGO_URI || ''

  // 如果連接到生產資料庫，拒絕運行測試
  if (mongoUri.includes('production') || mongoUri.includes('prod')) {
    throw new Error('❌ 安全警告：檢測到生產資料庫連接，測試已停止執行！')
  }

  console.log(`🔒 環境檢查通過：${nodeEnv}`)
  console.log(`📊 資料庫：${mongoUri}`)
}

// 簡單的測試框架
const test = (name, fn) => {
  console.log(`🧪 ${name}`)
  return fn()
}

const expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(`期望 ${expected}，但得到 ${actual}`)
    }
  },
  toBeDefined: () => {
    if (actual === undefined || actual === null) {
      throw new Error(`期望有值，但得到 ${actual}`)
    }
  },
  toHaveLength: (expected) => {
    if (actual.length !== expected) {
      throw new Error(`期望長度 ${expected}，但得到 ${actual.length}`)
    }
  },
})

// 測試主函數
const runTests = async () => {
  let adminUser, adminToken

  console.log('🚀 開始管理員路由測試...')

  try {
    // 環境安全檢查
    checkEnvironment()

    // 使用現有的資料庫連接
    console.log('📦 使用現有資料庫連接')

    // 清理測試資料
    console.log('🧹 清理測試資料...')
    await User.deleteMany({ username: { $regex: /^admin_test_/ } })

    // 建立測試管理員用戶
    const timestamp = Date.now().toString().slice(-8)
    const adminUsername = `admin_test_${timestamp}`
    const adminEmail = `admin_${timestamp}@test.com`

    adminUser = await User.create({
      username: adminUsername,
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
      status: 'active',
      is_verified: true,
    })

    console.log('管理員用戶創建成功:', adminUser._id, adminUser.username, adminUser.role)

    // 取得管理員認證 token
    const loginResponse = await request(app).post('/api/users/login').send({
      login: adminEmail,
      password: 'admin123',
    })

    console.log('登入響應:', loginResponse.status, loginResponse.body)

    if (loginResponse.status !== 200) {
      throw new Error(`登入失敗: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`)
    }

    adminToken = loginResponse.body.token
    console.log('✅ 管理員 token 已獲取')

    // 開始測試
    console.log('\n=== 權限測試 ===')

    await test('管理員用戶可以訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      console.log('✅ 管理員權限測試通過')
    })

    await test('未認證用戶無法訪問管理員路由', async () => {
      const response = await request(app).get('/api/admin/count-statistics')

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      console.log('✅ 未認證權限測試通過')
    })

    console.log('\n=== 基本功能測試 ===')

    await test('獲取計數統計', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memes).toBeDefined()
      expect(response.body.data.users).toBeDefined()
      console.log('✅ 計數統計測試通過')
    })

    await test('獲取維護狀態', async () => {
      const response = await request(app)
        .get('/api/admin/maintenance-status')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      console.log('✅ 維護狀態測試通過')
    })

    await test('獲取系統性能統計', async () => {
      const response = await request(app)
        .get('/api/admin/system-performance-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memory).toBeDefined()
      expect(response.body.data.cpu).toBeDefined()
      expect(response.body.data.uptime).toBeDefined()
      expect(response.body.data.platform).toBeDefined()
      console.log('✅ 系統性能統計測試通過')
    })

    await test('獲取資料庫統計', async () => {
      const response = await request(app)
        .get('/api/admin/database-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.database).toBeDefined()
      expect(response.body.data.collectionsCount).toBeDefined()
      expect(response.body.data.dataSize).toBeDefined()
      expect(response.body.data.storageSize).toBeDefined()
      console.log('✅ 資料庫統計測試通過')
    })

    console.log('\n=== 系統維護功能測試 ===')

    await test('清理過期快取', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup-expired-cache')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      console.log('✅ 清理過期快取測試通過')
    })

    await test('重建資料庫索引', async () => {
      const response = await request(app)
        .post('/api/admin/rebuild-indexes')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.results).toBeDefined()
      console.log('✅ 重建資料庫索引測試通過')
    })

    console.log('\n=== 測試工具功能 ===')

    await test('創建測試報告', async () => {
      const response = await request(app)
        .post('/api/admin/create-test-reports')
        .set('Authorization', `Bearer ${adminToken}`)

      console.log('📊 回應狀態:', response.status)
      console.log('📊 回應內容:', JSON.stringify(response.body, null, 2))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      console.log('✅ 創建測試報告測試通過')
    })

    console.log('\n🎉 所有測試通過！')
  } catch (error) {
    console.error('❌ 測試失敗:', error.message)
    throw error
  } finally {
    // 清理測試資料
    try {
      if (adminUser) {
        await User.deleteMany({ username: { $regex: /^admin_test_/ } })
        console.log('🧹 測試資料已清理')
      }
    } catch (cleanupError) {
      console.error('⚠️ 清理測試資料失敗:', cleanupError.message)
    }
  }
}

// 執行測試
runTests().catch((error) => {
  console.error('❌ 測試執行失敗:', error)
  process.exit(1)
})
