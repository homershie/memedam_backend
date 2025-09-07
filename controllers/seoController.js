/**
 * SEO 控制器
 * 處理 SEO 監控、報告和分析相關的 API 請求
 */

import seoMonitor from '../services/seoMonitor.js'
import { logger } from '../utils/logger.js'
import redisCache from '../config/redis.js'

class SEOController {
  /**
   * 取得 SEO 監控狀態
   */
  async getMonitoringStatus(req, res) {
    try {
      logger.debug('開始取得 SEO 監控狀態')
      const status = seoMonitor.getMonitoringStatus()
      logger.debug('SEO 監控狀態取得成功:', JSON.stringify(status, null, 2))

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      logger.error('取得 SEO 監控狀態失敗:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      res.status(500).json({
        success: false,
        error: '取得監控狀態失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得最新 SEO 指標
   */
  async getLatestMetrics(req, res) {
    try {
      logger.debug('開始取得最新 SEO 指標')
      const metrics = await seoMonitor.getLatestMetrics()
      logger.debug('最新 SEO 指標取得成功:', JSON.stringify(metrics, null, 2))

      res.json({
        success: true,
        data: metrics,
      })
    } catch (error) {
      logger.error('取得最新指標失敗:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      res.status(500).json({
        success: false,
        error: '取得指標失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得 SEO 報告
   */
  async getSEOReport(req, res) {
    try {
      const { date } = req.query
      const reportDate = date || new Date().toISOString().split('T')[0]
      logger.debug('開始取得 SEO 報告:', { reportDate })

      const cacheKey = `seo:report:${reportDate}`
      logger.debug('快取鍵:', cacheKey)

      let report = await redisCache.get(cacheKey)
      logger.debug('從快取取得報告:', report ? '成功' : '未找到')

      if (report) {
        report = JSON.parse(report)
      } else {
        logger.debug('生成新的報告')
        // 如果沒有快取的報告，生成新的
        await seoMonitor.generateDailyReport()
        report = await redisCache.get(cacheKey)
        logger.debug('重新從快取取得報告:', report ? '成功' : '仍未找到')

        if (report) {
          report = JSON.parse(report)
        } else {
          logger.warn('報告生成失敗，找不到快取數據')
          return res.status(404).json({
            success: false,
            error: '報告不存在',
          })
        }
      }

      logger.debug('SEO 報告取得成功')
      res.json({
        success: true,
        data: report,
      })
    } catch (error) {
      logger.error('取得 SEO 報告失敗:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
      res.status(500).json({
        success: false,
        error: '取得報告失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得 SEO 報告列表
   */
  async getSEOReportsList(req, res) {
    try {
      const { limit = 30 } = req.query

      // 取得所有報告日期
      const reportDates = await redisCache.smembers('seo:reports')

      // 排序並限制數量
      const sortedDates = reportDates
        .sort((a, b) => new Date(b) - new Date(a))
        .slice(0, parseInt(limit))

      const reports = []

      // 取得每個報告的基本資訊
      for (const date of sortedDates) {
        const cacheKey = `seo:report:${date}`
        const reportData = await redisCache.get(cacheKey)

        if (reportData) {
          const report = JSON.parse(reportData)
          reports.push({
            date,
            overall_score: report.summary?.overall_score || 0,
            performance_trend: report.summary?.performance_trend || 'stable',
            seo_health: report.summary?.seo_health || 'unknown',
            alerts_count: report.summary?.alerts_count || 0,
            recommendations_count: report.recommendations?.length || 0,
          })
        }
      }

      res.json({
        success: true,
        data: {
          reports,
          total: reportDates.length,
          limit: parseInt(limit),
        },
      })
    } catch (error) {
      logger.error('取得報告列表失敗:', error)
      res.status(500).json({
        success: false,
        error: '取得報告列表失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得活躍警報
   */
  async getActiveAlerts(req, res) {
    try {
      const { severity, type, limit = 50 } = req.query

      const alertIds = await redisCache.smembers('seo:active_alerts')
      const alerts = []

      for (const alertId of alertIds.slice(0, parseInt(limit))) {
        const alertData = await redisCache.get(`seo:alert:${alertId}`)
        if (alertData) {
          const alert = JSON.parse(alertData)

          // 應用篩選條件
          if (severity && alert.severity !== severity) continue
          if (type && alert.type !== type) continue

          alerts.push(alert)
        }
      }

      // 按時間排序（最新的在前面）
      alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      res.json({
        success: true,
        data: {
          alerts,
          total: alerts.length,
          filters: { severity, type },
        },
      })
    } catch (error) {
      logger.error('取得活躍警報失敗:', error)
      res.status(500).json({
        success: false,
        error: '取得警報失敗',
        message: error.message,
      })
    }
  }

  /**
   * 解析特定警報
   */
  async resolveAlert(req, res) {
    try {
      const { alertId } = req.params
      const { resolution_note } = req.body

      // 從活躍警報中移除
      await redisCache.srem('seo:active_alerts', alertId)

      // 添加解析記錄
      const resolutionData = {
        alert_id: alertId,
        resolved_at: new Date(),
        resolved_by: req.user?.id || 'system',
        resolution_note: resolution_note || '手動解析',
      }

      await redisCache.set(
        `seo:resolved_alert:${alertId}`,
        JSON.stringify(resolutionData),
        30 * 24 * 60 * 60, // 30 天過期
      )

      // 記錄到解析歷史
      await redisCache.sadd('seo:resolved_alerts', alertId)

      logger.info(`SEO 警報已解析: ${alertId}`)

      res.json({
        success: true,
        message: '警報已成功解析',
        data: resolutionData,
      })
    } catch (error) {
      logger.error('解析警報失敗:', error)
      res.status(500).json({
        success: false,
        error: '解析警報失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得 SEO 建議
   */
  async getSEORecommendations(req, res) {
    try {
      const { priority, type } = req.query

      // 生成最新的建議
      const recommendations = await seoMonitor.generateRecommendations()

      // 應用篩選條件
      let filteredRecommendations = recommendations

      if (priority) {
        filteredRecommendations = filteredRecommendations.filter((rec) => rec.priority === priority)
      }

      if (type) {
        filteredRecommendations = filteredRecommendations.filter((rec) => rec.type === type)
      }

      res.json({
        success: true,
        data: {
          recommendations: filteredRecommendations,
          total: filteredRecommendations.length,
          filters: { priority, type },
        },
      })
    } catch (error) {
      logger.error('取得 SEO 建議失敗:', error)
      res.status(500).json({
        success: false,
        error: '取得建議失敗',
        message: error.message,
      })
    }
  }

  /**
   * 執行 SEO 健康檢查
   */
  async runSEOHealthCheck(req, res) {
    try {
      // 觸發健康檢查
      await seoMonitor.checkSEOHealth()

      // 取得最新的健康指標
      const metrics = await seoMonitor.getLatestMetrics()

      res.json({
        success: true,
        message: 'SEO 健康檢查完成',
        data: {
          seo_health: metrics.seo_health,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('執行 SEO 健康檢查失敗:', error)
      res.status(500).json({
        success: false,
        error: '健康檢查失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得 SEO 儀表板數據
   */
  async getSEODashboard(req, res) {
    try {
      const [monitoringStatus, latestMetrics, activeAlerts, recentReports] = await Promise.all([
        Promise.resolve(seoMonitor.getMonitoringStatus()),
        seoMonitor.getLatestMetrics(),
        await this.getActiveAlertsData(),
        await this.getRecentReportsData(),
      ])

      const dashboard = {
        status: monitoringStatus,
        metrics: latestMetrics,
        alerts: {
          active: activeAlerts,
          count: activeAlerts.length,
        },
        reports: recentReports,
        summary: {
          overall_score: this.calculateOverallScore(latestMetrics),
          health_status: this.determineHealthStatus(latestMetrics, activeAlerts),
          last_update: new Date().toISOString(),
        },
      }

      res.json({
        success: true,
        data: dashboard,
      })
    } catch (error) {
      logger.error('取得 SEO 儀表板數據失敗:', error)
      res.status(500).json({
        success: false,
        error: '取得儀表板數據失敗',
        message: error.message,
      })
    }
  }

  /**
   * 取得活躍警報數據（內部方法）
   */
  async getActiveAlertsData() {
    try {
      const alertIds = await redisCache.smembers('seo:active_alerts')
      const alerts = []

      for (const alertId of alertIds.slice(0, 10)) {
        const alertData = await redisCache.get(`seo:alert:${alertId}`)
        if (alertData) {
          alerts.push(JSON.parse(alertData))
        }
      }

      return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    } catch (error) {
      logger.error('取得活躍警報數據失敗:', error)
      return []
    }
  }

  /**
   * 取得最近報告數據（內部方法）
   */
  async getRecentReportsData() {
    try {
      const reportDates = await redisCache.smembers('seo:reports')
      const sortedDates = reportDates.sort((a, b) => new Date(b) - new Date(a)).slice(0, 7) // 最近 7 天

      const reports = []

      for (const date of sortedDates) {
        const cacheKey = `seo:report:${date}`
        const reportData = await redisCache.get(cacheKey)

        if (reportData) {
          const report = JSON.parse(reportData)
          reports.push({
            date,
            overall_score: report.summary?.overall_score || 0,
            performance_trend: report.summary?.performance_trend || 'stable',
            seo_health: report.summary?.seo_health || 'unknown',
          })
        }
      }

      return reports
    } catch (error) {
      logger.error('取得最近報告數據失敗:', error)
      return []
    }
  }

  /**
   * 計算整體分數（內部方法）
   */
  calculateOverallScore(metrics) {
    let score = 0
    let count = 0

    if (metrics.performance) {
      // 性能分數 (40%)
      const perf = metrics.performance
      const lcpScore = perf.lcp !== undefined ? Math.max(0, 100 - perf.lcp / 40) : 0
      const fidScore = perf.fid !== undefined ? Math.max(0, 100 - perf.fid / 2) : 0
      const clsScore = perf.cls !== undefined ? Math.max(0, 100 - perf.cls * 200) : 0

      const perfScores = [lcpScore, fidScore, clsScore].filter((s) => s > 0)
      if (perfScores.length > 0) {
        score += (perfScores.reduce((a, b) => a + b, 0) / perfScores.length) * 0.4
        count += 0.4
      }
    }

    if (metrics.seo_health) {
      // SEO 分數 (40%)
      const seo = metrics.seo_health
      const metaScore = seo.metaTagsScore || 0
      const structuredScore = seo.structuredDataScore || 0
      const mobileScore = seo.mobileFriendliness || 0

      const seoScores = [metaScore, structuredScore, mobileScore].filter((s) => s > 0)
      if (seoScores.length > 0) {
        score += (seoScores.reduce((a, b) => a + b, 0) / seoScores.length) * 0.4
        count += 0.4
      }
    }

    if (metrics.search_engine) {
      // 搜尋引擎分數 (20%)
      score += (metrics.search_engine.indexingRate || 0) * 0.2
      count += 0.2
    }

    return count > 0 ? Math.round(score / count) : 0
  }

  /**
   * 確定健康狀態（內部方法）
   */
  determineHealthStatus(metrics, alerts) {
    const score = this.calculateOverallScore(metrics)
    const highSeverityAlerts = alerts.filter((alert) => alert.severity === 'high').length

    if (score >= 85 && highSeverityAlerts === 0) return 'excellent'
    if (score >= 70 && highSeverityAlerts <= 2) return 'good'
    if (score >= 55 && highSeverityAlerts <= 5) return 'fair'
    if (score >= 40) return 'fair'
    return 'poor'
  }

  /**
   * 啟動監控（管理員功能）
   */
  async startMonitoring(req, res) {
    try {
      await seoMonitor.startMonitoring()

      res.json({
        success: true,
        message: 'SEO 監控已啟動',
        data: seoMonitor.getMonitoringStatus(),
      })
    } catch (error) {
      logger.error('啟動 SEO 監控失敗:', error)
      res.status(500).json({
        success: false,
        error: '啟動監控失敗',
        message: error.message,
      })
    }
  }

  /**
   * 停止監控（管理員功能）
   */
  async stopMonitoring(req, res) {
    try {
      await seoMonitor.stopMonitoring()

      res.json({
        success: true,
        message: 'SEO 監控已停止',
        data: seoMonitor.getMonitoringStatus(),
      })
    } catch (error) {
      logger.error('停止 SEO 監控失敗:', error)
      res.status(500).json({
        success: false,
        error: '停止監控失敗',
        message: error.message,
      })
    }
  }

  /**
   * 手動生成報告（管理員功能）
   */
  async generateReport(req, res) {
    try {
      await seoMonitor.generateDailyReport()

      res.json({
        success: true,
        message: 'SEO 報告生成完成',
        data: {
          generated_at: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('手動生成報告失敗:', error)
      res.status(500).json({
        success: false,
        error: '生成報告失敗',
        message: error.message,
      })
    }
  }
}

// 建立實例
const seoController = new SEOController()

export default seoController
