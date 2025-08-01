/**
 * 無限捲動推薦測試
 * 測試分頁、排除功能和推薦多樣性
 */

import { jest } from '@jest/globals'
import {
  getInfiniteScrollRecommendations,
  getMixedRecommendations,
} from '../utils/mixedRecommendation.js'
import { clearMixedRecommendationCache } from '../utils/mixedRecommendation.js'

// Mock 相關模組
jest.mock('../models/Meme.js')
jest.mock('../models/User.js')
jest.mock('../models/Like.js')
jest.mock('../models/Comment.js')
jest.mock('../models/Share.js')
jest.mock('../models/Collection.js')
jest.mock('../models/View.js')
jest.mock('../config/redis.js')
jest.mock('../utils/hotScore.js')
jest.mock('../utils/contentBased.js')
jest.mock('../utils/collaborativeFiltering.js')
jest.mock('../utils/socialScoreCalculator.js')
jest.mock('../utils/asyncProcessor.js')
jest.mock('../utils/logger.js')

describe('無限捲動推薦測試', () => {
  beforeEach(() => {
    // 清除所有 mock
    jest.clearAllMocks()

    // Mock Redis
    const redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      delPattern: jest.fn().mockResolvedValue(1),
    }
    require('../config/redis.js').default = redisMock

    // Mock logger
    const loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    }
    require('../utils/logger.js').logger = loggerMock

    // Mock performance monitor
    const performanceMonitorMock = {
      start: jest.fn(),
      end: jest.fn(),
      getAllMetrics: jest.fn().mockReturnValue({}),
    }
    require('../utils/asyncProcessor.js').performanceMonitor = performanceMonitorMock
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
      const getMixedRecommendationsMock = jest.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.5, latest: 0.5 },
        coldStartStatus: { isColdStart: false },
        queryInfo: { requestedLimit: 50, adjustedLimit: 50 },
      })

      // 替換實際函數
      const originalGetMixedRecommendations = getMixedRecommendations
      getMixedRecommendations.mockImplementation(getMixedRecommendationsMock)

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
      getMixedRecommendations.mockImplementation(originalGetMixedRecommendations)
    })

    test('應該正確排除已顯示的項目', async () => {
      const mockRecommendations = Array.from({ length: 20 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      const getMixedRecommendationsMock = jest.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.5, latest: 0.5 },
        coldStartStatus: { isColdStart: false },
        queryInfo: { requestedLimit: 20, adjustedLimit: 20 },
      })

      const originalGetMixedRecommendations = getMixedRecommendations
      getMixedRecommendations.mockImplementation(getMixedRecommendationsMock)

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

      getMixedRecommendations.mockImplementation(originalGetMixedRecommendations)
    })

    test('應該處理最後一頁', async () => {
      const mockRecommendations = Array.from({ length: 15 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      const getMixedRecommendationsMock = jest.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.5, latest: 0.5 },
        coldStartStatus: { isColdStart: false },
        queryInfo: { requestedLimit: 15, adjustedLimit: 15 },
      })

      const originalGetMixedRecommendations = getMixedRecommendations
      getMixedRecommendations.mockImplementation(getMixedRecommendationsMock)

      const result = await getInfiniteScrollRecommendations('user123', {
        page: 2,
        limit: 10,
        excludeIds: [],
      })

      expect(result.pagination.hasMore).toBe(false)
      expect(result.pagination.nextPage).toBe(null)
      expect(result.recommendations).toHaveLength(5) // 15 - 10 = 5

      getMixedRecommendations.mockImplementation(originalGetMixedRecommendations)
    })

    test('應該處理匿名用戶', async () => {
      const mockRecommendations = Array.from({ length: 20 }, (_, i) => ({
        _id: `meme_${i}`,
        title: `Meme ${i}`,
        hot_score: 100 - i,
        recommendation_score: 100 - i,
        recommendation_type: 'hot',
      }))

      const getMixedRecommendationsMock = jest.fn().mockResolvedValue({
        recommendations: mockRecommendations,
        weights: { hot: 0.8, latest: 0.2 },
        coldStartStatus: { isColdStart: true },
        queryInfo: { requestedLimit: 20, adjustedLimit: 40 },
      })

      const originalGetMixedRecommendations = getMixedRecommendations
      getMixedRecommendations.mockImplementation(getMixedRecommendationsMock)

      const result = await getInfiniteScrollRecommendations(null, {
        page: 1,
        limit: 10,
        excludeIds: [],
      })

      expect(result.userAuthenticated).toBe(false)
      expect(result.queryInfo.isColdStart).toBe(true)

      getMixedRecommendations.mockImplementation(originalGetMixedRecommendations)
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
      const mockGetHotRecommendations = jest.fn().mockResolvedValue(mockRecommendations)
      const mockGetLatestRecommendations = jest.fn().mockResolvedValue([])
      const mockGetContentBasedRecommendations = jest.fn().mockResolvedValue([])
      const mockGetCollaborativeFilteringRecommendations = jest.fn().mockResolvedValue([])
      const mockGetSocialCollaborativeFilteringRecommendations = jest.fn().mockResolvedValue([])

      // 替換實際函數
      const originalGetHotRecommendations =
        require('../utils/mixedRecommendation.js').getHotRecommendations
      const originalGetLatestRecommendations =
        require('../utils/mixedRecommendation.js').getLatestRecommendations
      const originalGetContentBasedRecommendations =
        require('../utils/mixedRecommendation.js').getContentBasedRecommendations
      const originalGetCollaborativeFilteringRecommendations =
        require('../utils/mixedRecommendation.js').getCollaborativeFilteringRecommendations
      const originalGetSocialCollaborativeFilteringRecommendations =
        require('../utils/mixedRecommendation.js').getSocialCollaborativeFilteringRecommendations

      require('../utils/mixedRecommendation.js').getHotRecommendations = mockGetHotRecommendations
      require('../utils/mixedRecommendation.js').getLatestRecommendations =
        mockGetLatestRecommendations
      require('../utils/mixedRecommendation.js').getContentBasedRecommendations =
        mockGetContentBasedRecommendations
      require('../utils/mixedRecommendation.js').getCollaborativeFilteringRecommendations =
        mockGetCollaborativeFilteringRecommendations
      require('../utils/mixedRecommendation.js').getSocialCollaborativeFilteringRecommendations =
        mockGetSocialCollaborativeFilteringRecommendations

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
      require('../utils/mixedRecommendation.js').getHotRecommendations =
        originalGetHotRecommendations
      require('../utils/mixedRecommendation.js').getLatestRecommendations =
        originalGetLatestRecommendations
      require('../utils/mixedRecommendation.js').getContentBasedRecommendations =
        originalGetContentBasedRecommendations
      require('../utils/mixedRecommendation.js').getCollaborativeFilteringRecommendations =
        originalGetCollaborativeFilteringRecommendations
      require('../utils/mixedRecommendation.js').getSocialCollaborativeFilteringRecommendations =
        originalGetSocialCollaborativeFilteringRecommendations
    })
  })
})
