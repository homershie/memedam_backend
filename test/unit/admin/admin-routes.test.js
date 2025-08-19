import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'

// Mock 需在匯入 app 前宣告，確保路由載入時即生效
vi.mock('../../../utils/checkCounts.js', () => ({
  checkAndFixCounts: vi.fn().mockResolvedValue({ total: { checked: 10, fixed: 2 } }),
  batchCheckCounts: vi.fn().mockResolvedValue({ processed: 15 }),
  getCountStatistics: vi.fn().mockResolvedValue({ memes: { total: 1000 }, users: { total: 500 } }),
  checkAndFixUserCounts: vi.fn().mockResolvedValue({ checked: 5, fixed: 1 }),
}))
vi.mock('../../../utils/hotScoreScheduler.js', () => ({
  batchUpdateHotScores: vi.fn().mockResolvedValue({ updated: 10 }),
  scheduledHotScoreUpdate: vi.fn().mockResolvedValue({ processed: 5 }),
  getHotScoreStats: vi.fn().mockResolvedValue({ totalProcessed: 100, avgTime: 50 }),
}))
vi.mock('../../../utils/contentBasedScheduler.js', () => ({
  batchUpdateUserPreferences: vi.fn().mockResolvedValue({ updated: 5 }),
  scheduledContentBasedUpdate: vi.fn().mockResolvedValue({ processed: 8 }),
  getContentBasedStats: vi.fn().mockResolvedValue({ totalUsers: 50 }),
  updateContentBasedConfig: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('../../../utils/collaborativeFilteringScheduler.js', () => ({
  batchUpdateCollaborativeFilteringCache: vi.fn().mockResolvedValue({ updated: 3 }),
  scheduledCollaborativeFilteringUpdate: vi.fn().mockResolvedValue({ processed: 7 }),
  getCollaborativeFilteringStats: vi.fn().mockResolvedValue({ totalUsers: 40 }),
  updateCollaborativeFilteringConfig: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('../../../utils/maintenance.js', () => ({
  default: {
    getTasksStatus: vi.fn().mockReturnValue({ tasks: [], lastRun: new Date() }),
  },
}))
vi.mock('../../../utils/notificationScheduler.js', () => ({
  manualTriggers: {
    sendHotContentNotifications: vi.fn().mockResolvedValue({ sent: 15 }),
    sendWeeklySummaryNotifications: vi.fn().mockResolvedValue({ sent: 25 }),
    cleanupOldNotificationsTask: vi.fn().mockResolvedValue({ deletedNotifications: 50, deletedReceipts: 50 }),
  },
}))
vi.mock('../../../config/redis.js', () => ({
  default: {
    flushall: vi.fn().mockResolvedValue('OK'),
    info: vi.fn().mockResolvedValue('redis_version:6.2.0\r\nused_memory:1024000'),
  },
}))

import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('管理員路由測試 (Vitest)', () => {
  let adminUser, adminToken
  let testUser, testToken
  let testMeme

  beforeAll(async () => {
    adminUser = await createTestUser(User, { role: 'admin' })
    testUser = await createTestUser(User, { role: 'user' })
    testMeme = await createTestMeme(Meme, testUser._id, { title: 'Vitest 測試迷因' })

    const adminLoginResponse = await request(app).post('/api/users/login').send({
      login: adminUser.email,
      password: 'testpassword123',
    })
    adminToken = adminLoginResponse.body.token

    const userLoginResponse = await request(app).post('/api/users/login').send({
      login: testUser.email,
      password: 'testpassword123',
    })
    testToken = userLoginResponse.body.token
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme })
  })

  describe('權限測試', () => {
    it('管理員用戶可以訪問管理員路由', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
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
    })

    it('獲取計數統計', async () => {
      const response = await request(app)
        .get('/api/admin/count-statistics')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('系統監控功能', () => {
    it('獲取系統性能統計', async () => {
      const response = await request(app)
        .get('/api/admin/system-performance-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('獲取資料庫統計', async () => {
      const response = await request(app)
        .get('/api/admin/database-stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})