/**
 * 分析與監控系統測試
 * 測試推薦效果指標和 A/B 測試功能
 */

import { jest } from '@jest/globals'
import mongoose from 'mongoose'
import RecommendationMetrics from '../models/RecommendationMetrics.js'
import ABTest from '../models/ABTest.js'
import analyticsMonitor from '../utils/analyticsMonitor.js'

// Mock Redis
jest.mock('../config/redis.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delPattern: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getStats: jest.fn(() => ({ connected: true, keys: 0 })),
}))

// Mock logger
jest.mock('../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

describe('Analytics and Monitoring System', () => {
  let testUserId
  let testMemeId

  beforeAll(async () => {
    // 建立測試用戶和迷因 ID
    testUserId = new mongoose.Types.ObjectId()
    testMemeId = new mongoose.Types.ObjectId()
  })

  beforeEach(async () => {
    // 清理測試資料
    await RecommendationMetrics.deleteMany({})
    await ABTest.deleteMany({})

    // 重置 mock
    jest.clearAllMocks()
  })

  afterAll(async () => {
    // 清理所有測試資料
    await RecommendationMetrics.deleteMany({})
    await ABTest.deleteMany({})
  })

  describe('RecommendationMetrics Model', () => {
    test('should create recommendation metrics record', async () => {
      const metricsData = {
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      }

      const metrics = new RecommendationMetrics(metricsData)
      await metrics.save()

      expect(metrics._id).toBeDefined()
      expect(metrics.algorithm).toBe('mixed')
      expect(metrics.recommendation_score).toBe(0.85)
      expect(metrics.recommended_at).toBeDefined()
    })

    test('should calculate engagement rate correctly', async () => {
      const metrics = new RecommendationMetrics({
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        is_liked: true,
        is_shared: true,
        is_commented: false,
        is_collected: false,
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      })

      await metrics.save()

      expect(metrics.calculated_metrics.engagement_rate).toBe(0.5) // 2 interactions / 4 types
    })

    test('should calculate satisfaction score from rating', async () => {
      const metrics = new RecommendationMetrics({
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        user_rating: 4,
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      })

      await metrics.save()

      expect(metrics.calculated_metrics.satisfaction_score).toBe(0.8) // 4/5
    })

    test('should get algorithm stats', async () => {
      // 建立測試資料
      const testData = [
        {
          user_id: testUserId,
          meme_id: testMemeId,
          algorithm: 'mixed',
          recommendation_score: 0.85,
          recommendation_rank: 1,
          is_clicked: true,
          is_liked: true,
          meme_features: { type: 'image', tags: [], hot_score: 0.75, age_hours: 24 },
        },
        {
          user_id: testUserId,
          meme_id: testMemeId,
          algorithm: 'hot',
          recommendation_score: 0.75,
          recommendation_rank: 2,
          is_clicked: false,
          is_liked: false,
          meme_features: { type: 'image', tags: [], hot_score: 0.75, age_hours: 24 },
        },
      ]

      for (const data of testData) {
        const metrics = new RecommendationMetrics(data)
        await metrics.save()
      }

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const endDate = new Date()

      const stats = await RecommendationMetrics.getAlgorithmStats('mixed', startDate, endDate)

      expect(stats.total_recommendations).toBe(1)
      expect(stats.ctr).toBe(1)
      expect(stats.engagement_rate).toBe(0.25) // 1 like / 4 interaction types
    })
  })

  describe('ABTest Model', () => {
    test('should create A/B test', async () => {
      const testData = {
        test_id: 'test_001',
        name: '演算法比較測試',
        description: '測試不同演算法效果',
        test_type: 'algorithm_comparison',
        primary_metric: 'engagement_rate',
        variants: [
          {
            variant_id: 'A',
            name: '現有演算法',
            configuration: { hot_weight: 0.3, content_weight: 0.4 },
            traffic_percentage: 50,
          },
          {
            variant_id: 'B',
            name: '新演算法',
            configuration: { hot_weight: 0.2, content_weight: 0.5 },
            traffic_percentage: 50,
          },
        ],
        start_date: new Date(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_by: testUserId,
      }

      const abTest = new ABTest(testData)
      await abTest.save()

      expect(abTest._id).toBeDefined()
      expect(abTest.test_id).toBe('test_001')
      expect(abTest.status).toBe('draft')
      expect(abTest.variants).toHaveLength(2)
    })

    test('should validate traffic percentage sum', async () => {
      const testData = {
        test_id: 'test_002',
        name: '無效測試',
        test_type: 'algorithm_comparison',
        primary_metric: 'engagement_rate',
        variants: [
          {
            variant_id: 'A',
            name: '變體 A',
            configuration: {},
            traffic_percentage: 30,
          },
          {
            variant_id: 'B',
            name: '變體 B',
            configuration: {},
            traffic_percentage: 30,
          },
        ],
        start_date: new Date(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_by: testUserId,
      }

      const abTest = new ABTest(testData)

      await expect(abTest.save()).rejects.toThrow('變體流量分配總和必須為 100%')
    })

    test('should check statistical significance', async () => {
      const abTest = new ABTest({
        test_id: 'test_003',
        name: '統計測試',
        test_type: 'algorithm_comparison',
        primary_metric: 'engagement_rate',
        variants: [
          {
            variant_id: 'A',
            name: '變體 A',
            configuration: {},
            traffic_percentage: 50,
          },
          {
            variant_id: 'B',
            name: '變體 B',
            configuration: {},
            traffic_percentage: 50,
          },
        ],
        start_date: new Date(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_by: testUserId,
        automation: {
          minimum_improvement: 0.05,
        },
      })

      // 設定測試結果
      abTest.results.metric_results = {
        A: { engagement_rate: 0.3 },
        B: { engagement_rate: 0.4 },
      }

      const isSignificant = abTest.checkStatisticalSignificance()
      expect(isSignificant).toBe(true)
    })

    test('should select winner variant', async () => {
      const abTest = new ABTest({
        test_id: 'test_004',
        name: '獲勝者測試',
        test_type: 'algorithm_comparison',
        primary_metric: 'engagement_rate',
        variants: [
          {
            variant_id: 'A',
            name: '變體 A',
            configuration: {},
            traffic_percentage: 50,
          },
          {
            variant_id: 'B',
            name: '變體 B',
            configuration: {},
            traffic_percentage: 50,
          },
        ],
        start_date: new Date(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_by: testUserId,
        automation: {
          minimum_improvement: 0.05,
        },
      })

      // 設定測試結果
      abTest.results.metric_results = {
        A: { engagement_rate: 0.3 },
        B: { engagement_rate: 0.4 },
      }

      const winner = abTest.selectWinner()
      expect(winner).toBe('B')
      expect(abTest.results.winner_variant).toBe('B')
    })
  })

  describe('AnalyticsMonitor', () => {
    test('should start monitoring', async () => {
      await analyticsMonitor.startMonitoring()

      expect(analyticsMonitor.isMonitoring).toBe(true)
    })

    test('should stop monitoring', async () => {
      await analyticsMonitor.startMonitoring()
      await analyticsMonitor.stopMonitoring()

      expect(analyticsMonitor.isMonitoring).toBe(false)
    })

    test('should track recommendation event', async () => {
      const eventData = {
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        recommendation_context: {
          page: 'home',
          position: 1,
        },
        user_features: {
          is_new_user: false,
          user_activity_level: 'high',
        },
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      }

      const metricsId = await analyticsMonitor.trackRecommendationEvent(eventData)

      expect(metricsId).toBeDefined()

      // 驗證記錄是否建立
      const metrics = await RecommendationMetrics.findById(metricsId)
      expect(metrics).toBeDefined()
      expect(metrics.algorithm).toBe('mixed')
      expect(metrics.user_id.toString()).toBe(testUserId.toString())
    })

    test('should update interaction event', async () => {
      // 先建立推薦記錄
      const metrics = new RecommendationMetrics({
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      })
      await metrics.save()

      // 更新互動事件
      const interactionData = {
        interaction_type: 'like',
        view_duration: 30,
      }

      await analyticsMonitor.updateInteractionEvent(metrics._id, interactionData)

      // 驗證更新
      const updatedMetrics = await RecommendationMetrics.findById(metrics._id)
      expect(updatedMetrics.is_liked).toBe(true)
      expect(updatedMetrics.view_duration).toBe(30)
      expect(updatedMetrics.interacted_at).toBeDefined()
    })

    test('should get monitoring status', () => {
      const status = analyticsMonitor.getMonitoringStatus()

      expect(status).toHaveProperty('is_monitoring')
      expect(status).toHaveProperty('active_tests_count')
      expect(status).toHaveProperty('cache_prefix')
      expect(status).toHaveProperty('last_update')
    })

    test('should get realtime stats', async () => {
      // 建立測試資料
      const metrics = new RecommendationMetrics({
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        is_clicked: true,
        is_liked: true,
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      })
      await metrics.save()

      const startDate = new Date(Date.now() - 60 * 60 * 1000)
      const endDate = new Date()

      const stats = await analyticsMonitor.getRealtimeStats(startDate, endDate)

      expect(stats.total_recommendations).toBe(1)
      expect(stats.ctr).toBe(1)
      expect(stats.engagement_rate).toBe(0.25)
    })

    test('should get daily stats', async () => {
      // 建立測試資料
      const metrics = new RecommendationMetrics({
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        is_clicked: true,
        meme_features: {
          type: 'image',
          tags: ['funny'],
          hot_score: 0.75,
          age_hours: 24,
        },
      })
      await metrics.save()

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const endDate = new Date()

      const stats = await analyticsMonitor.getDailyStats(startDate, endDate)

      expect(stats).toHaveLength(1)
      expect(stats[0].total_recommendations).toBe(1)
      expect(stats[0].ctr).toBe(1)
    })

    test('should get algorithm comparison', async () => {
      // 建立測試資料
      const testData = [
        {
          user_id: testUserId,
          meme_id: testMemeId,
          algorithm: 'mixed',
          recommendation_score: 0.85,
          recommendation_rank: 1,
          is_clicked: true,
          meme_features: { type: 'image', tags: [], hot_score: 0.75, age_hours: 24 },
        },
        {
          user_id: testUserId,
          meme_id: testMemeId,
          algorithm: 'hot',
          recommendation_score: 0.75,
          recommendation_rank: 2,
          is_clicked: false,
          meme_features: { type: 'image', tags: [], hot_score: 0.75, age_hours: 24 },
        },
      ]

      for (const data of testData) {
        const metrics = new RecommendationMetrics(data)
        await metrics.save()
      }

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const endDate = new Date()

      const comparison = await analyticsMonitor.getAlgorithmComparison(startDate, endDate)

      expect(comparison).toHaveLength(2)
      expect(comparison.find((c) => c.algorithm === 'mixed').ctr).toBe(1)
      expect(comparison.find((c) => c.algorithm === 'hot').ctr).toBe(0)
    })
  })

  describe('Integration Tests', () => {
    test('should complete full analytics workflow', async () => {
      // 1. 建立 A/B 測試
      const abTest = new ABTest({
        test_id: 'integration_test_001',
        name: '整合測試',
        test_type: 'algorithm_comparison',
        primary_metric: 'engagement_rate',
        variants: [
          {
            variant_id: 'A',
            name: '變體 A',
            configuration: {},
            traffic_percentage: 50,
          },
          {
            variant_id: 'B',
            name: '變體 B',
            configuration: {},
            traffic_percentage: 50,
          },
        ],
        start_date: new Date(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_by: testUserId,
      })
      await abTest.save()

      // 2. 記錄推薦事件
      const eventData = {
        user_id: testUserId,
        meme_id: testMemeId,
        algorithm: 'mixed',
        recommendation_score: 0.85,
        recommendation_rank: 1,
        ab_test_id: 'integration_test_001',
        ab_test_variant: 'A',
        recommendation_context: { page: 'home', position: 1 },
        user_features: { is_new_user: false, user_activity_level: 'high' },
        meme_features: { type: 'image', tags: ['funny'], hot_score: 0.75, age_hours: 24 },
      }

      const metricsId = await analyticsMonitor.trackRecommendationEvent(eventData)

      // 3. 更新互動事件
      await analyticsMonitor.updateInteractionEvent(metricsId, {
        interaction_type: 'like',
        view_duration: 30,
      })

      // 4. 驗證結果
      const metrics = await RecommendationMetrics.findById(metricsId)
      expect(metrics.ab_test_id).toBe('integration_test_001')
      expect(metrics.ab_test_variant).toBe('A')
      expect(metrics.is_liked).toBe(true)
      expect(metrics.view_duration).toBe(30)

      // 5. 取得統計
      const stats = await RecommendationMetrics.getAlgorithmStats(
        'mixed',
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
      )
      expect(stats.total_recommendations).toBe(1)
      expect(stats.total_likes).toBe(1)
    })
  })
})
