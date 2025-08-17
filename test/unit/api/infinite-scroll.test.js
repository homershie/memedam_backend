import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
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

describe('無限滾動推薦測試', () => {
  beforeAll(async () => {
    // 確保可變的 Redis mock 物件存在
    const redisModule = await import('../../../config/redis.js')
    if (!redisModule.default) {
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
  })

  describe('getInfiniteScrollRecommendations', () => {
    it('應該返回正確格式的推薦結果', async () => {
      const userId = 'test_user_id'
      const page = 1
      const limit = 10
      const excludeIds = ['exclude_1', 'exclude_2']

      const result = await getInfiniteScrollRecommendations(userId, page, limit, excludeIds)

      expect(result).toHaveProperty('memes')
      expect(result).toHaveProperty('pagination')
      expect(result).toHaveProperty('recommendationStats')
      expect(Array.isArray(result.memes)).toBe(true)
    })

    it('應該處理不同的分頁參數', async () => {
      const userId = 'test_user_id'

      // 測試第一頁
      const page1Result = await getInfiniteScrollRecommendations(userId, 1, 5)
      expect(page1Result.pagination.page).toBe(1)
      expect(page1Result.pagination.limit).toBe(5)

      // 測試第二頁
      const page2Result = await getInfiniteScrollRecommendations(userId, 2, 5)
      expect(page2Result.pagination.page).toBe(2)
      expect(page2Result.pagination.limit).toBe(5)
    })

    it('應該正確排除指定的迷因 ID', async () => {
      const userId = 'test_user_id'
      const excludeIds = ['exclude_1', 'exclude_2']

      const result = await getInfiniteScrollRecommendations(userId, 1, 10, excludeIds)

      // 檢查返回的迷因不包含被排除的 ID
      result.memes.forEach((meme) => {
        expect(excludeIds).not.toContain(meme._id)
      })
    })

    it('應該處理空的排除列表', async () => {
      const userId = 'test_user_id'
      const excludeIds = []

      const result = await getInfiniteScrollRecommendations(userId, 1, 10, excludeIds)
      expect(result).toBeDefined()
      expect(Array.isArray(result.memes)).toBe(true)
    })

    it('應該處理無效的用戶 ID', async () => {
      const invalidUserId = null

      await expect(getInfiniteScrollRecommendations(invalidUserId, 1, 10)).rejects.toThrow()
    })
  })

  describe('getMixedRecommendations', () => {
    it('應該返回混合推薦結果', async () => {
      const userId = 'test_user_id'
      const options = {
        page: 1,
        limit: 10,
        excludeIds: ['exclude_1'],
        includeSocialScore: true,
      }

      const result = await getMixedRecommendations(userId, options)

      expect(result).toHaveProperty('memes')
      expect(result).toHaveProperty('pagination')
      expect(result).toHaveProperty('recommendationStats')
      expect(Array.isArray(result.memes)).toBe(true)
    })

    it('應該包含社交分數計算', async () => {
      const userId = 'test_user_id'
      const options = {
        page: 1,
        limit: 5,
        includeSocialScore: true,
      }

      const result = await getMixedRecommendations(userId, options)

      // 檢查是否包含社交分數
      result.memes.forEach((meme) => {
        expect(meme).toHaveProperty('socialScore')
        expect(typeof meme.socialScore).toBe('number')
      })
    })

    it('應該處理不同的推薦策略', async () => {
      const userId = 'test_user_id'

      // 測試熱門推薦
      const hotResult = await getMixedRecommendations(userId, {
        page: 1,
        limit: 5,
        strategy: 'hot',
      })

      // 測試最新推薦
      const latestResult = await getMixedRecommendations(userId, {
        page: 1,
        limit: 5,
        strategy: 'latest',
      })

      expect(hotResult).toBeDefined()
      expect(latestResult).toBeDefined()
      expect(Array.isArray(hotResult.memes)).toBe(true)
      expect(Array.isArray(latestResult.memes)).toBe(true)
    })

    it('應該處理推薦統計資訊', async () => {
      const userId = 'test_user_id'
      const options = {
        page: 1,
        limit: 10,
        includeStats: true,
      }

      const result = await getMixedRecommendations(userId, options)

      expect(result.recommendationStats).toHaveProperty('totalProcessed')
      expect(result.recommendationStats).toHaveProperty('processingTime')
      expect(result.recommendationStats).toHaveProperty('cacheHitRate')
    })
  })

  describe('分頁功能', () => {
    it('應該正確計算分頁資訊', async () => {
      const userId = 'test_user_id'
      const page = 2
      const limit = 5

      const result = await getInfiniteScrollRecommendations(userId, page, limit)

      expect(result.pagination).toHaveProperty('page')
      expect(result.pagination).toHaveProperty('limit')
      expect(result.pagination).toHaveProperty('total')
      expect(result.pagination).toHaveProperty('totalPages')
      expect(result.pagination).toHaveProperty('hasNext')
      expect(result.pagination).toHaveProperty('hasPrev')
    })

    it('應該處理邊界分頁', async () => {
      const userId = 'test_user_id'

      // 測試超出範圍的頁面
      const result = await getInfiniteScrollRecommendations(userId, 999, 10)
      expect(result.memes.length).toBe(0)
      expect(result.pagination.hasNext).toBe(false)
    })
  })

  describe('性能監控', () => {
    it('應該記錄性能指標', async () => {
      const userId = 'test_user_id'

      await getInfiniteScrollRecommendations(userId, 1, 10)

      // 檢查性能監控是否被調用
      const { performanceMonitor } = await import('../../../utils/asyncProcessor.js')
      expect(performanceMonitor.start).toHaveBeenCalled()
      expect(performanceMonitor.end).toHaveBeenCalled()
    })
  })

  describe('快取功能', () => {
    it('應該使用快取處理器', async () => {
      const userId = 'test_user_id'

      await getInfiniteScrollRecommendations(userId, 1, 10)

      // 檢查快取處理器是否被調用
      const { cacheProcessor } = await import('../../../utils/asyncProcessor.js')
      expect(cacheProcessor.processWithCache).toHaveBeenCalled()
    })
  })
})
