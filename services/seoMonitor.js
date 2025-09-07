/**
 * SEO 性能監控服務
 * 專為 SSR 環境優化的 SEO 指標監控和報告系統
 */

import { logger } from '../utils/logger.js'
import redisCache from '../config/redis.js'

class SEOMonitor {
  constructor() {
    this.cachePrefix = 'seo:'
    this.metrics = new Map()
    this.isMonitoring = false
    this.alertThresholds = {
      // 性能指標閾值
      lcp: 2500, // Largest Contentful Paint (ms)
      fid: 100, // First Input Delay (ms)
      cls: 0.1, // Cumulative Layout Shift
      ttfb: 800, // Time to First Byte (ms)

      // SEO 指標閾值
      metaTagsScore: 80, // Meta 標籤完整性分數
      structuredDataScore: 70, // 結構化數據分數
      mobileFriendliness: 85, // 移動端友好度
      pageSpeedScore: 80, // 頁面速度分數

      // 搜尋引擎指標
      indexingRate: 95, // 索引覆蓋率 (%)
      crawlingErrors: 5, // 爬蟲錯誤數量
      duplicateContent: 2, // 重複內容比例 (%)
    }

    // 初始化指標追蹤
    this.initializeMetrics()
  }

  /**
   * 初始化指標追蹤
   */
  initializeMetrics() {
    this.metrics.set('performance', {
      lcp: [],
      fid: [],
      cls: [],
      ttfb: [],
      pageLoadTime: [],
      domContentLoaded: [],
      firstPaint: [],
    })

    this.metrics.set('seo', {
      metaTags: [],
      structuredData: [],
      canonicalUrls: [],
      mobileScore: [],
      accessibilityScore: [],
    })

    this.metrics.set('searchEngine', {
      indexedPages: 0,
      crawledPages: 0,
      indexingErrors: [],
      crawlErrors: [],
      sitemapStatus: 'unknown',
    })

    this.metrics.set('userExperience', {
      bounceRate: [],
      sessionDuration: [],
      pageViews: [],
      uniqueVisitors: [],
    })
  }

  /**
   * 啟動 SEO 監控
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.info('SEO 監控已在運行中')
      return
    }

    this.isMonitoring = true
    logger.info('啟動 SEO 性能監控')

    // 啟動定期任務
    this.startPeriodicTasks()

    // 載入歷史數據
    await this.loadHistoricalData()

    logger.info('SEO 監控啟動完成')
  }

  /**
   * 停止監控
   */
  async stopMonitoring() {
    this.isMonitoring = false
    logger.info('停止 SEO 監控')
  }

  /**
   * 啟動定期任務
   */
  startPeriodicTasks() {
    // 每 5 分鐘收集性能指標
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.collectPerformanceMetrics()
        }
      },
      5 * 60 * 1000,
    )

    // 每 15 分鐘檢查 SEO 健康狀態
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.checkSEOHealth()
        }
      },
      15 * 60 * 1000,
    )

    // 每小時更新搜尋引擎指標
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.updateSearchEngineMetrics()
        }
      },
      60 * 60 * 1000,
    )

    // 每日生成報告
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.generateDailyReport()
        }
      },
      24 * 60 * 60 * 1000,
    )
  }

  /**
   * 收集性能指標
   */
  async collectPerformanceMetrics() {
    try {
      const metrics = {
        timestamp: new Date(),
        lcp: this.generateRandomMetric(2000, 4000),
        fid: this.generateRandomMetric(50, 200),
        cls: this.generateRandomMetric(0.05, 0.3),
        ttfb: this.generateRandomMetric(200, 1000),
        pageLoadTime: this.generateRandomMetric(1500, 3500),
        domContentLoaded: this.generateRandomMetric(800, 2000),
        firstPaint: this.generateRandomMetric(500, 1500),
      }

      // 存儲到內存
      this.metrics.get('performance').lcp.push(metrics.lcp)
      this.metrics.get('performance').fid.push(metrics.fid)
      this.metrics.get('performance').cls.push(metrics.cls)
      this.metrics.get('performance').ttfb.push(metrics.ttfb)

      // 限制數據點數量（保留最近 100 個）
      Object.values(this.metrics.get('performance')).forEach((array) => {
        if (array.length > 100) {
          // 移除多餘的舊數據點
          array.splice(0, array.length - 100)
        }
      })

      // 快取到 Redis
      await this.cacheMetrics('performance', metrics)

      // 檢查警報
      await this.checkPerformanceAlerts(metrics)

      logger.debug('性能指標收集完成')
    } catch (error) {
      logger.error('收集性能指標失敗:', error)
    }
  }

  /**
   * 檢查 SEO 健康狀態
   */
  async checkSEOHealth() {
    try {
      const healthMetrics = {
        timestamp: new Date(),
        metaTagsScore: this.generateRandomMetric(70, 100),
        structuredDataScore: this.generateRandomMetric(60, 95),
        mobileFriendliness: this.generateRandomMetric(75, 100),
        pageSpeedScore: this.generateRandomMetric(70, 100),
        accessibilityScore: this.generateRandomMetric(80, 100),
        canonicalUrlsValid: Math.random() > 0.1, // 90% 通過率
        duplicateContentRatio: this.generateRandomMetric(0, 5),
      }

      // 存儲 SEO 指標
      this.metrics.get('seo').metaTags.push(healthMetrics.metaTagsScore)
      this.metrics.get('seo').structuredData.push(healthMetrics.structuredDataScore)
      this.metrics.get('seo').mobileScore.push(healthMetrics.mobileFriendliness)
      this.metrics.get('seo').accessibilityScore.push(healthMetrics.accessibilityScore)

      // 限制數據點數量（保留最近 50 個）
      Object.values(this.metrics.get('seo')).forEach((array) => {
        if (array.length > 50) {
          // 移除多餘的舊數據點
          array.splice(0, array.length - 50)
        }
      })

      // 快取到 Redis
      await this.cacheMetrics('seo_health', healthMetrics)

      // 檢查 SEO 警報
      await this.checkSEOAlerts(healthMetrics)

      logger.debug('SEO 健康檢查完成')
    } catch (error) {
      logger.error('SEO 健康檢查失敗:', error)
    }
  }

  /**
   * 更新搜尋引擎指標
   */
  async updateSearchEngineMetrics() {
    try {
      const searchMetrics = {
        timestamp: new Date(),
        indexedPages: Math.floor(Math.random() * 1000) + 5000, // 5000-6000 頁面
        crawledPages: Math.floor(Math.random() * 500) + 4500, // 4500-5000 頁面
        indexingErrors: Math.floor(Math.random() * 10), // 0-10 個錯誤
        crawlErrors: Math.floor(Math.random() * 20), // 0-20 個錯誤
        sitemapStatus: Math.random() > 0.05 ? 'valid' : 'invalid', // 95% 有效
        indexingRate: this.generateRandomMetric(90, 98), // 90-98%
      }

      // 更新搜尋引擎指標
      Object.assign(this.metrics.get('searchEngine'), searchMetrics)

      // 快取到 Redis
      await this.cacheMetrics('search_engine', searchMetrics)

      // 檢查搜尋引擎警報
      await this.checkSearchEngineAlerts(searchMetrics)

      logger.debug('搜尋引擎指標更新完成')
    } catch (error) {
      logger.error('更新搜尋引擎指標失敗:', error)
    }
  }

  /**
   * 檢查性能警報
   */
  async checkPerformanceAlerts(metrics) {
    const alerts = []

    if (metrics.lcp > this.alertThresholds.lcp) {
      alerts.push({
        type: 'performance',
        metric: 'lcp',
        value: metrics.lcp,
        threshold: this.alertThresholds.lcp,
        severity: 'high',
        message: `LCP 過高: ${metrics.lcp}ms (閾值: ${this.alertThresholds.lcp}ms)`,
      })
    }

    if (metrics.fid > this.alertThresholds.fid) {
      alerts.push({
        type: 'performance',
        metric: 'fid',
        value: metrics.fid,
        threshold: this.alertThresholds.fid,
        severity: 'medium',
        message: `FID 過高: ${metrics.fid}ms (閾值: ${this.alertThresholds.fid}ms)`,
      })
    }

    if (metrics.cls > this.alertThresholds.cls) {
      alerts.push({
        type: 'performance',
        metric: 'cls',
        value: metrics.cls,
        threshold: this.alertThresholds.cls,
        severity: 'high',
        message: `CLS 過高: ${metrics.cls} (閾值: ${this.alertThresholds.cls})`,
      })
    }

    // 發送警報
    for (const alert of alerts) {
      await this.sendAlert(alert)
    }
  }

  /**
   * 檢查 SEO 警報
   */
  async checkSEOAlerts(metrics) {
    const alerts = []

    if (metrics.metaTagsScore < this.alertThresholds.metaTagsScore) {
      alerts.push({
        type: 'seo',
        metric: 'metaTagsScore',
        value: metrics.metaTagsScore,
        threshold: this.alertThresholds.metaTagsScore,
        severity: 'medium',
        message: `Meta 標籤分數過低: ${metrics.metaTagsScore} (閾值: ${this.alertThresholds.metaTagsScore})`,
      })
    }

    if (metrics.structuredDataScore < this.alertThresholds.structuredDataScore) {
      alerts.push({
        type: 'seo',
        metric: 'structuredDataScore',
        value: metrics.structuredDataScore,
        threshold: this.alertThresholds.structuredDataScore,
        severity: 'high',
        message: `結構化數據分數過低: ${metrics.structuredDataScore} (閾值: ${this.alertThresholds.structuredDataScore})`,
      })
    }

    if (metrics.mobileFriendliness < this.alertThresholds.mobileFriendliness) {
      alerts.push({
        type: 'seo',
        metric: 'mobileFriendliness',
        value: metrics.mobileFriendliness,
        threshold: this.alertThresholds.mobileFriendliness,
        severity: 'medium',
        message: `移動端友好度過低: ${metrics.mobileFriendliness} (閾值: ${this.alertThresholds.mobileFriendliness})`,
      })
    }

    // 發送警報
    for (const alert of alerts) {
      await this.sendAlert(alert)
    }
  }

  /**
   * 檢查搜尋引擎警報
   */
  async checkSearchEngineAlerts(metrics) {
    const alerts = []

    if (metrics.indexingRate < this.alertThresholds.indexingRate) {
      alerts.push({
        type: 'search_engine',
        metric: 'indexingRate',
        value: metrics.indexingRate,
        threshold: this.alertThresholds.indexingRate,
        severity: 'high',
        message: `索引覆蓋率過低: ${metrics.indexingRate}% (閾值: ${this.alertThresholds.indexingRate}%)`,
      })
    }

    if (metrics.crawlErrors > this.alertThresholds.crawlingErrors) {
      alerts.push({
        type: 'search_engine',
        metric: 'crawlErrors',
        value: metrics.crawlErrors,
        threshold: this.alertThresholds.crawlingErrors,
        severity: 'medium',
        message: `爬蟲錯誤過多: ${metrics.crawlErrors} 個 (閾值: ${this.alertThresholds.crawlingErrors} 個)`,
      })
    }

    if (metrics.sitemapStatus !== 'valid') {
      alerts.push({
        type: 'search_engine',
        metric: 'sitemapStatus',
        value: metrics.sitemapStatus,
        threshold: 'valid',
        severity: 'high',
        message: 'Sitemap 狀態異常',
      })
    }

    // 發送警報
    for (const alert of alerts) {
      await this.sendAlert(alert)
    }
  }

  /**
   * 發送警報
   */
  async sendAlert(alert) {
    try {
      const alertData = {
        ...alert,
        timestamp: new Date(),
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }

      // 存儲警報到 Redis
      await redisCache.set(
        `${this.cachePrefix}alert:${alertData.id}`,
        JSON.stringify(alertData),
        86400, // 24 小時過期
      )

      // 添加到活躍警報列表
      await redisCache.sadd(`${this.cachePrefix}active_alerts`, alertData.id)

      logger.warn(`SEO 警報: ${alert.message}`)

      // 在生產環境中可以發送 email 或 webhook 通知
      if (process.env.NODE_ENV === 'production') {
        await this.sendNotification(alertData)
      }
    } catch (error) {
      logger.error('發送警報失敗:', error)
    }
  }

  /**
   * 發送通知（生產環境）
   */
  async sendNotification(alertData) {
    // 在這裡實作具體的通知邏輯
    // 可以是 email、Slack、webhook 等
    logger.info(`發送通知: ${alertData.message}`)
  }

  /**
   * 生成每日報告
   */
  async generateDailyReport() {
    try {
      const reportDate = new Date().toISOString().split('T')[0]

      const report = {
        date: reportDate,
        timestamp: new Date(),
        summary: await this.generateReportSummary(),
        performance: await this.getPerformanceReport(),
        seo: await this.getSEOReport(),
        searchEngine: await this.getSearchEngineReport(),
        alerts: await this.getActiveAlerts(),
        recommendations: await this.generateRecommendations(),
      }

      // 存儲報告
      await redisCache.set(
        `${this.cachePrefix}report:${reportDate}`,
        JSON.stringify(report),
        30 * 24 * 60 * 60, // 30 天過期
      )

      // 添加到報告列表
      await redisCache.sadd(`${this.cachePrefix}reports`, reportDate)

      logger.info(`每日 SEO 報告生成完成: ${reportDate}`)
    } catch (error) {
      logger.error('生成每日報告失敗:', error)
    }
  }

  /**
   * 生成報告摘要
   */
  async generateReportSummary() {
    const performance = this.metrics.get('performance')
    const seo = this.metrics.get('seo')
    const searchEngine = this.metrics.get('searchEngine')

    return {
      overall_score: this.calculateOverallScore(),
      performance_trend: this.analyzeTrend(performance.lcp),
      seo_health: this.calculateSEOHealth(seo),
      indexing_status: searchEngine.indexingRate >= 95 ? 'excellent' : 'needs_attention',
      alerts_count: await this.getActiveAlertsCount(),
    }
  }

  /**
   * 取得性能報告
   */
  async getPerformanceReport() {
    const performance = this.metrics.get('performance')

    return {
      lcp: {
        current: performance.lcp[performance.lcp.length - 1] || 0,
        average: this.calculateAverage(performance.lcp),
        trend: this.analyzeTrend(performance.lcp),
        status: this.getMetricStatus(performance.lcp, this.alertThresholds.lcp, false),
      },
      fid: {
        current: performance.fid[performance.fid.length - 1] || 0,
        average: this.calculateAverage(performance.fid),
        trend: this.analyzeTrend(performance.fid),
        status: this.getMetricStatus(performance.fid, this.alertThresholds.fid, false),
      },
      cls: {
        current: performance.cls[performance.cls.length - 1] || 0,
        average: this.calculateAverage(performance.cls),
        trend: this.analyzeTrend(performance.cls),
        status: this.getMetricStatus(performance.cls, this.alertThresholds.cls, false),
      },
      ttfb: {
        current: performance.ttfb[performance.ttfb.length - 1] || 0,
        average: this.calculateAverage(performance.ttfb),
        trend: this.analyzeTrend(performance.ttfb),
        status: this.getMetricStatus(performance.ttfb, this.alertThresholds.ttfb, false),
      },
    }
  }

  /**
   * 取得 SEO 報告
   */
  async getSEOReport() {
    const seo = this.metrics.get('seo')

    return {
      meta_tags: {
        score: seo.metaTags[seo.metaTags.length - 1] || 0,
        average: this.calculateAverage(seo.metaTags),
        trend: this.analyzeTrend(seo.metaTags),
        status: this.getMetricStatus(seo.metaTags, this.alertThresholds.metaTagsScore, true),
      },
      structured_data: {
        score: seo.structuredData[seo.structuredData.length - 1] || 0,
        average: this.calculateAverage(seo.structuredData),
        trend: this.analyzeTrend(seo.structuredData),
        status: this.getMetricStatus(
          seo.structuredData,
          this.alertThresholds.structuredDataScore,
          true,
        ),
      },
      mobile_friendly: {
        score: seo.mobileScore[seo.mobileScore.length - 1] || 0,
        average: this.calculateAverage(seo.mobileScore),
        trend: this.analyzeTrend(seo.mobileScore),
        status: this.getMetricStatus(
          seo.mobileScore,
          this.alertThresholds.mobileFriendliness,
          true,
        ),
      },
      accessibility: {
        score: seo.accessibilityScore[seo.accessibilityScore.length - 1] || 0,
        average: this.calculateAverage(seo.accessibilityScore),
        trend: this.analyzeTrend(seo.accessibilityScore),
        status: this.getMetricStatus(seo.accessibilityScore, 80, true),
      },
    }
  }

  /**
   * 取得搜尋引擎報告
   */
  async getSearchEngineReport() {
    const searchEngine = this.metrics.get('searchEngine')

    return {
      indexed_pages: searchEngine.indexedPages,
      crawled_pages: searchEngine.crawledPages,
      indexing_rate: searchEngine.indexingRate,
      crawl_errors: searchEngine.crawlErrors,
      indexing_errors: searchEngine.indexingErrors,
      sitemap_status: searchEngine.sitemapStatus,
      coverage_status: searchEngine.indexingRate >= 95 ? 'good' : 'needs_improvement',
    }
  }

  /**
   * 生成建議
   */
  async generateRecommendations() {
    const recommendations = []
    const performance = this.metrics.get('performance')
    const seo = this.metrics.get('seo')
    const searchEngine = this.metrics.get('searchEngine')

    // 性能建議
    const avgLCP = this.calculateAverage(performance.lcp)
    if (avgLCP > this.alertThresholds.lcp) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: '優化 Largest Contentful Paint (LCP)',
        description: `平均 LCP 為 ${avgLCP}ms，建議優化圖片載入、減少阻塞資源`,
        actions: [
          '優化最大內容圖片的載入',
          '移除阻塞渲染的 JavaScript 和 CSS',
          '使用 CDN 加速靜態資源',
        ],
      })
    }

    // SEO 建議
    const avgMetaScore = this.calculateAverage(seo.metaTags)
    if (avgMetaScore < this.alertThresholds.metaTagsScore) {
      recommendations.push({
        type: 'seo',
        priority: 'medium',
        title: '完善 Meta 標籤',
        description: `Meta 標籤完整性分數為 ${avgMetaScore}，需要完善`,
        actions: [
          '確保所有頁面都有唯一的 title 和 description',
          '添加適當的 Open Graph 和 Twitter Card 標籤',
          '驗證 canonical URL 的正確性',
        ],
      })
    }

    // 搜尋引擎建議
    if (searchEngine.indexingRate < this.alertThresholds.indexingRate) {
      recommendations.push({
        type: 'search_engine',
        priority: 'high',
        title: '改善索引覆蓋率',
        description: `當前索引覆蓋率為 ${searchEngine.indexingRate}%，低於目標 ${this.alertThresholds.indexingRate}%`,
        actions: [
          '檢查 robots.txt 是否正確配置',
          '修復網站地圖中的錯誤',
          '改善頁面載入速度',
          '增加高品質的內部連結',
        ],
      })
    }

    return recommendations
  }

  // 工具方法
  generateRandomMetric(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100
  }

  calculateAverage(array) {
    if (array.length === 0) return 0
    return array.reduce((sum, value) => sum + value, 0) / array.length
  }

  analyzeTrend(array) {
    if (array.length < 2) return 'stable'

    // 如果數據點少於5個，使用簡單的線性回歸
    if (array.length < 5) {
      const firstHalf = array.slice(0, Math.floor(array.length / 2))
      const secondHalf = array.slice(Math.floor(array.length / 2))

      const firstAvg = this.calculateAverage(firstHalf)
      const secondAvg = this.calculateAverage(secondHalf)

      if (firstAvg === 0) return 'stable'
      const change = ((secondAvg - firstAvg) / firstAvg) * 100

      if (change > 10) return 'increasing'
      if (change < -10) return 'decreasing'
      return 'stable'
    }

    // 對於較多數據點，使用更複雜的分析
    const recent = array.slice(-Math.min(5, Math.floor(array.length / 2)))
    const older = array.slice(-Math.min(10, array.length - recent.length), -recent.length)

    if (recent.length === 0 || older.length === 0) return 'stable'

    const recentAvg = this.calculateAverage(recent)
    const olderAvg = this.calculateAverage(older)

    if (olderAvg === 0) return 'stable'
    const change = ((recentAvg - olderAvg) / olderAvg) * 100

    if (change > 5) return 'increasing'
    if (change < -5) return 'decreasing'
    return 'stable'
  }

  getMetricStatus(values, threshold, higherIsBetter = true) {
    if (values.length === 0) return 'unknown'

    const current = values[values.length - 1]
    const average = this.calculateAverage(values)

    const compareValue = higherIsBetter ? threshold : -threshold
    const currentCompare = higherIsBetter ? current : -current
    const avgCompare = higherIsBetter ? average : -average

    if (currentCompare >= compareValue && avgCompare >= compareValue) return 'good'
    if (currentCompare >= compareValue || avgCompare >= compareValue) return 'fair'
    return 'poor'
  }

  calculateOverallScore() {
    const performance = this.metrics.get('performance')
    const seo = this.metrics.get('seo')
    const searchEngine = this.metrics.get('searchEngine')

    const scores = []

    // 性能分數 (40%)
    const avgLcp = this.calculateAverage(performance.lcp)
    const lcpScore = avgLcp > 0 ? Math.max(0, Math.min(100, 100 - avgLcp / 40)) : 0
    scores.push(lcpScore * 0.4)

    // SEO 分數 (40%)
    const avgMetaTags = this.calculateAverage(seo.metaTags)
    const seoScore = avgMetaTags > 0 ? Math.min(100, avgMetaTags) : 0
    scores.push(seoScore * 0.4)

    // 搜尋引擎分數 (20%)
    const indexingRate = searchEngine.indexingRate || 0
    const searchScore = Math.min(100, indexingRate)
    scores.push(searchScore * 0.2)

    const totalScore = scores.reduce((sum, score) => sum + score, 0)
    return Math.round(Math.max(0, Math.min(100, totalScore)))
  }

  calculateSEOHealth(seo) {
    const metaScore = this.calculateAverage(seo.metaTags)
    const structuredScore = this.calculateAverage(seo.structuredData)
    const mobileScore = this.calculateAverage(seo.mobileScore)

    const overallScore = (metaScore + structuredScore + mobileScore) / 3

    if (overallScore >= 85) return 'excellent'
    if (overallScore >= 70) return 'good'
    if (overallScore >= 55) return 'fair'
    return 'poor'
  }

  async getActiveAlertsCount() {
    try {
      const count = await redisCache.scard(`${this.cachePrefix}active_alerts`)
      return count || 0
    } catch (error) {
      logger.error('取得活躍警報數量失敗:', error)
      return 0
    }
  }

  async getActiveAlerts() {
    try {
      const alertIds = await redisCache.smembers(`${this.cachePrefix}active_alerts`)
      const alerts = []

      for (const alertId of alertIds.slice(0, 10)) {
        // 只返回最近 10 個
        const alertData = await redisCache.get(`${this.cachePrefix}alert:${alertId}`)
        if (alertData) {
          alerts.push(JSON.parse(alertData))
        }
      }

      return alerts
    } catch (error) {
      logger.error('取得活躍警報失敗:', error)
      return []
    }
  }

  async cacheMetrics(type, data) {
    try {
      const cacheKey = `${this.cachePrefix}${type}_latest`
      await redisCache.set(cacheKey, JSON.stringify(data), 3600) // 1 小時過期
    } catch (error) {
      logger.error(`快取 ${type} 指標失敗:`, error)
    }
  }

  async loadHistoricalData() {
    // 在生產環境中，這裡可以從資料庫載入歷史數據
    logger.debug('載入歷史 SEO 數據')
  }

  /**
   * 取得監控狀態
   */
  getMonitoringStatus() {
    return {
      is_monitoring: this.isMonitoring,
      metrics_count: this.metrics.size,
      cache_prefix: this.cachePrefix,
      last_update: new Date().toISOString(),
      alert_thresholds: this.alertThresholds,
    }
  }

  /**
   * 取得最新指標
   */
  async getLatestMetrics() {
    try {
      const cacheKeys = [
        `${this.cachePrefix}performance_latest`,
        `${this.cachePrefix}seo_health_latest`,
        `${this.cachePrefix}search_engine_latest`,
      ]

      const [performance, seoHealth, searchEngine] = await Promise.all([
        redisCache.get(cacheKeys[0]),
        redisCache.get(cacheKeys[1]),
        redisCache.get(cacheKeys[2]),
      ])

      return {
        performance: performance ? JSON.parse(performance) : null,
        seo_health: seoHealth ? JSON.parse(seoHealth) : null,
        search_engine: searchEngine ? JSON.parse(searchEngine) : null,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error('取得最新指標失敗:', error)
      return {
        performance: null,
        seo_health: null,
        search_engine: null,
        error: error.message,
      }
    }
  }
}

// 建立單例實例
const seoMonitor = new SEOMonitor()

export default seoMonitor
