/**
 * 分析監控工具
 * 提供即時推薦效果監控和 A/B 測試管理功能
 */

import RecommendationMetrics from '../models/RecommendationMetrics.js'
import ABTest from '../models/ABTest.js'
import logger from './logger.js'
import redisCache from '../config/redis.js'

class AnalyticsMonitor {
  constructor() {
    this.cachePrefix = 'analytics:'
    this.metricsCache = new Map()
    this.activeTests = new Map()
    this.isMonitoring = false
  }

  /**
   * 啟動監控
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.info('分析監控已在運行中')
      return
    }

    this.isMonitoring = true
    logger.info('啟動分析監控')

    // 載入活躍的 A/B 測試
    await this.loadActiveTests()

    // 啟動定期任務
    this.startPeriodicTasks()

    logger.info('分析監控啟動完成')
  }

  /**
   * 停止監控
   */
  async stopMonitoring() {
    this.isMonitoring = false
    logger.info('停止分析監控')
  }

  /**
   * 載入活躍的 A/B 測試
   */
  async loadActiveTests() {
    try {
      const activeTests = await ABTest.getActiveTests()

      this.activeTests.clear()
      activeTests.forEach((test) => {
        this.activeTests.set(test.test_id, test)
      })

      logger.info(`載入 ${activeTests.length} 個活躍的 A/B 測試`)
    } catch (error) {
      logger.error('載入活躍測試失敗:', error)
    }
  }

  /**
   * 啟動定期任務
   */
  startPeriodicTasks() {
    // 每小時更新活躍測試
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.loadActiveTests()
        }
      },
      60 * 60 * 1000,
    )

    // 每 5 分鐘更新快取統計
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.updateMetricsCache()
        }
      },
      5 * 60 * 1000,
    )

    // 每小時檢查 A/B 測試結果
    setInterval(
      async () => {
        if (this.isMonitoring) {
          await this.checkABTestResults()
        }
      },
      60 * 60 * 1000,
    )
  }

  /**
   * 更新指標快取
   */
  async updateMetricsCache() {
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // 更新即時指標（最近一小時）
      const realtimeStats = await this.getRealtimeStats(oneHourAgo, now)
      await redisCache.set(`${this.cachePrefix}realtime_stats`, JSON.stringify(realtimeStats), 300) // 5分鐘過期

      // 更新日指標（最近24小時）
      const dailyStats = await this.getDailyStats(oneDayAgo, now)
      await redisCache.set(`${this.cachePrefix}daily_stats`, JSON.stringify(dailyStats), 3600) // 1小時過期

      // 更新演算法比較
      const algorithmComparison = await this.getAlgorithmComparison(oneDayAgo, now)
      await redisCache.set(
        `${this.cachePrefix}algorithm_comparison`,
        JSON.stringify(algorithmComparison),
        3600,
      )

      logger.debug('指標快取更新完成')
    } catch (error) {
      logger.error('更新指標快取失敗:', error)
    }
  }

  /**
   * 取得即時統計
   */
  async getRealtimeStats(startDate, endDate) {
    const stats = await RecommendationMetrics.aggregate([
      {
        $match: {
          recommended_at: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          total_recommendations: { $sum: 1 },
          total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
          total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
          total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
          total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
          total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
          total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
          avg_view_duration: { $avg: '$view_duration' },
          avg_rating: { $avg: '$user_rating' },
        },
      },
    ])

    const result = stats[0] || {
      total_recommendations: 0,
      total_clicks: 0,
      total_likes: 0,
      total_shares: 0,
      total_comments: 0,
      total_collections: 0,
      total_dislikes: 0,
      avg_view_duration: 0,
      avg_rating: 0,
    }

    return {
      ...result,
      ctr:
        result.total_recommendations > 0 ? result.total_clicks / result.total_recommendations : 0,
      engagement_rate:
        result.total_recommendations > 0
          ? (result.total_likes +
              result.total_shares +
              result.total_comments +
              result.total_collections) /
            (result.total_recommendations * 4)
          : 0,
    }
  }

  /**
   * 取得日統計
   */
  async getDailyStats(startDate, endDate) {
    const stats = await RecommendationMetrics.aggregate([
      {
        $match: {
          recommended_at: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$recommended_at',
            },
          },
          total_recommendations: { $sum: 1 },
          total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
          total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
          total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
          total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
          total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
          total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
          avg_view_duration: { $avg: '$view_duration' },
          avg_rating: { $avg: '$user_rating' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ])

    return stats.map((day) => ({
      date: day._id,
      total_recommendations: day.total_recommendations,
      ctr: day.total_recommendations > 0 ? day.total_clicks / day.total_recommendations : 0,
      engagement_rate:
        day.total_recommendations > 0
          ? (day.total_likes + day.total_shares + day.total_comments + day.total_collections) /
            (day.total_recommendations * 4)
          : 0,
      avg_view_duration: day.avg_view_duration || 0,
      avg_rating: day.avg_rating || 0,
    }))
  }

  /**
   * 取得演算法比較
   */
  async getAlgorithmComparison(startDate, endDate) {
    const comparison = await RecommendationMetrics.aggregate([
      {
        $match: {
          recommended_at: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: '$algorithm',
          total_recommendations: { $sum: 1 },
          total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
          total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
          total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
          total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
          total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
          total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
          avg_view_duration: { $avg: '$view_duration' },
          avg_rating: { $avg: '$user_rating' },
        },
      },
    ])

    return comparison.map((algo) => ({
      algorithm: algo._id,
      total_recommendations: algo.total_recommendations,
      ctr: algo.total_recommendations > 0 ? algo.total_clicks / algo.total_recommendations : 0,
      engagement_rate:
        algo.total_recommendations > 0
          ? (algo.total_likes + algo.total_shares + algo.total_comments + algo.total_collections) /
            (algo.total_recommendations * 4)
          : 0,
      avg_view_duration: algo.avg_view_duration || 0,
      avg_rating: algo.avg_rating || 0,
    }))
  }

  /**
   * 檢查 A/B 測試結果
   */
  async checkABTestResults() {
    try {
      for (const [testId, test] of this.activeTests) {
        if (test.is_completed) {
          await this.analyzeABTestResults(test)
        }
      }
    } catch (error) {
      logger.error('檢查 A/B 測試結果失敗:', error)
    }
  }

  /**
   * 分析 A/B 測試結果
   */
  async analyzeABTestResults(test) {
    try {
      // 取得測試結果
      const results = await RecommendationMetrics.getABTestResults(
        test.test_id,
        test.start_date,
        test.end_date,
      )

      // 更新測試結果
      test.results.sample_sizes = {}
      test.results.metric_results = { A: {}, B: {}, control: {} }

      results.forEach((result) => {
        test.results.sample_sizes[result.variant] = result.total_recommendations
        test.results.metric_results[result.variant] = {
          ctr: result.ctr,
          engagement_rate: result.engagement_rate,
          satisfaction_score: result.avg_rating / 5, // 轉換為 0-1 範圍
          avg_view_duration: result.avg_view_duration,
        }
      })

      // 檢查統計顯著性
      const isSignificant = test.checkStatisticalSignificance()
      test.results.statistical_significance = isSignificant

      if (isSignificant) {
        // 選擇獲勝變體
        const winner = test.selectWinner()
        test.results.winner_variant = winner

        // 如果啟用自動獲勝者選擇
        if (test.automation.auto_winner_selection && winner !== 'none') {
          test.status = 'completed'
          logger.info(`A/B 測試 ${test.test_id} 自動完成，獲勝變體: ${winner}`)
        }
      }

      await test.save()

      // 發送通知
      if (test.notifications.on_significant_result && isSignificant) {
        await this.sendABTestNotification(test)
      }

      logger.info(`A/B 測試 ${test.test_id} 結果分析完成`)
    } catch (error) {
      logger.error(`分析 A/B 測試 ${test.test_id} 結果失敗:`, error)
    }
  }

  /**
   * 發送 A/B 測試通知
   */
  async sendABTestNotification(test) {
    try {
      // 這裡可以實作通知邏輯（email, webhook 等）
      logger.info(`發送 A/B 測試通知: ${test.test_id}, 獲勝變體: ${test.results.winner_variant}`)

      // 範例：記錄到日誌
      const notification = {
        test_id: test.test_id,
        name: test.name,
        winner_variant: test.results.winner_variant,
        statistical_significance: test.results.statistical_significance,
        primary_metric: test.primary_metric,
        timestamp: new Date().toISOString(),
      }

      await redisCache.set(
        `${this.cachePrefix}ab_test_notification:${test.test_id}`,
        JSON.stringify(notification),
        86400,
      ) // 24小時過期
    } catch (error) {
      logger.error('發送 A/B 測試通知失敗:', error)
    }
  }

  /**
   * 取得快取統計
   */
  async getCachedStats() {
    try {
      const [realtimeStats, dailyStats, algorithmComparison] = await Promise.all([
        redisCache.get(`${this.cachePrefix}realtime_stats`),
        redisCache.get(`${this.cachePrefix}daily_stats`),
        redisCache.get(`${this.cachePrefix}algorithm_comparison`),
      ])

      return {
        realtime_stats: realtimeStats ? JSON.parse(realtimeStats) : null,
        daily_stats: dailyStats ? JSON.parse(dailyStats) : null,
        algorithm_comparison: algorithmComparison ? JSON.parse(algorithmComparison) : null,
        active_tests_count: this.activeTests.size,
      }
    } catch (error) {
      logger.error('取得快取統計失敗:', error)
      return null
    }
  }

  /**
   * 記錄推薦事件
   */
  async trackRecommendationEvent(eventData) {
    try {
      const {
        user_id,
        meme_id,
        algorithm,
        recommendation_score,
        recommendation_rank,
        ab_test_id,
        ab_test_variant,
        recommendation_context,
        user_features,
        meme_features,
      } = eventData

      // 建立推薦指標記錄
      const metrics = new RecommendationMetrics({
        user_id,
        meme_id,
        algorithm,
        recommendation_score,
        recommendation_rank,
        ab_test_id: ab_test_id || null,
        ab_test_variant: ab_test_variant || null,
        recommendation_context: {
          page: recommendation_context?.page || 'home',
          position: recommendation_context?.position || 1,
          session_id: recommendation_context?.session_id || null,
        },
        user_features: {
          is_new_user: user_features?.is_new_user || false,
          user_activity_level: user_features?.user_activity_level || 'low',
          user_preferences: user_features?.user_preferences || {},
        },
        meme_features: {
          type: meme_features?.type || 'text',
          tags: meme_features?.tags || [],
          hot_score: meme_features?.hot_score || 0,
          age_hours: meme_features?.age_hours || 0,
        },
      })

      await metrics.save()

      // 更新即時統計快取
      await this.updateMetricsCache()

      logger.debug(`記錄推薦事件: 用戶 ${user_id}, 迷因 ${meme_id}, 演算法 ${algorithm}`)

      return metrics._id
    } catch (error) {
      logger.error('記錄推薦事件失敗:', error)
      throw error
    }
  }

  /**
   * 更新互動事件
   */
  async updateInteractionEvent(metricsId, interactionData) {
    try {
      const { interaction_type, view_duration, user_rating } = interactionData

      const updateData = {
        interacted_at: new Date(),
      }

      switch (interaction_type) {
        case 'click':
          updateData.is_clicked = true
          break
        case 'like':
          updateData.is_liked = true
          break
        case 'share':
          updateData.is_shared = true
          break
        case 'comment':
          updateData.is_commented = true
          break
        case 'collect':
          updateData.is_collected = true
          break
        case 'dislike':
          updateData.is_disliked = true
          break
        case 'view':
          if (view_duration) {
            updateData.view_duration = view_duration
          }
          break
        case 'rate':
          if (user_rating && user_rating >= 1 && user_rating <= 5) {
            updateData.user_rating = user_rating
          }
          break
        default:
          throw new Error('無效的互動類型')
      }

      // 計算互動時間
      const metrics = await RecommendationMetrics.findById(metricsId)
      if (metrics && metrics.recommended_at && !metrics.time_to_interact) {
        updateData.time_to_interact = Math.floor(
          (Date.now() - metrics.recommended_at.getTime()) / 1000,
        )
      }

      await RecommendationMetrics.findByIdAndUpdate(metricsId, updateData)

      logger.debug(`更新互動事件: 記錄 ${metricsId}, 互動類型 ${interaction_type}`)
    } catch (error) {
      logger.error('更新互動事件失敗:', error)
      throw error
    }
  }

  /**
   * 取得監控狀態
   */
  getMonitoringStatus() {
    return {
      is_monitoring: this.isMonitoring,
      active_tests_count: this.activeTests.size,
      cache_prefix: this.cachePrefix,
      last_update: new Date().toISOString(),
    }
  }
}

// 建立單例實例
const analyticsMonitor = new AnalyticsMonitor()

export default analyticsMonitor
