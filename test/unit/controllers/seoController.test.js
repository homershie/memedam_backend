import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import seoController from '../../../controllers/seoController.js'

// Mock dependencies
vi.mock('../../../services/seoMonitor.js', () => ({
  default: {
    getMonitoringStatus: vi.fn(),
    getLatestMetrics: vi.fn(),
    generateDailyReport: vi.fn(),
    generateRecommendations: vi.fn(),
    checkSEOHealth: vi.fn(),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
  },
}))

vi.mock('../../../config/redis.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    srem: vi.fn(),
    scard: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('SEO Controller', () => {
  let req, res, next
  let seoMonitor, redisCache

  beforeEach(async () => {
    vi.clearAllMocks()

    // Import mocked dependencies
    const seoMonitorModule = await import('../../../services/seoMonitor.js')
    seoMonitor = seoMonitorModule.default

    const redisModule = await import('../../../config/redis.js')
    redisCache = redisModule.default

    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 'user123' },
      headers: {},
    }

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }

    next = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getMonitoringStatus', () => {
    it('應該成功取得監控狀態', async () => {
      const mockStatus = {
        is_monitoring: true,
        metrics_count: 4,
        last_update: '2024-01-15T10:30:00.000Z',
      }

      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      await seoController.getMonitoringStatus(req, res)

      expect(seoMonitor.getMonitoringStatus).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus,
        timestamp: expect.any(String),
      })
    })

    it('應該處理取得狀態時的錯誤', async () => {
      const mockError = new Error('監控狀態錯誤')
      seoMonitor.getMonitoringStatus.mockImplementation(() => {
        throw mockError
      })

      await seoController.getMonitoringStatus(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '取得監控狀態失敗',
        message: '監控狀態錯誤',
      })
    })
  })

  describe('getLatestMetrics', () => {
    it('應該成功取得最新指標', async () => {
      const mockMetrics = {
        performance: { lcp: 2500, fid: 100 },
        seo_health: { metaTagsScore: 85 },
        timestamp: '2024-01-15T10:30:00.000Z',
      }

      seoMonitor.getLatestMetrics.mockResolvedValue(mockMetrics)

      await seoController.getLatestMetrics(req, res)

      expect(seoMonitor.getLatestMetrics).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics,
      })
    })

    it('應該處理取得指標時的錯誤', async () => {
      const mockError = new Error('指標取得失敗')
      seoMonitor.getLatestMetrics.mockRejectedValue(mockError)

      await seoController.getLatestMetrics(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '取得指標失敗',
        message: '指標取得失敗',
      })
    })
  })

  describe('getSEOReport', () => {
    it('應該成功取得預設日期的報告', async () => {
      req.query = {}
      const today = new Date().toISOString().split('T')[0]
      const mockReport = {
        date: today,
        summary: { overall_score: 85 },
      }

      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      await seoController.getSEOReport(req, res)

      expect(redisCache.get).toHaveBeenCalledWith(`seo:report:${today}`)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport,
      })
    })

    it('應該成功取得指定日期的報告', async () => {
      req.query = { date: '2024-01-14' }
      const mockReport = {
        date: '2024-01-14',
        summary: { overall_score: 90 },
      }

      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      await seoController.getSEOReport(req, res)

      expect(redisCache.get).toHaveBeenCalledWith('seo:report:2024-01-14')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport,
      })
    })

    it('應該在沒有快取報告時生成新報告', async () => {
      req.query = { date: '2024-01-15' }

      // 第一次調用返回 null，第二次返回生成的報告
      redisCache.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ date: '2024-01-15', generated: true }))

      seoMonitor.generateDailyReport.mockResolvedValue()

      await seoController.getSEOReport(req, res)

      expect(seoMonitor.generateDailyReport).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { date: '2024-01-15', generated: true },
      })
    })

    it('應該在報告不存在時返回404', async () => {
      req.query = { date: '2024-01-15' }

      redisCache.get.mockResolvedValue(null)
      seoMonitor.generateDailyReport.mockResolvedValue()

      await seoController.getSEOReport(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '報告不存在',
      })
    })
  })

  describe('getSEOReportsList', () => {
    it('應該成功取得報告列表', async () => {
      req.query = { limit: 5 }
      const mockReportDates = ['2024-01-15', '2024-01-14', '2024-01-13']
      const mockReport = {
        summary: { overall_score: 85, performance_trend: 'improving' },
        recommendations: [{ type: 'performance' }],
      }

      redisCache.smembers.mockResolvedValue(mockReportDates)
      redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

      await seoController.getSEOReportsList(req, res)

      expect(redisCache.smembers).toHaveBeenCalledWith('seo:reports')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          reports: expect.any(Array),
          total: 3,
          limit: 5,
        },
      })
    })

    it('應該使用預設限制值', async () => {
      req.query = {}
      const mockReportDates = ['2024-01-15']

      redisCache.smembers.mockResolvedValue(mockReportDates)
      redisCache.get.mockResolvedValue(JSON.stringify({ summary: {} }))

      await seoController.getSEOReportsList(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          limit: 30,
        }),
      })
    })
  })

  describe('getActiveAlerts', () => {
    it('應該成功取得活躍警報', async () => {
      req.query = { limit: 10, severity: 'high' }
      const mockAlertIds = ['alert1', 'alert2']
      const mockAlert = {
        id: 'alert1',
        type: 'performance',
        severity: 'high',
        message: 'LCP 過高',
      }

      redisCache.smembers.mockResolvedValue(mockAlertIds)
      redisCache.get.mockResolvedValue(JSON.stringify(mockAlert))

      await seoController.getActiveAlerts(req, res)

      expect(redisCache.smembers).toHaveBeenCalledWith('seo:active_alerts')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          alerts: expect.any(Array),
          total: expect.any(Number),
          filters: { severity: 'high', type: undefined },
        },
      })
    })

    it('應該應用類型篩選', async () => {
      req.query = { type: 'seo' }
      const mockAlertIds = ['alert1']
      const mockAlert = {
        id: 'alert1',
        type: 'seo',
        severity: 'medium',
      }

      redisCache.smembers.mockResolvedValue(mockAlertIds)
      redisCache.get.mockResolvedValue(JSON.stringify(mockAlert))

      await seoController.getActiveAlerts(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          filters: { severity: undefined, type: 'seo' },
        }),
      })
    })

    it('應該按時間排序警報', async () => {
      req.query = {}
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

      await seoController.getActiveAlerts(req, res)

      const responseData = res.json.mock.calls[0][0].data
      expect(responseData.alerts[0].id).toBe('alert2') // 最新的在前
      expect(responseData.alerts[1].id).toBe('alert1')
    })
  })

  describe('resolveAlert', () => {
    it('應該成功解析警報', async () => {
      req.params = { alertId: 'alert123' }
      req.body = { resolution_note: '已修復 LCP 問題' }

      redisCache.srem.mockResolvedValue(1)
      redisCache.set.mockResolvedValue('OK')
      redisCache.sadd.mockResolvedValue(1)

      await seoController.resolveAlert(req, res)

      expect(redisCache.srem).toHaveBeenCalledWith('seo:active_alerts', 'alert123')
      expect(redisCache.set).toHaveBeenCalledWith(
        'seo:resolved_alert:alert123',
        expect.any(String),
        2592000, // 30 天
      )
      expect(redisCache.sadd).toHaveBeenCalledWith('seo:resolved_alerts', 'alert123')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '警報已成功解析',
        data: expect.objectContaining({
          alert_id: 'alert123',
          resolution_note: '已修復 LCP 問題',
        }),
      })
    })

    it('應該處理沒有解析註記的情況', async () => {
      req.params = { alertId: 'alert123' }
      req.body = {}

      redisCache.srem.mockResolvedValue(1)
      redisCache.set.mockResolvedValue('OK')
      redisCache.sadd.mockResolvedValue(1)

      await seoController.resolveAlert(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '警報已成功解析',
        data: expect.objectContaining({
          resolution_note: '手動解析',
        }),
      })
    })
  })

  describe('getSEORecommendations', () => {
    it('應該成功取得SEO建議', async () => {
      req.query = { priority: 'high', type: 'performance' }
      const mockRecommendations = [
        {
          type: 'performance',
          priority: 'high',
          title: '優化圖片載入',
        },
        {
          type: 'seo',
          priority: 'medium',
          title: '改善Meta標籤',
        },
      ]

      seoMonitor.generateRecommendations.mockResolvedValue(mockRecommendations)

      await seoController.getSEORecommendations(req, res)

      expect(seoMonitor.generateRecommendations).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          recommendations: [mockRecommendations[0]], // 只返回高優先級的
          total: 1,
          filters: { priority: 'high', type: 'performance' },
        },
      })
    })

    it('應該應用類型篩選', async () => {
      req.query = { type: 'seo' }
      const mockRecommendations = [
        { type: 'performance', priority: 'high' },
        { type: 'seo', priority: 'medium' },
      ]

      seoMonitor.generateRecommendations.mockResolvedValue(mockRecommendations)

      await seoController.getSEORecommendations(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          recommendations: [mockRecommendations[1]], // 只返回SEO類型的
          total: 1,
          filters: { priority: undefined, type: 'seo' },
        },
      })
    })
  })

  describe('runSEOHealthCheck', () => {
    it('應該成功執行SEO健康檢查', async () => {
      const mockMetrics = {
        seo_health: { metaTagsScore: 85 },
        timestamp: '2024-01-15T10:30:00.000Z',
      }

      seoMonitor.checkSEOHealth.mockResolvedValue()
      seoMonitor.getLatestMetrics.mockResolvedValue(mockMetrics)

      await seoController.runSEOHealthCheck(req, res)

      expect(seoMonitor.checkSEOHealth).toHaveBeenCalled()
      expect(seoMonitor.getLatestMetrics).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'SEO 健康檢查完成',
        data: {
          seo_health: { metaTagsScore: 85 },
          timestamp: expect.any(String),
        },
      })
    })
  })

  describe('getSEODashboard', () => {
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

      // Mock private methods
      const getActiveAlertsData = vi.spyOn(seoController, 'getActiveAlertsData')
      getActiveAlertsData.mockResolvedValue(mockAlerts)

      const getRecentReportsData = vi.spyOn(seoController, 'getRecentReportsData')
      getRecentReportsData.mockResolvedValue(mockReports)

      await seoController.getSEODashboard(req, res)

      expect(seoMonitor.getMonitoringStatus).toHaveBeenCalled()
      expect(seoMonitor.getLatestMetrics).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: mockStatus,
          metrics: mockMetrics,
          alerts: {
            active: mockAlerts,
            count: 2,
          },
          reports: mockReports,
          summary: {
            overall_score: expect.any(Number),
            health_status: expect.any(String),
            last_update: expect.any(String),
          },
        },
      })

      getActiveAlertsData.mockRestore()
      getRecentReportsData.mockRestore()
    })
  })

  describe('startMonitoring', () => {
    it('應該成功啟動監控', async () => {
      const mockStatus = { is_monitoring: true }

      seoMonitor.startMonitoring.mockResolvedValue()
      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      await seoController.startMonitoring(req, res)

      expect(seoMonitor.startMonitoring).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'SEO 監控已啟動',
        data: mockStatus,
      })
    })
  })

  describe('stopMonitoring', () => {
    it('應該成功停止監控', async () => {
      const mockStatus = { is_monitoring: false }

      seoMonitor.stopMonitoring.mockResolvedValue()
      seoMonitor.getMonitoringStatus.mockReturnValue(mockStatus)

      await seoController.stopMonitoring(req, res)

      expect(seoMonitor.stopMonitoring).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'SEO 監控已停止',
        data: mockStatus,
      })
    })
  })

  describe('generateReport', () => {
    it('應該成功生成報告', async () => {
      seoMonitor.generateDailyReport.mockResolvedValue()

      await seoController.generateReport(req, res)

      expect(seoMonitor.generateDailyReport).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'SEO 報告生成完成',
        data: {
          generated_at: expect.any(String),
        },
      })
    })
  })

  describe('私有方法測試', () => {
    describe('getActiveAlertsData', () => {
      it('應該成功取得活躍警報數據', async () => {
        const mockAlertIds = ['alert1', 'alert2']
        const mockAlert = { id: 'alert1', message: '測試警報' }

        redisCache.smembers.mockResolvedValue(mockAlertIds)
        redisCache.get.mockResolvedValue(JSON.stringify(mockAlert))

        const result = await seoController.getActiveAlertsData()

        expect(result).toHaveLength(2)
        expect(result[0]).toEqual(mockAlert)
      })

      it('應該限制返回的警報數量', async () => {
        const mockAlertIds = Array.from({ length: 15 }, (_, i) => `alert${i}`)
        const mockAlert = { id: 'alert0', message: '測試警報' }

        redisCache.smembers.mockResolvedValue(mockAlertIds)
        redisCache.get.mockResolvedValue(JSON.stringify(mockAlert))

        const result = await seoController.getActiveAlertsData()

        expect(result).toHaveLength(10) // 限制為10個
      })
    })

    describe('getRecentReportsData', () => {
      it('應該成功取得最近報告數據', async () => {
        const mockReportDates = [
          '2024-01-15',
          '2024-01-14',
          '2024-01-13',
          '2024-01-12',
          '2024-01-11',
          '2024-01-10',
          '2024-01-09',
        ]
        const mockReport = {
          summary: {
            overall_score: 85,
            performance_trend: 'improving',
            seo_health: 'good',
          },
        }

        redisCache.smembers.mockResolvedValue(mockReportDates)
        redisCache.get.mockResolvedValue(JSON.stringify(mockReport))

        const result = await seoController.getRecentReportsData()

        expect(result).toHaveLength(7) // 最近7天
        expect(result[0]).toEqual({
          date: '2024-01-15',
          overall_score: 85,
          performance_trend: 'improving',
          seo_health: 'good',
        })
      })
    })

    describe('calculateOverallScore', () => {
      it('應該正確計算整體分數', () => {
        const mockMetrics = {
          performance: { lcp: 2000, fid: 50, cls: 0.05 },
          seo_health: { metaTagsScore: 90, structuredDataScore: 85, mobileFriendliness: 95 },
          search_engine: { indexingRate: 95 },
        }

        const score = seoController.calculateOverallScore(mockMetrics)

        expect(typeof score).toBe('number')
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      })

      it('應該處理缺少指標的情況', () => {
        const mockMetrics = {}

        const score = seoController.calculateOverallScore(mockMetrics)

        expect(score).toBe(0)
      })
    })

    describe('determineHealthStatus', () => {
      it('應該根據分數和警報確定健康狀態', () => {
        const mockMetrics = {
          performance: { lcp: 2000 },
          seo_health: { metaTagsScore: 90 },
        }
        const mockAlerts = [{ severity: 'high' }, { severity: 'medium' }]

        const status = seoController.determineHealthStatus(mockMetrics, mockAlerts)

        expect(['excellent', 'good', 'fair', 'poor']).toContain(status)
      })

      it('應該在沒有高嚴重度警報時返回更高狀態', () => {
        const mockMetrics = {
          performance: { lcp: 2000 },
          seo_health: { metaTagsScore: 95 },
        }
        const mockAlerts = [{ severity: 'low' }, { severity: 'info' }]

        const status = seoController.determineHealthStatus(mockMetrics, mockAlerts)

        expect(status).toBe('good') // 73 分且沒有高嚴重度警報應該是 'good'
      })
    })
  })
})
