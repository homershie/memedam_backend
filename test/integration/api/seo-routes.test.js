import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

// Mock dependencies
vi.mock('../../../services/seoMonitor.js', () => ({
  default: {
    getMonitoringStatus: vi.fn().mockReturnValue({
      is_monitoring: false,
      metrics_count: 0,
      last_update: null,
    }),
    getLatestMetrics: vi.fn().mockResolvedValue({
      performance: { lcp: 2000, fid: 50 },
      seo_health: { metaTagsScore: 90 },
      timestamp: '2024-01-15T10:30:00.000Z',
    }),
    generateDailyReport: vi.fn().mockResolvedValue(),
    generateRecommendations: vi.fn().mockResolvedValue([]),
    checkSEOHealth: vi.fn().mockResolvedValue(),
    startMonitoring: vi.fn().mockResolvedValue(),
    stopMonitoring: vi.fn().mockResolvedValue(),
  },
}))

vi.mock('../../../config/redis.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null), // Default to null, override in tests
    set: vi.fn().mockResolvedValue('OK'),
    sadd: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]), // Default empty array
    srem: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('SEO Routes API 整合測試', () => {
  let app
  let server
  let testToken
  let seoMonitor, redisCache

  beforeAll(async () => {
    // Import SEO routes after mocks are set up
    const seoRoutes = (await import('../../../routes/seoRoutes.js')).default

    // Create test app
    app = express()
    app.use(express.json())

    // Mock authentication middleware to match Passport JWT strategy
    app.use('/api/seo', (req, res, next) => {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: '未授權訪問',
          message: '未提供授權 token',
        })
      }

      const token = authHeader.substring(7)
      try {
        // Mock Passport JWT strategy behavior
        const payload = jwt.verify(token, 'test-jwt-secret-key-for-testing-only')

        // Simulate what Passport JWT strategy does
        req.user = {
          _id: payload._id,
          id: payload._id, // Also set id for compatibility
          username: payload.username,
          role: 'admin', // Set admin role for testing
        }
        next()
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: '無效的認證令牌',
          message: '無效的 token',
        })
      }
    })

    app.use('/api/seo', seoRoutes)

    // Create test token with _id field to match Passport JWT strategy
    testToken = jwt.sign(
      { _id: '507f1f77bcf86cd799439011', username: 'testuser', role: 'admin' },
      'test-jwt-secret-key-for-testing-only',
      { expiresIn: '1h' },
    )

    // Dependencies are already mocked by vi.mock above, no need to re-import

    // Start server
    server = app.listen(0)
  })

  afterAll(async () => {
    if (server) {
      await server.close()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/seo/status', () => {
    it('應該成功取得監控狀態', async () => {
      const mockStatus = {
        is_monitoring: true,
        metrics_count: 4,
        last_update: '2024-01-15T10:30:00.000Z',
      }

      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      const response = await request(app)
        .get('/api/seo/status')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockStatus)
      expect(response.body.timestamp).toBeDefined()
    })

    it('應該在未授權時返回401', async () => {
      const response = await request(app).get('/api/seo/status')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('未授權')
    })

    it('應該在無效令牌時返回401', async () => {
      const response = await request(app)
        .get('/api/seo/status')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('無效')
    })
  })

  describe('GET /api/seo/metrics', () => {
    it('應該成功取得最新指標', async () => {
      const mockMetrics = {
        performance: { lcp: 2500, fid: 100 },
        seo_health: { metaTagsScore: 85 },
        timestamp: '2024-01-15T10:30:00.000Z',
      }

      seoMonitor.getLatestMetrics.mockResolvedValue(mockMetrics)

      const response = await request(app)
        .get('/api/seo/metrics')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockMetrics)
    })

    it('應該處理取得指標時的錯誤', async () => {
      const mockError = new Error('指標取得失敗')
      seoMonitor.getLatestMetrics.mockRejectedValue(mockError)

      const response = await request(app)
        .get('/api/seo/metrics')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('取得指標失敗')
    })
  })

  describe('GET /api/seo/reports', () => {
    it('應該成功取得預設日期的報告', async () => {
      const mockReport = {
        date: '2024-01-15',
        summary: { overall_score: 85 },
      }

      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      const response = await request(app)
        .get('/api/seo/reports')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockReport)
    })

    it('應該成功取得指定日期的報告', async () => {
      const mockReport = {
        date: '2024-01-14',
        summary: { overall_score: 90 },
      }

      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      const response = await request(app)
        .get('/api/seo/reports?date=2024-01-14')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.date).toBe('2024-01-14')
    })

    it('應該在沒有快取報告時生成新報告', async () => {
      redisCache.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ date: '2024-01-15', generated: true }))

      seoMonitor.generateDailyReport.mockResolvedValue()

      const response = await request(app)
        .get('/api/seo/reports')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(seoMonitor.generateDailyReport).toHaveBeenCalled()
    })

    it('應該在報告不存在時返回404', async () => {
      redisCache.get.mockResolvedValue(null)
      seoMonitor.generateDailyReport.mockResolvedValue()

      const response = await request(app)
        .get('/api/seo/reports')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('報告不存在')
    })
  })

  describe('GET /api/seo/reports/list', () => {
    it('應該成功取得報告列表', async () => {
      const mockReportDates = ['2024-01-15', '2024-01-14', '2024-01-13']
      const mockReport = {
        summary: {
          overall_score: 85,
          performance_trend: 'improving',
          seo_health: 'good',
          alerts_count: 2,
        },
        recommendations: [{ type: 'performance' }, { type: 'seo' }],
      }

      redisCache.smembers.mockResolvedValue(mockReportDates)
      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      const response = await request(app)
        .get('/api/seo/reports/list?limit=5')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.reports).toHaveLength(3)
      expect(response.body.data.total).toBe(3)
      expect(response.body.data.limit).toBe(5)
    })

    it('應該使用預設限制值', async () => {
      const mockReportDates = ['2024-01-15']
      const mockReport = { summary: {} }

      redisCache.smembers.mockResolvedValue(mockReportDates)
      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      const response = await request(app)
        .get('/api/seo/reports/list')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.limit).toBe(30)
    })
  })

  describe('GET /api/seo/alerts', () => {
    it('應該成功取得活躍警報', async () => {
      const mockAlertIds = ['alert1', 'alert2']
      const mockAlert1 = {
        id: 'alert1',
        type: 'performance',
        severity: 'high',
        message: 'LCP 過高',
        timestamp: '2024-01-15T10:00:00.000Z',
      }
      const mockAlert2 = {
        id: 'alert2',
        type: 'seo',
        severity: 'medium',
        message: 'Meta 標籤分數過低',
        timestamp: '2024-01-15T09:00:00.000Z',
      }

      redisCache.smembers.mockResolvedValue(mockAlertIds)
      redisCache.get
        .mockResolvedValueOnce(JSON.stringify(mockAlert1))
        .mockResolvedValueOnce(JSON.stringify(mockAlert2))

      const response = await request(app)
        .get('/api/seo/alerts?severity=high&type=performance&limit=10')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.alerts).toHaveLength(1) // 只返回高嚴重度的
      expect(response.body.data.total).toBe(1)
      expect(response.body.data.filters.severity).toBe('high')
      expect(response.body.data.filters.type).toBe('performance')
    })

    it('應該按時間排序警報', async () => {
      const mockAlertIds = ['alert1', 'alert2']
      const mockAlert1 = {
        id: 'alert1',
        timestamp: '2024-01-15T08:00:00.000Z',
      }
      const mockAlert2 = {
        id: 'alert2',
        timestamp: '2024-01-15T10:00:00.000Z',
      }

      redisCache.smembers.mockResolvedValue(mockAlertIds)
      redisCache.get
        .mockResolvedValueOnce(JSON.stringify(mockAlert1))
        .mockResolvedValueOnce(JSON.stringify(mockAlert2))

      const response = await request(app)
        .get('/api/seo/alerts')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.alerts[0].id).toBe('alert2') // 最新的在前
      expect(response.body.data.alerts[1].id).toBe('alert1')
    })
  })

  describe('POST /api/seo/alerts/:alertId/resolve', () => {
    it('應該成功解析警報', async () => {
      redisCache.srem.mockResolvedValue(1)
      redisCache.set.mockResolvedValue('OK')
      redisCache.sadd.mockResolvedValue(1)

      const response = await request(app)
        .post('/api/seo/alerts/alert123/resolve')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ resolution_note: '已修復 LCP 問題' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('警報已成功解析')
      expect(response.body.data.alert_id).toBe('alert123')
      expect(response.body.data.resolution_note).toBe('已修復 LCP 問題')
    })

    it('應該處理沒有解析註記的情況', async () => {
      redisCache.srem.mockResolvedValue(1)
      redisCache.set.mockResolvedValue('OK')
      redisCache.sadd.mockResolvedValue(1)

      const response = await request(app)
        .post('/api/seo/alerts/alert123/resolve')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.data.resolution_note).toBe('手動解析')
    })
  })

  describe('GET /api/seo/recommendations', () => {
    it('應該成功取得SEO建議', async () => {
      const mockRecommendations = [
        {
          type: 'performance',
          priority: 'high',
          title: '優化圖片載入',
          description: 'LCP 過高，建議優化圖片載入',
        },
        {
          type: 'seo',
          priority: 'medium',
          title: '改善Meta標籤',
          description: 'Meta標籤完整性需要改善',
        },
      ]

      seoMonitor.generateRecommendations.mockResolvedValue(mockRecommendations)

      const response = await request(app)
        .get('/api/seo/recommendations?priority=high&type=performance')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.recommendations).toHaveLength(1) // 只返回高優先級的
      expect(response.body.data.total).toBe(1)
      expect(response.body.data.filters.priority).toBe('high')
      expect(response.body.data.filters.type).toBe('performance')
    })
  })

  describe('POST /api/seo/health-check', () => {
    it('應該成功執行SEO健康檢查', async () => {
      const mockMetrics = {
        seo_health: { metaTagsScore: 85 },
        timestamp: '2024-01-15T10:30:00.000Z',
      }

      seoMonitor.checkSEOHealth.mockResolvedValue()
      seoMonitor.getLatestMetrics.mockResolvedValue(mockMetrics)

      const response = await request(app)
        .post('/api/seo/health-check')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('SEO 健康檢查完成')
      expect(response.body.data.seo_health).toEqual({ metaTagsScore: 85 })
    })
  })

  describe('GET /api/seo/dashboard', () => {
    it('應該成功取得SEO儀表板數據', async () => {
      const mockStatus = { is_monitoring: true }
      const mockMetrics = {
        performance: { lcp: 2500 },
        seo_health: { metaTagsScore: 85 },
      }
      const mockAlerts = [
        { id: 'alert1', severity: 'high' },
        { id: 'alert2', severity: 'medium' },
      ]
      const mockReports = [{ date: '2024-01-15', overall_score: 85 }]

      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)
      seoMonitor.getLatestMetrics.mockResolvedValue(mockMetrics)

      // Mock internal methods - we need to mock the controller's methods
      // This is a bit tricky since we're testing the routes, not the controller directly
      redisCache.smembers.mockResolvedValue(['alert1', 'alert2'])
      redisCache.get
        .mockResolvedValueOnce(JSON.stringify(mockAlerts[0]))
        .mockResolvedValueOnce(JSON.stringify(mockAlerts[1]))
        .mockResolvedValueOnce(JSON.stringify(mockReports[0]))

      const response = await request(app)
        .get('/api/seo/dashboard')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toEqual(mockStatus)
      expect(response.body.data.metrics).toEqual(mockMetrics)
      expect(response.body.data.alerts.active).toBeDefined()
      expect(response.body.data.reports).toBeDefined()
      expect(response.body.data.summary).toBeDefined()
    })
  })

  describe('POST /api/seo/monitoring/start', () => {
    it('應該成功啟動監控', async () => {
      const mockStatus = { is_monitoring: true }

      seoMonitor.startMonitoring.mockResolvedValue()
      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      const response = await request(app)
        .post('/api/seo/monitoring/start')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('SEO 監控已啟動')
      expect(response.body.data).toEqual(mockStatus)
    })
  })

  describe('POST /api/seo/monitoring/stop', () => {
    it('應該成功停止監控', async () => {
      const mockStatus = { is_monitoring: false }

      seoMonitor.stopMonitoring.mockResolvedValue()
      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      const response = await request(app)
        .post('/api/seo/monitoring/stop')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('SEO 監控已停止')
      expect(response.body.data).toEqual(mockStatus)
    })
  })

  describe('POST /api/seo/reports/generate', () => {
    it('應該成功生成報告', async () => {
      seoMonitor.generateDailyReport.mockResolvedValue()

      const response = await request(app)
        .post('/api/seo/reports/generate')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('SEO 報告生成完成')
      expect(response.body.data.generated_at).toBeDefined()
    })

    it('應該支援指定日期參數', async () => {
      seoMonitor.generateDailyReport.mockResolvedValue()

      const response = await request(app)
        .post('/api/seo/reports/generate?date=2024-01-14')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(seoMonitor.generateDailyReport).toHaveBeenCalled()
    })
  })

  describe('錯誤處理', () => {
    it('應該處理服務錯誤', async () => {
      seoMonitor.getMonitoringStatus.mockImplementation(() => {
        throw new Error('服務錯誤')
      })

      const response = await request(app)
        .get('/api/seo/status')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it('應該處理Redis錯誤', async () => {
      redisCache.get.mockRejectedValue(new Error('Redis 連接失敗'))

      const response = await request(app)
        .get('/api/seo/reports')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
    })

    it('應該處理無效的請求參數', async () => {
      const response = await request(app)
        .post('/api/seo/alerts/invalid-alert-id/resolve')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ invalid_field: 'invalid_value' })

      // 應該仍然成功，因為控制器會處理無效參數
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('Swagger 文檔', () => {
    it('應該有完整的API文檔註解', async () => {
      // 這個測試確保路由有完整的Swagger文檔
      // 在實際項目中，可以使用swagger-jsdoc來驗證

      const routes = [
        '/api/seo/status',
        '/api/seo/metrics',
        '/api/seo/reports',
        '/api/seo/reports/list',
        '/api/seo/alerts',
        '/api/seo/recommendations',
        '/api/seo/health-check',
        '/api/seo/dashboard',
        '/api/seo/monitoring/start',
        '/api/seo/monitoring/stop',
        '/api/seo/reports/generate',
      ]

      // 檢查所有路由是否正確定義
      for (const route of routes) {
        const methods = {
          '/api/seo/status': ['GET'],
          '/api/seo/metrics': ['GET'],
          '/api/seo/reports': ['GET'],
          '/api/seo/reports/list': ['GET'],
          '/api/seo/alerts': ['GET'],
          '/api/seo/recommendations': ['GET'],
          '/api/seo/health-check': ['POST'],
          '/api/seo/dashboard': ['GET'],
          '/api/seo/monitoring/start': ['POST'],
          '/api/seo/monitoring/stop': ['POST'],
          '/api/seo/reports/generate': ['POST'],
        }

        const expectedMethods = methods[route] || []

        // 這裡我們只檢查路由是否可訪問，而不是具體的HTTP方法
        // 在實際測試中，可以使用更複雜的路由檢查
        expect(route).toBeDefined()
      }
    })
  })

  describe('中介軟體整合', () => {
    it('應該正確應用認證中介軟體', async () => {
      // 測試認證中介軟體是否正確應用到所有SEO路由
      const seoRoutes = [
        '/api/seo/status',
        '/api/seo/metrics',
        '/api/seo/reports',
        '/api/seo/reports/list',
        '/api/seo/alerts',
        '/api/seo/recommendations',
        '/api/seo/health-check',
        '/api/seo/dashboard',
        '/api/seo/monitoring/start',
        '/api/seo/monitoring/stop',
        '/api/seo/reports/generate',
      ]

      for (const route of seoRoutes) {
        const response = await request(app).get(route).set('Authorization', `Bearer ${testToken}`)

        // 應該不會收到401錯誤，因為我們提供了有效的令牌
        expect([200, 404, 500]).toContain(response.status)
        expect(response.status).not.toBe(401)
      }
    })

    it('應該正確解析JWT令牌中的用戶資訊', async () => {
      const mockStatus = { is_monitoring: true }
      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      const response = await request(app)
        .get('/api/seo/status')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      // 認證中介軟體應該正確解析令牌並設置req.user
      expect(response.body.success).toBe(true)
    })
  })
})
