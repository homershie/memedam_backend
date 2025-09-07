import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import seoMonitor from '../../../services/seoMonitor.js'

// Mock dependencies
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
    debug: vi.fn(),
  },
}))

describe('SEO Monitor 服務整合測試', () => {
  vi.setConfig({ testTimeout: 10000 }) // 10 秒超時

  let redisCache

  beforeAll(async () => {
    // Import mocked Redis
    const redisModule = await import('../../../config/redis.js')
    redisCache = redisModule.default
  })

  afterAll(async () => {
    // 停止監控以清理資源
    await seoMonitor.stopMonitoring()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    // 重置監控器狀態
    seoMonitor.isMonitoring = false
    seoMonitor.metrics = new Map()

    // 重新初始化指標
    seoMonitor.initializeMetrics()
  })

  afterEach(async () => {
    // 清理測試後的狀態
    await seoMonitor.stopMonitoring()
    vi.clearAllMocks()
  })

  describe('基本初始化和狀態管理', () => {
    it('應該正確初始化SEO監控器', () => {
      expect(seoMonitor).toBeDefined()
      expect(seoMonitor.cachePrefix).toBe('seo:')
      expect(seoMonitor.isMonitoring).toBe(false)
      expect(seoMonitor.alertThresholds).toBeDefined()
      expect(seoMonitor.metrics).toBeInstanceOf(Map)
    })

    it('應該正確初始化指標結構', () => {
      expect(seoMonitor.metrics.has('performance')).toBe(true)
      expect(seoMonitor.metrics.has('seo')).toBe(true)
      expect(seoMonitor.metrics.has('searchEngine')).toBe(true)
      expect(seoMonitor.metrics.has('userExperience')).toBe(true)
    })

    it('應該正確初始化警報閾值', () => {
      const thresholds = seoMonitor.alertThresholds

      expect(thresholds.lcp).toBe(2500)
      expect(thresholds.fid).toBe(100)
      expect(thresholds.cls).toBe(0.1)
      expect(thresholds.metaTagsScore).toBe(80)
      expect(thresholds.structuredDataScore).toBe(70)
      expect(thresholds.mobileFriendliness).toBe(85)
      expect(thresholds.indexingRate).toBe(95)
    })
  })

  describe('監控啟動和停止', () => {
    it('應該成功啟動SEO監控', async () => {
      redisCache.set.mockResolvedValue('OK')

      await seoMonitor.startMonitoring()

      expect(seoMonitor.isMonitoring).toBe(true)
      expect(seoMonitor.metrics.size).toBeGreaterThan(0)
    })

    it('應該在已經運行時不重複啟動', async () => {
      seoMonitor.isMonitoring = true

      await seoMonitor.startMonitoring()

      expect(seoMonitor.isMonitoring).toBe(true)
    })

    it('應該成功停止SEO監控', async () => {
      seoMonitor.isMonitoring = true

      await seoMonitor.stopMonitoring()

      expect(seoMonitor.isMonitoring).toBe(false)
    })
  })

  describe('性能指標收集', () => {
    it('應該成功收集性能指標', async () => {
      seoMonitor.isMonitoring = true
      redisCache.set.mockResolvedValue('OK')

      await seoMonitor.collectPerformanceMetrics()

      expect(seoMonitor.metrics.get('performance').lcp).toBeDefined()
      expect(seoMonitor.metrics.get('performance').fid).toBeDefined()
      expect(seoMonitor.metrics.get('performance').cls).toBeDefined()
      expect(redisCache.set).toHaveBeenCalledWith(
        'seo:performance_latest',
        expect.any(String),
        3600,
      )
    })

    it('應該限制性能指標數據點數量', async () => {
      seoMonitor.isMonitoring = true

      // 添加超過100個數據點
      for (let i = 0; i < 105; i++) {
        seoMonitor.metrics.get('performance').lcp.push(2000 + i)
      }

      await seoMonitor.collectPerformanceMetrics()

      const lcpArray = seoMonitor.metrics.get('performance').lcp
      expect(lcpArray.length).toBeLessThanOrEqual(100)
    })
  })

  describe('SEO健康檢查', () => {
    it('應該成功執行SEO健康檢查', async () => {
      seoMonitor.isMonitoring = true
      redisCache.set.mockResolvedValue('OK')

      await seoMonitor.checkSEOHealth()

      expect(seoMonitor.metrics.get('seo').metaTags).toBeDefined()
      expect(seoMonitor.metrics.get('seo').structuredData).toBeDefined()
      expect(seoMonitor.metrics.get('seo').mobileScore).toBeDefined()
      expect(redisCache.set).toHaveBeenCalledWith('seo:seo_health_latest', expect.any(String), 3600)
    })

    it('應該限制SEO指標數據點數量', async () => {
      seoMonitor.isMonitoring = true

      // 添加超過50個數據點
      for (let i = 0; i < 55; i++) {
        seoMonitor.metrics.get('seo').metaTags.push(80 + i)
      }

      await seoMonitor.checkSEOHealth()

      const metaTagsArray = seoMonitor.metrics.get('seo').metaTags
      expect(metaTagsArray.length).toBeLessThanOrEqual(50)
    })
  })

  describe('搜尋引擎指標更新', () => {
    it('應該成功更新搜尋引擎指標', async () => {
      seoMonitor.isMonitoring = true
      redisCache.set.mockResolvedValue('OK')

      await seoMonitor.updateSearchEngineMetrics()

      const searchEngine = seoMonitor.metrics.get('searchEngine')
      expect(searchEngine.indexedPages).toBeDefined()
      expect(searchEngine.crawledPages).toBeDefined()
      expect(searchEngine.indexingRate).toBeDefined()
      expect(redisCache.set).toHaveBeenCalledWith(
        'seo:search_engine_latest',
        expect.any(String),
        3600,
      )
    })
  })

  describe('警報系統', () => {
    beforeEach(() => {
      redisCache.set.mockResolvedValue('OK')
      redisCache.sadd.mockResolvedValue(1)
    })

    it('應該在性能指標超過閾值時發送警報', async () => {
      const highMetrics = {
        lcp: 3000, // 超過閾值 2500
        fid: 50,
        cls: 0.05,
      }

      await seoMonitor.checkPerformanceAlerts(highMetrics)

      expect(redisCache.set).toHaveBeenCalled()
      expect(redisCache.sadd).toHaveBeenCalledWith('seo:active_alerts', expect.any(String))
    })

    it('應該在SEO指標低於閾值時發送警報', async () => {
      const lowMetrics = {
        metaTagsScore: 70, // 低於閾值 80
        structuredDataScore: 75,
        mobileFriendliness: 80,
      }

      await seoMonitor.checkSEOAlerts(lowMetrics)

      expect(redisCache.set).toHaveBeenCalled()
      expect(redisCache.sadd).toHaveBeenCalledWith('seo:active_alerts', expect.any(String))
    })

    it('應該在搜尋引擎指標異常時發送警報', async () => {
      const badMetrics = {
        indexingRate: 90, // 低於閾值 95
        crawlErrors: 10, // 超過閾值 5
        sitemapStatus: 'invalid',
      }

      await seoMonitor.checkSearchEngineAlerts(badMetrics)

      expect(redisCache.set).toHaveBeenCalled()
      expect(redisCache.sadd).toHaveBeenCalledWith('seo:active_alerts', expect.any(String))
    })

    it('應該正確構造警報數據', async () => {
      const highMetrics = {
        lcp: 3000,
        fid: 50,
        cls: 0.05,
      }

      await seoMonitor.checkPerformanceAlerts(highMetrics)

      const setCall = redisCache.set.mock.calls.find((call) => call[0].startsWith('seo:alert:'))

      expect(setCall).toBeDefined()
      const alertData = JSON.parse(setCall[1])
      expect(alertData).toEqual(
        expect.objectContaining({
          type: 'performance',
          metric: 'lcp',
          value: 3000,
          threshold: 2500,
          severity: 'high',
          timestamp: expect.any(String),
          id: expect.any(String),
        }),
      )
    })
  })

  describe('每日報告生成', () => {
    beforeEach(() => {
      redisCache.set.mockResolvedValue('OK')
      redisCache.sadd.mockResolvedValue(1)
    })

    it('應該成功生成每日報告', async () => {
      // 添加一些測試數據
      seoMonitor.metrics.get('performance').lcp = [2000, 2100, 2200]
      seoMonitor.metrics.get('seo').metaTags = [85, 90, 88]
      seoMonitor.metrics.get('searchEngine').indexingRate = 95

      await seoMonitor.generateDailyReport()

      const reportDate = new Date().toISOString().split('T')[0]

      expect(redisCache.set).toHaveBeenCalledWith(
        `seo:report:${reportDate}`,
        expect.any(String),
        2592000, // 30天
      )
      expect(redisCache.sadd).toHaveBeenCalledWith('seo:reports', reportDate)
    })

    it('應該正確生成報告摘要', async () => {
      seoMonitor.metrics.get('performance').lcp = [2000, 2100, 2200]
      seoMonitor.metrics.get('seo').metaTags = [85, 90, 88]

      const summary = await seoMonitor.generateReportSummary()

      expect(summary).toEqual(
        expect.objectContaining({
          overall_score: expect.any(Number),
          performance_trend: expect.any(String),
          seo_health: expect.any(String),
          indexing_status: expect.any(String),
          alerts_count: expect.any(Number),
        }),
      )
    })

    it('應該正確生成性能報告', async () => {
      seoMonitor.metrics.get('performance').lcp = [2000, 2100, 2200]
      seoMonitor.metrics.get('performance').fid = [50, 60, 55]

      const performanceReport = await seoMonitor.getPerformanceReport()

      expect(performanceReport.lcp).toEqual(
        expect.objectContaining({
          current: 2200,
          average: expect.any(Number),
          trend: expect.any(String),
          status: expect.any(String),
        }),
      )
    })

    it('應該正確生成SEO報告', async () => {
      seoMonitor.metrics.get('seo').metaTags = [85, 90, 88]
      seoMonitor.metrics.get('seo').structuredData = [80, 85, 82]

      const seoReport = await seoMonitor.getSEOReport()

      expect(seoReport.meta_tags).toEqual(
        expect.objectContaining({
          score: 88,
          average: expect.any(Number),
          trend: expect.any(String),
          status: expect.any(String),
        }),
      )
    })
  })

  describe('建議生成', () => {
    it('應該基於性能指標生成建議', async () => {
      // 設定高LCP值
      seoMonitor.metrics.get('performance').lcp = [3000, 3100, 3200] // 超過閾值

      const recommendations = await seoMonitor.generateRecommendations()

      const performanceRec = recommendations.find((r) => r.type === 'performance')
      expect(performanceRec).toBeDefined()
      expect(performanceRec.priority).toBe('high')
      expect(performanceRec.title).toContain('LCP')
    })

    it('應該基於SEO指標生成建議', async () => {
      // 設定低Meta標籤分數
      seoMonitor.metrics.get('seo').metaTags = [60, 65, 70] // 低於閾值

      const recommendations = await seoMonitor.generateRecommendations()

      const seoRec = recommendations.find((r) => r.type === 'seo')
      expect(seoRec).toBeDefined()
      expect(seoRec.priority).toBe('medium')
      expect(seoRec.title).toContain('Meta')
    })

    it('應該基於搜尋引擎指標生成建議', async () => {
      // 設定低索引覆蓋率
      seoMonitor.metrics.get('searchEngine').indexingRate = 85 // 低於閾值

      const recommendations = await seoMonitor.generateRecommendations()

      const searchRec = recommendations.find((r) => r.type === 'search_engine')
      expect(searchRec).toBeDefined()
      expect(searchRec.priority).toBe('high')
      expect(searchRec.title).toContain('索引覆蓋率')
    })
  })

  describe('工具方法', () => {
    describe('generateRandomMetric', () => {
      it('應該生成指定範圍內的隨機數', () => {
        const value = seoMonitor.generateRandomMetric(10, 20)

        expect(value).toBeGreaterThanOrEqual(10)
        expect(value).toBeLessThanOrEqual(20)
        expect(typeof value).toBe('number')
      })
    })

    describe('calculateAverage', () => {
      it('應該正確計算數組平均值', () => {
        const array = [10, 20, 30, 40, 50]
        const average = seoMonitor.calculateAverage(array)

        expect(average).toBe(30)
      })

      it('應該處理空數組', () => {
        const array = []
        const average = seoMonitor.calculateAverage(array)

        expect(average).toBe(0)
      })
    })

    describe('analyzeTrend', () => {
      it('應該檢測上升趨勢', () => {
        const array = [10, 15, 20, 25, 30] // 明顯上升
        const trend = seoMonitor.analyzeTrend(array)

        expect(trend).toBe('increasing')
      })

      it('應該檢測下降趨勢', () => {
        const array = [30, 25, 20, 15, 10] // 明顯下降
        const trend = seoMonitor.analyzeTrend(array)

        expect(trend).toBe('decreasing')
      })

      it('應該檢測穩定趨勢', () => {
        const array = [20, 21, 20, 19, 20] // 小幅波動
        const trend = seoMonitor.analyzeTrend(array)

        expect(trend).toBe('stable')
      })

      it('應該處理數據不足的情況', () => {
        const array = [20] // 數據點不足
        const trend = seoMonitor.analyzeTrend(array)

        expect(trend).toBe('stable')
      })
    })

    describe('getMetricStatus', () => {
      it('應該根據指標值返回正確狀態', () => {
        const goodValues = [95, 90, 92] // 高於閾值
        const status = seoMonitor.getMetricStatus(goodValues, 80, true)

        expect(status).toBe('good')
      })

      it('應該處理低指標值', () => {
        const poorValues = [60, 65, 70] // 低於閾值
        const status = seoMonitor.getMetricStatus(poorValues, 80, true)

        expect(status).toBe('poor')
      })

      it('應該處理空數組', () => {
        const emptyArray = []
        const status = seoMonitor.getMetricStatus(emptyArray, 80, true)

        expect(status).toBe('unknown')
      })
    })
  })

  describe('整體分數計算', () => {
    it('應該正確計算整體SEO分數', () => {
      const mockMetrics = {
        performance: { lcp: 2000, fid: 50, cls: 0.05 },
        seo_health: { metaTagsScore: 90, structuredDataScore: 85, mobileFriendliness: 95 },
        search_engine: { indexingRate: 95 },
      }

      const score = seoMonitor.calculateOverallScore()

      expect(typeof score).toBe('number')
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('應該處理缺少指標的情況', () => {
      // 清空指標
      seoMonitor.metrics.get('performance').lcp = []
      seoMonitor.metrics.get('seo').metaTags = []

      const score = seoMonitor.calculateOverallScore()

      expect(score).toBe(0)
    })
  })

  describe('SEO健康狀態評估', () => {
    it('應該根據指標評估健康狀態', () => {
      seoMonitor.metrics.get('seo').metaTags = [90]
      seoMonitor.metrics.get('seo').structuredData = [85]
      seoMonitor.metrics.get('seo').mobileScore = [95]

      const health = seoMonitor.calculateSEOHealth(seoMonitor.metrics.get('seo'))

      expect(['excellent', 'good', 'fair', 'poor']).toContain(health)
    })

    it('應該在高分時返回優秀狀態', () => {
      seoMonitor.metrics.get('seo').metaTags = [95]
      seoMonitor.metrics.get('seo').structuredData = [92]
      seoMonitor.metrics.get('seo').mobileScore = [98]

      const health = seoMonitor.calculateSEOHealth(seoMonitor.metrics.get('seo'))

      expect(health).toBe('excellent')
    })
  })

  describe('監控狀態獲取', () => {
    it('應該返回正確的監控狀態', () => {
      const status = seoMonitor.getMonitoringStatus()

      expect(status).toEqual(
        expect.objectContaining({
          is_monitoring: expect.any(Boolean),
          metrics_count: expect.any(Number),
          cache_prefix: 'seo:',
          last_update: expect.any(String),
          alert_thresholds: expect.any(Object),
        }),
      )
    })
  })

  describe('最新指標獲取', () => {
    it('應該成功獲取最新指標', async () => {
      const mockPerformanceData = JSON.stringify({
        lcp: 2000,
        timestamp: new Date().toISOString(),
      })
      const mockSEOData = JSON.stringify({
        metaTagsScore: 85,
        timestamp: new Date().toISOString(),
      })
      const mockSearchData = JSON.stringify({
        indexingRate: 95,
        timestamp: new Date().toISOString(),
      })

      redisCache.get
        .mockResolvedValueOnce(mockPerformanceData)
        .mockResolvedValueOnce(mockSEOData)
        .mockResolvedValueOnce(mockSearchData)

      const metrics = await seoMonitor.getLatestMetrics()

      expect(metrics.performance).toEqual(JSON.parse(mockPerformanceData))
      expect(metrics.seo_health).toEqual(JSON.parse(mockSEOData))
      expect(metrics.search_engine).toEqual(JSON.parse(mockSearchData))
      expect(metrics.timestamp).toBeDefined()
    })

    it('應該處理獲取指標時的錯誤', async () => {
      redisCache.get.mockRejectedValue(new Error('Redis 錯誤'))

      const metrics = await seoMonitor.getLatestMetrics()

      expect(metrics.performance).toBeNull()
      expect(metrics.seo_health).toBeNull()
      expect(metrics.search_engine).toBeNull()
      expect(metrics.error).toBeDefined()
    })
  })

  describe('活躍警報統計', () => {
    it('應該正確統計活躍警報數量', async () => {
      redisCache.scard.mockResolvedValue(5)

      const count = await seoMonitor.getActiveAlertsCount()

      expect(count).toBe(5)
      expect(redisCache.scard).toHaveBeenCalledWith('seo:active_alerts')
    })

    it('應該處理統計錯誤', async () => {
      redisCache.scard.mockRejectedValue(new Error('Redis 錯誤'))

      const count = await seoMonitor.getActiveAlertsCount()

      expect(count).toBe(0)
    })
  })

  describe('活躍警報獲取', () => {
    it('應該成功獲取活躍警報列表', async () => {
      const mockAlertIds = ['alert1', 'alert2']
      const mockAlert = JSON.stringify({
        id: 'alert1',
        message: '測試警報',
        timestamp: new Date().toISOString(),
      })

      redisCache.smembers.mockResolvedValue(mockAlertIds)
      redisCache.get.mockResolvedValue(mockAlert)

      const alerts = await seoMonitor.getActiveAlerts()

      expect(alerts).toHaveLength(2)
      expect(alerts[0]).toEqual(JSON.parse(mockAlert))
    })

    it('應該限制返回的警報數量', async () => {
      const mockAlertIds = Array.from({ length: 15 }, (_, i) => `alert${i}`)
      const mockAlert = JSON.stringify({ id: 'alert0' })

      redisCache.smembers.mockResolvedValue(mockAlertIds)
      redisCache.get.mockResolvedValue(mockAlert)

      const alerts = await seoMonitor.getActiveAlerts()

      expect(alerts).toHaveLength(10) // 限制為10個
    })

    it('應該處理獲取警報時的錯誤', async () => {
      redisCache.smembers.mockRejectedValue(new Error('Redis 錯誤'))

      const alerts = await seoMonitor.getActiveAlerts()

      expect(alerts).toEqual([])
    })
  })
})
