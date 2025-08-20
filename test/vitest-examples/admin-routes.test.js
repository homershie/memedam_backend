import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import Meme from '../../models/Meme.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../setup.js'

// Mock 排程與系統依賴，避免測試環境中的實際呼叫
vi.mock('../../utils/checkCounts.js', () => ({
  checkAndFixCounts: vi.fn().mockResolvedValue({
    total: { checked: 10, fixed: 2 },
    details: { likes: 5, comments: 3, views: 2 },
  }),
  batchCheckCounts: vi.fn().mockResolvedValue({ processed: 15 }),
  getCountStatistics: vi.fn().mockResolvedValue({
    memes: { total: 1000, public: 950 },
    users: { total: 500, active: 450 },
    interactions: { likes: 5000, comments: 2000 },
  }),
  checkAndFixUserCounts: vi.fn().mockResolvedValue({ checked: 5, fixed: 1 }),
}))
vi.mock('../../utils/hotScoreScheduler.js', () => ({
  batchUpdateHotScores: vi.fn().mockResolvedValue({ updated: 10 }),
  scheduledHotScoreUpdate: vi.fn().mockResolvedValue({ processed: 5 }),
  getHotScoreStats: vi.fn().mockResolvedValue({ totalProcessed: 100, avgTime: 50 }),
}))

vi.mock('../../utils/contentBasedScheduler.js', () => ({
  batchUpdateUserPreferences: vi.fn().mockResolvedValue({ updated: 5 }),
  scheduledContentBasedUpdate: vi.fn().mockResolvedValue({ processed: 8 }),
  getContentBasedStats: vi.fn().mockResolvedValue({ totalUsers: 50 }),
  updateContentBasedConfig: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('../../utils/collaborativeFilteringScheduler.js', () => ({
  batchUpdateCollaborativeFilteringCache: vi.fn().mockResolvedValue({ updated: 3 }),
  scheduledCollaborativeFilteringUpdate: vi.fn().mockResolvedValue({ processed: 7 }),
  getCollaborativeFilteringStats: vi.fn().mockResolvedValue({ totalUsers: 40 }),
  updateCollaborativeFilteringConfig: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('../../services/maintenanceScheduler.js', () => ({
  default: {
    getMaintenanceStatus: vi.fn().mockResolvedValue({
      isInMaintenance: false,
      scheduledMaintenance: null,
      lastMaintenance: new Date(),
    }),
  },
}))

vi.mock('../../services/notificationScheduler.js', () => ({
  manualTriggers: {
    sendHotContentNotifications: vi.fn().mockResolvedValue({ sent: 15 }),
    sendWeeklySummaryNotifications: vi.fn().mockResolvedValue({ sent: 25 }),
    cleanupOldNotificationsTask: vi.fn().mockResolvedValue({ deletedNotifications: 50, deletedReceipts: 50 }),
  },
}))

vi.mock('../../services/recommendationScheduler.js', () => ({
  updateAllRecommendationSystems: vi.fn().mockResolvedValue({ updated: 'all' }),
  getRecommendationSystemStatus: vi.fn().mockResolvedValue({
    status: 'active',
    lastUpdate: new Date(),
    systems: ['hot', 'content-based', 'collaborative'],
  }),
  updateRecommendationConfig: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock 系統統計與監控
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    connection: {
      ...actual.connection,
      db: {
        stats: vi.fn().mockResolvedValue({
          collections: 10,
          objects: 1000,
          dataSize: 5000000,
          storageSize: 10000000,
          indexes: 15,
        }),
        admin: vi.fn().mockReturnValue({
          buildInfo: vi.fn().mockResolvedValue({ version: '5.0.0' }),
        }),
      },
    },
  }
})

vi.mock('../../config/redis.js', () => ({
  default: {
    flushall: vi.fn().mockResolvedValue('OK'),
    info: vi.fn().mockResolvedValue('redis_version:6.2.0\r\nused_memory:1024000'),
  },
}))

describe('管理員路由測試 (Vitest)', () => {
  let adminUser, adminToken
  let testUser, testToken
  let testMeme

  beforeAll(async () => {
    // 創建測試管理員用戶（使用帶時間戳的預設隨機帳號避免重複鍵）
    adminUser = await createTestUser(User, {
      role: 'admin',
    })

    // 創建測試普通用戶
    testUser = await createTestUser(User, {
      role: 'user',
    })

    // 創建測試迷因
    testMeme = await createTestMeme(Meme, testUser._id, {
      title: 'Vitest 測試迷因',
    })

    // 獲取管理員 token
    const adminLoginResponse = await request(app).post('/api/users/login').send({
      login: adminUser.email,
      password: 'testpassword123',
    })

    adminToken = adminLoginResponse.body.token

    // 獲取普通用戶 token
    const userLoginResponse = await request(app).post('/api/users/login').send({
      login: testUser.email,
      password: 'testpassword123',
    })

    testToken = userLoginResponse.body.token
  })

  afterAll(async () => {
    // 清理測試數據
    await cleanupTestData({ User, Meme })
  })

  describe('權限測試', () => {
    it('管理員用戶可以訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    it('非管理員用戶無法訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
    })

    it('未認證用戶無法訪問管理員路由', async () => {
      const response = await request(app).get('/api/admin/count-statistics')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })

  describe('計數檢查功能', () => {
    it('檢查單一迷因計數', async () => {
      const response = await request(app)
        .post(`/api/admin/check-counts/${testMeme._id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.total).toBeDefined()
    })

    it('獲取計數統計', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memes).toBeDefined()
      expect(response.body.data.users).toBeDefined()
    })
  })

  describe('系統監控功能', () => {
    it('獲取系統性能統計', async () => {
      const response = await request(app)
        .get('/api/admin/system-performance-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.memory).toBeDefined()
      expect(response.body.data.cpu).toBeDefined()
      expect(response.body.data.uptime).toBeDefined()
    })

    it('獲取資料庫統計', async () => {
      const response = await request(app)
        .get('/api/admin/database-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.database).toBeDefined()
      expect(response.body.data.collectionsCount).toBeDefined()
    })
  })
})
