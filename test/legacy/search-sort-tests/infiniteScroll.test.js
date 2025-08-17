/**
 * 無限捲動推薦測試
 * 測試分頁、排除功能和推薦多樣性
 */

import { vi, describe, test, expect, beforeEach, beforeAll } from 'vitest'
import {
  getInfiniteScrollRecommendations,
  getMixedRecommendations,
} from '../../../utils/mixedRecommendation.js'

// Mock 相關模組
vi.mock('../../../models/Meme.js', () => ({ default: {} }))
vi.mock('../../../models/User.js', () => ({ default: {} }))
vi.mock('../../../models/Like.js', () => ({ default: {} }))
vi.mock('../../../models/Comment.js', () => ({ default: {} }))
vi.mock('../../../models/Share.js', () => ({ default: {} }))
vi.mock('../../../models/Collection.js', () => ({ default: {} }))
vi.mock('../../../models/View.js', () => ({ default: {} }))
vi.mock('../../../config/redis.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    delPattern: vi.fn(),
  },
}))
vi.mock('../../../utils/hotScore.js', () => ({}))
vi.mock('../../../utils/contentBased.js', () => ({}))
vi.mock('../../../utils/collaborativeFiltering.js', () => ({}))
vi.mock('../../../utils/socialScoreCalculator.js', () => ({
  calculateMultipleMemeSocialScores: vi.fn().mockResolvedValue([
    {
      memeId: 'meme_0',
      socialScore: 5.0,
      distanceScore: 2.0,
      influenceScore: 3.0,
      interactionScore: 0,
      reasons: [],
      socialInteractions: [],
    },
  ]),
  calculateMemeSocialScore: vi.fn().mockResolvedValue({
    socialScore: 5.0,
    distanceScore: 2.0,
    influenceScore: 3.0,
    interactionScore: 0,
    reasons: [],
    socialInteractions: [],
  }),
}))
vi.mock('../../../utils/asyncProcessor.js', () => ({
  performanceMonitor: {
    start: vi.fn(),
    end: vi.fn(),
    getAllMetrics: vi.fn().mockReturnValue({}),
  },
  cacheProcessor: {
    processWithCache: vi.fn(async (key, processor) => {
      return await processor()
    }),
  },
}))
vi.mock('../../../utils/logger.js', () => ({ logger: {} }))

describe('無限捲動推薦測試', () => {
  beforeAll(async () => {
    // 確保可變的 Redis mock 物件存在
    const redisModule = await import('../../../config/redis.js')
    if (!redisModule.default) {
      // 若工廠回傳空物件，補上一個可指派的容器物件
      // @ts-ignore
      redisModule.default = {}
    }
  })

  beforeEach(async () => {
    // 清除所有 mock
    vi.clearAllMocks()

    // Mock Redis
    const redisMock = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      delPattern: vi.fn().mockResolvedValue(1),
    }
    const redisModule = await import('../../../config/redis.js')
    Object.assign(redisModule.default, redisMock)

    // Mock logger
    const loggerMock = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }
    const loggerModule = await import('../../../utils/logger.js')
    Object.assign(loggerModule.logger, loggerMock)

    // Mock performance monitor
    const performanceMonitorMock = {
      start: vi.fn(),
      end: vi.fn(),
      getAllMetrics: vi.fn().mockReturnValue({}),
    }
    const asyncProcessorModule = await import('../../../utils/asyncProcessor.js')
    Object.assign(asyncProcessorModule.performanceMonitor, performanceMonitorMock)
  })

  describe('getInfiniteScrollRecommendations', () => {
    test('應該正確處理分頁', async () => {
      // Mock 推薦結果
      const mockRecommendations = Array.from({ length: 50 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      // Mock getMixedRecommendations
      const getMixedRecommendationsMock = vi.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.5, latest: 0.5 },
        coldStartStatus: { isColdStart: false },
        queryInfo: { requestedLimit: 50, adjustedLimit: 50 },
      })

      // 替換實際函數
      const mixedMod = await import('../../../utils/mixedRecommendation.js')
      const originalGetMixedRecommendations = mixedMod.getMixedRecommendations
      const spy = vi
        .spyOn(mixedMod, 'getMixedRecommendations')
        .mockImplementation(getMixedRecommendationsMock)

      const result = await getInfiniteScrollRecommendations('user123', {
        page: 2,
        limit: 10,
        excludeIds: ['meme_0', 'meme_1'],
      })

      expect(result.recommendations).toHaveLength(10)
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.hasMore).toBe(true)
      expect(result.pagination.total).toBe(48) // 50 - 2 excluded
      expect(result.pagination.nextPage).toBe(3)

      // 恢復原始函數
      spy.mockRestore()
    })

    test('應該正確排除已顯示的項目', async () => {
      const mockRecommendations = Array.from({ length: 20 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      const getMixedRecommendationsMock = vi.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.5, latest: 0.5 },
        coldStartStatus: { isColdStart: false },
        queryInfo: { requestedLimit: 20, adjustedLimit: 20 },
      })

      const mixedMod2 = await import('../../../utils/mixedRecommendation.js')
      const originalGetMixedRecommendations2 = mixedMod2.getMixedRecommendations
      const spy2 = vi
        .spyOn(mixedMod2, 'getMixedRecommendations')
        .mockImplementation(getMixedRecommendationsMock)

      const excludeIds = ['meme_0', 'meme_1', 'meme_2']
      const result = await getInfiniteScrollRecommendations('user123', {
        page: 1,
        limit: 10,
        excludeIds,
      })

      // 檢查排除的項目不在結果中
      const resultIds = result.recommendations.map((r) => r._id)
      excludeIds.forEach((id) => {
        expect(resultIds).not.toContain(id)
      })

      expect(result.queryInfo.excludedCount).toBe(3)

      spy2.mockRestore()
    })

    test('應該處理最後一頁', async () => {
      const mockRecommendations = Array.from({ length: 15 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      const getMixedRecommendationsMock = vi.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.5, latest: 0.5 },
        coldStartStatus: { isColdStart: false },
        queryInfo: { requestedLimit: 15, adjustedLimit: 15 },
      })

      const mixedMod3 = await import('../../../utils/mixedRecommendation.js')
      const originalGetMixedRecommendations3 = mixedMod3.getMixedRecommendations
      const spy3 = vi
        .spyOn(mixedMod3, 'getMixedRecommendations')
        .mockImplementation(getMixedRecommendationsMock)

      const result = await getInfiniteScrollRecommendations('user123', {
        page: 2,
        limit: 10,
        excludeIds: [],
      })

      expect(result.pagination.hasMore).toBe(false)
      expect(result.pagination.nextPage).toBe(null)
      expect(result.recommendations).toHaveLength(5) // 15 - 10 = 5

      spy3.mockRestore()
    })

    test('應該處理匿名用戶', async () => {
      const mockRecommendations = Array.from({ length: 20 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      const getMixedRecommendationsMock = vi.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.8, latest: 0.2 },
        coldStartStatus: { isColdStart: true },
        queryInfo: { requestedLimit: 20, adjustedLimit: 40 },
      })

      const mixedMod4 = await import('../../../utils/mixedRecommendation.js')
      const originalGetMixedRecommendations4 = mixedMod4.getMixedRecommendations
      const spy4 = vi
        .spyOn(mixedMod4, 'getMixedRecommendations')
        .mockImplementation(getMixedRecommendationsMock)

      const result = await getInfiniteScrollRecommendations(null, {
        page: 1,
        limit: 10,
        excludeIds: [],
      })

      expect(result.userAuthenticated).toBe(false)
      expect(result.queryInfo.isColdStart).toBe(true)

      spy4.mockRestore()
    })
  })

  describe('getMixedRecommendations 分頁功能', () => {
    test('應該支援分頁參數', async () => {
      const mockRecommendations = Array.from({ length: 100 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      // Mock 各個推薦函數
      const mockGetHotRecommendations = vi.fn().mockResolvedValue(mockRecommendations)
      const mockGetLatestRecommendations = vi.fn().mockResolvedValue([])
      const mockGetContentBasedRecommendations = vi.fn().mockResolvedValue([])
      const mockGetCollaborativeFilteringRecommendations = vi.fn().mockResolvedValue([])
      const mockGetSocialCollaborativeFilteringRecommendations = vi.fn().mockResolvedValue([])

      // 替換實際函數
      const mixMod = await import('../../../utils/mixedRecommendation.js')
      const spyHot = vi
        .spyOn(mixMod, 'getHotRecommendations')
        .mockResolvedValue(mockRecommendations)
      const spyLatest = vi.spyOn(mixMod, 'getLatestRecommendations').mockResolvedValue([])
      const spyContent = vi.spyOn(mixMod, 'getContentBasedRecommendations').mockResolvedValue([])
      const spyCF = vi
        .spyOn(mixMod, 'getCollaborativeFilteringRecommendations')
        .mockResolvedValue([])
      const spySCF = vi
        .spyOn(mixMod, 'getSocialCollaborativeFilteringRecommendations')
        .mockResolvedValue([])

      const result = await getMixedRecommendations('user123', {
        limit: 20,
        page: 2,
        excludeIds: ['meme_0'],
      })

      expect(result.recommendations).toHaveLength(20)
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.limit).toBe(20)
      expect(result.pagination.skip).toBe(20)
      expect(result.pagination.total).toBe(99) // 100 - 1 excluded
      expect(result.pagination.hasMore).toBe(true)

      // 恢復原始函數
      spyHot.mockRestore()
      spyLatest.mockRestore()
      spyContent.mockRestore()
      spyCF.mockRestore()
      spySCF.mockRestore()
    })
  })
})
