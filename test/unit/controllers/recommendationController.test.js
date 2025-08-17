import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as recommendationController from '../../../controllers/recommendationController.js'

// Mock dependencies
vi.mock('../../../models/Meme.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../../../models/View.js', () => ({
  default: {
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../models/Like.js', () => ({
  default: {
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../models/RecommendationMetrics.js', () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('../../../utils/mixedRecommendation.js', () => ({
  getMixedRecommendations: vi.fn(),
  getInfiniteScrollRecommendations: vi.fn(),
}))

vi.mock('../../../utils/collaborativeFiltering.js', () => ({
  getCollaborativeRecommendations: vi.fn(),
}))

vi.mock('../../../utils/contentBased.js', () => ({
  getContentBasedRecommendations: vi.fn(),
}))

vi.mock('../../../utils/socialScoreCalculator.js', () => ({
  calculateSocialScore: vi.fn(),
  getSocialRecommendations: vi.fn(),
}))

describe('Recommendation Controller', () => {
  let req, res, next
  let Meme, User, View, Like, RecommendationMetrics

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked models
    const MemeModule = await import('../../../models/Meme.js')
    const UserModule = await import('../../../models/User.js')
    const ViewModule = await import('../../../models/View.js')
    const LikeModule = await import('../../../models/Like.js')
    const RecommendationMetricsModule = await import('../../../models/RecommendationMetrics.js')

    Meme = MemeModule.default
    User = UserModule.default
    View = ViewModule.default
    Like = LikeModule.default
    RecommendationMetrics = RecommendationMetricsModule.default

    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
    }

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    }

    next = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getRecommendations', () => {
    it('應該返回個人化推薦', async () => {
      req.user = { id: 'user123' }
      req.query = {
        page: '1',
        limit: '10',
        algorithm: 'mixed',
      }

      const mockRecommendations = {
        recommendations: [
          {
            _id: 'meme1',
            title: 'Recommended Meme 1',
            score: 0.95,
          },
          {
            _id: 'meme2',
            title: 'Recommended Meme 2',
            score: 0.85,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          hasMore: false,
        },
        algorithm: 'mixed',
        weights: {
          hot: 0.3,
          latest: 0.2,
          collaborative: 0.3,
          content: 0.2,
        },
      }

      const mixedRecommendation = await import('../../../utils/mixedRecommendation.js')
      mixedRecommendation.getMixedRecommendations.mockResolvedValue(mockRecommendations)

      await recommendationController.getRecommendations(req, res, next)

      expect(mixedRecommendation.getMixedRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          page: 1,
          limit: 10,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          ...mockRecommendations,
        }),
      )
    })

    it('應該為匿名用戶返回熱門推薦', async () => {
      req.user = null
      req.query = {
        page: '1',
        limit: '10',
      }

      const mockMemes = [
        {
          _id: 'meme1',
          title: 'Hot Meme 1',
          hotScore: 100,
        },
        {
          _id: 'meme2',
          title: 'Hot Meme 2',
          hotScore: 90,
        },
      ]

      Meme.find.mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockMemes),
      })

      Meme.countDocuments.mockResolvedValue(2)

      await recommendationController.getRecommendations(req, res, next)

      expect(Meme.find).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          recommendations: mockMemes,
          algorithm: 'hot',
        }),
      )
    })

    it('應該支援不同的推薦算法', async () => {
      req.user = { id: 'user123' }
      req.query = {
        algorithm: 'collaborative',
        page: '1',
        limit: '10',
      }

      const mockRecommendations = [
        { _id: 'meme1', score: 0.9 },
        { _id: 'meme2', score: 0.8 },
      ]

      const collaborativeFiltering = await import('../../../utils/collaborativeFiltering.js')
      collaborativeFiltering.getCollaborativeRecommendations.mockResolvedValue({
        recommendations: mockRecommendations,
        algorithm: 'collaborative',
      })

      await recommendationController.getRecommendations(req, res, next)

      expect(collaborativeFiltering.getCollaborativeRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.any(Object),
      )
    })
  })

  describe('getInfiniteScrollRecommendations', () => {
    it('應該返回無限滾動推薦', async () => {
      req.user = { id: 'user123' }
      req.query = {
        page: '1',
        limit: '20',
        excludeIds: 'meme1,meme2',
      }

      const mockRecommendations = {
        recommendations: Array(20)
          .fill(null)
          .map((_, i) => ({
            _id: `meme${i + 3}`,
            title: `Meme ${i + 3}`,
          })),
        pagination: {
          page: 1,
          limit: 20,
          hasMore: true,
          nextPage: 2,
        },
        userAuthenticated: true,
      }

      const mixedRecommendation = await import('../../../utils/mixedRecommendation.js')
      mixedRecommendation.getInfiniteScrollRecommendations.mockResolvedValue(mockRecommendations)

      await recommendationController.getInfiniteScrollRecommendations(req, res, next)

      expect(mixedRecommendation.getInfiniteScrollRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          page: 1,
          limit: 20,
          excludeIds: ['meme1', 'meme2'],
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          ...mockRecommendations,
        }),
      )
    })

    it('應該處理匿名用戶的無限滾動', async () => {
      req.user = null
      req.query = {
        page: '2',
        limit: '10',
      }

      const mockRecommendations = {
        recommendations: Array(10)
          .fill(null)
          .map((_, i) => ({
            _id: `meme${i + 11}`,
            title: `Meme ${i + 11}`,
          })),
        pagination: {
          page: 2,
          limit: 10,
          hasMore: true,
        },
        userAuthenticated: false,
      }

      const mixedRecommendation = await import('../../../utils/mixedRecommendation.js')
      mixedRecommendation.getInfiniteScrollRecommendations.mockResolvedValue(mockRecommendations)

      await recommendationController.getInfiniteScrollRecommendations(req, res, next)

      expect(mixedRecommendation.getInfiniteScrollRecommendations).toHaveBeenCalledWith(
        null,
        expect.any(Object),
      )
    })
  })

  describe('getSimilarMemes', () => {
    it('應該返回相似迷因推薦', async () => {
      req.params = { memeId: 'meme123' }
      req.query = {
        limit: '5',
      }

      const mockSourceMeme = {
        _id: 'meme123',
        tags: ['funny', 'cat'],
        author: 'user456',
      }

      const mockSimilarMemes = [
        {
          _id: 'meme456',
          title: 'Similar Meme 1',
          tags: ['funny', 'cat'],
          similarity: 0.9,
        },
        {
          _id: 'meme789',
          title: 'Similar Meme 2',
          tags: ['funny', 'dog'],
          similarity: 0.7,
        },
      ]

      Meme.findById.mockResolvedValue(mockSourceMeme)

      const contentBased = await import('../../../utils/contentBased.js')
      contentBased.getContentBasedRecommendations.mockResolvedValue({
        recommendations: mockSimilarMemes,
      })

      await recommendationController.getSimilarMemes(req, res, next)

      expect(Meme.findById).toHaveBeenCalledWith('meme123')
      expect(contentBased.getContentBasedRecommendations).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          sourceMeme: mockSourceMeme,
          limit: 5,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          memes: mockSimilarMemes,
        }),
      )
    })

    it('應該處理迷因不存在的情況', async () => {
      req.params = { memeId: 'nonexistent' }

      Meme.findById.mockResolvedValue(null)

      await recommendationController.getSimilarMemes(req, res, next)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('找不到'),
        }),
      )
    })
  })

  describe('getUserPreferences', () => {
    it('應該返回用戶偏好分析', async () => {
      req.user = { id: 'user123' }

      const mockUser = {
        _id: 'user123',
        preferences: {
          tags: ['funny', 'meme', 'cat'],
          categories: ['humor', 'animals'],
        },
      }

      const mockViewHistory = [
        { tags: ['funny', 'cat'], count: 10 },
        { tags: ['meme'], count: 8 },
      ]

      const mockLikeHistory = [
        { tags: ['funny'], count: 15 },
        { tags: ['cat', 'cute'], count: 12 },
      ]

      User.findById.mockResolvedValue(mockUser)
      View.aggregate.mockResolvedValue(mockViewHistory)
      Like.aggregate.mockResolvedValue(mockLikeHistory)

      await recommendationController.getUserPreferences(req, res, next)

      expect(User.findById).toHaveBeenCalledWith('user123')
      expect(View.aggregate).toHaveBeenCalled()
      expect(Like.aggregate).toHaveBeenCalled()

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          preferences: expect.objectContaining({
            tags: expect.any(Array),
            categories: expect.any(Array),
            viewHistory: mockViewHistory,
            likeHistory: mockLikeHistory,
          }),
        }),
      )
    })
  })

  describe('updateUserPreferences', () => {
    it('應該更新用戶偏好設定', async () => {
      req.user = { id: 'user123' }
      req.body = {
        tags: ['gaming', 'tech', 'funny'],
        categories: ['technology', 'gaming'],
        excludeTags: ['nsfw', 'politics'],
      }

      const mockUpdatedUser = {
        _id: 'user123',
        preferences: {
          tags: ['gaming', 'tech', 'funny'],
          categories: ['technology', 'gaming'],
          excludeTags: ['nsfw', 'politics'],
        },
      }

      User.findByIdAndUpdate.mockResolvedValue(mockUpdatedUser)

      await recommendationController.updateUserPreferences(req, res, next)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        {
          $set: {
            'preferences.tags': ['gaming', 'tech', 'funny'],
            'preferences.categories': ['technology', 'gaming'],
            'preferences.excludeTags': ['nsfw', 'politics'],
          },
        },
        expect.objectContaining({
          new: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          preferences: mockUpdatedUser.preferences,
        }),
      )
    })
  })

  describe('getRecommendationMetrics', () => {
    it('應該返回推薦系統指標', async () => {
      req.user = { id: 'user123' }
      req.query = {
        period: '7d',
      }

      const mockMetrics = [
        {
          date: new Date(),
          algorithm: 'mixed',
          clickThroughRate: 0.15,
          engagementRate: 0.25,
          recommendationsServed: 1000,
          recommendationsClicked: 150,
        },
      ]

      RecommendationMetrics.aggregate.mockResolvedValue(mockMetrics)

      await recommendationController.getRecommendationMetrics(req, res, next)

      expect(RecommendationMetrics.aggregate).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          metrics: mockMetrics,
        }),
      )
    })
  })

  describe('trackRecommendationClick', () => {
    it('應該記錄推薦點擊', async () => {
      req.user = { id: 'user123' }
      req.body = {
        memeId: 'meme123',
        algorithm: 'mixed',
        position: 3,
        score: 0.85,
      }

      const mockMetric = {
        _id: 'metric123',
        userId: 'user123',
        memeId: 'meme123',
        algorithm: 'mixed',
        position: 3,
        score: 0.85,
        clicked: true,
        timestamp: new Date(),
      }

      RecommendationMetrics.create.mockResolvedValue(mockMetric)

      await recommendationController.trackRecommendationClick(req, res, next)

      expect(RecommendationMetrics.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          memeId: 'meme123',
          algorithm: 'mixed',
          position: 3,
          score: 0.85,
          clicked: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('記錄成功'),
        }),
      )
    })
  })

  describe('getTrendingTags', () => {
    it('應該返回熱門標籤', async () => {
      req.query = {
        limit: '10',
        period: '24h',
      }

      const mockTrendingTags = [
        { tag: 'funny', count: 500, trend: 'up' },
        { tag: 'meme', count: 450, trend: 'stable' },
        { tag: 'cat', count: 380, trend: 'up' },
        { tag: 'gaming', count: 320, trend: 'down' },
      ]

      Meme.aggregate.mockResolvedValue(mockTrendingTags)

      await recommendationController.getTrendingTags(req, res, next)

      expect(Meme.aggregate).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          tags: mockTrendingTags,
        }),
      )
    })
  })

  describe('getPersonalizedFeed', () => {
    it('應該返回個人化動態', async () => {
      req.user = { id: 'user123' }
      req.query = {
        page: '1',
        limit: '15',
        includeFollowing: 'true',
      }

      const mockFeed = {
        posts: [
          {
            _id: 'meme1',
            title: 'Following User Meme',
            author: { _id: 'user456', username: 'friend1' },
            isFromFollowing: true,
          },
          {
            _id: 'meme2',
            title: 'Recommended Meme',
            author: { _id: 'user789', username: 'creator1' },
            isFromFollowing: false,
          },
        ],
        pagination: {
          page: 1,
          limit: 15,
          total: 30,
          hasMore: true,
        },
        sources: {
          following: 5,
          recommended: 10,
        },
      }

      const socialScore = await import('../../../utils/socialScoreCalculator.js')
      socialScore.getSocialRecommendations.mockResolvedValue(mockFeed)

      await recommendationController.getPersonalizedFeed(req, res, next)

      expect(socialScore.getSocialRecommendations).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          page: 1,
          limit: 15,
          includeFollowing: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          ...mockFeed,
        }),
      )
    })
  })

  describe('resetRecommendations', () => {
    it('應該重置用戶推薦緩存', async () => {
      req.user = { id: 'user123' }

      User.findByIdAndUpdate.mockResolvedValue({
        _id: 'user123',
        recommendationCache: null,
        lastRecommendationReset: new Date(),
      })

      await recommendationController.resetRecommendations(req, res, next)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        {
          $unset: { recommendationCache: 1 },
          $set: { lastRecommendationReset: expect.any(Date) },
        },
        expect.objectContaining({
          new: true,
        }),
      )

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('重置成功'),
        }),
      )
    })
  })
})
