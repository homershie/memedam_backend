/**
 * 混合推薦系統測試
 */

import { vi, describe, it, beforeEach, expect } from 'vitest'
import {
  getMixedRecommendations,
  getRecommendationAlgorithmStats,
  adjustRecommendationStrategy,
} from '../../../utils/mixedRecommendation.js'

// Mock 相關模組
vi.mock('../../../models/Meme.js')
vi.mock('../../../models/User.js')
vi.mock('../../../utils/hotScore.js')
vi.mock('../../../utils/contentBased.js')
vi.mock('../../../utils/collaborativeFiltering.js')

import Meme from '../../../models/Meme.js'
import User from '../../../models/User.js'
import { getHotScoreLevel } from '../../../utils/hotScore.js'
import {
  getContentBasedRecommendations as getContentBasedRecs,
  calculateUserTagPreferences,
} from '../../../utils/contentBased.js'
import {
  getCollaborativeFilteringRecommendations as getCollaborativeFilteringRecs,
  getSocialCollaborativeFilteringRecommendations as getSocialCollaborativeFilteringRecs,
} from '../../../utils/collaborativeFiltering.js'

describe('混合推薦系統測試', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMixedRecommendations', () => {
    it('應該返回混合推薦結果', async () => {
      // Mock 數據
      const mockMemes = [
        {
          _id: 'meme1',
          title: '測試迷因1',
          hot_score: 100,
          createdAt: new Date(),
          toObject: () => ({
            _id: 'meme1',
            title: '測試迷因1',
            hot_score: 100,
            createdAt: new Date(),
          }),
        },
        {
          _id: 'meme2',
          title: '測試迷因2',
          hot_score: 200,
          createdAt: new Date(),
          toObject: () => ({
            _id: 'meme2',
            title: '測試迷因2',
            hot_score: 200,
            createdAt: new Date(),
          }),
        },
      ]

      const mockContentBasedRecs = [
        {
          _id: 'meme3',
          title: '內容基礎推薦',
          recommendation_score: 0.8,
          recommendation_type: 'content_based',
        },
      ]

      // 鏈式查詢 mock：find().sort().limit().populate().lean()
      const chain = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockMemes),
      }
      Meme.find.mockReturnValue(chain)

      getContentBasedRecs.mockResolvedValue(mockContentBasedRecs)
      getCollaborativeFilteringRecs.mockResolvedValue([])
      getSocialCollaborativeFilteringRecs.mockResolvedValue([])
      getHotScoreLevel.mockReturnValue('popular')

      // Mock 活躍度計算相關
      const mockCountDocuments = vi.fn().mockResolvedValue(10)
      const mockLike = await import('../../../models/Like.js')
      const mockComment = await import('../../../models/Comment.js')
      const mockShare = await import('../../../models/Share.js')
      const mockCollection = await import('../../../models/Collection.js')
      const mockView = await import('../../../models/View.js')

      Object.assign(mockLike.default, { countDocuments: mockCountDocuments })
      Object.assign(mockComment.default, { countDocuments: mockCountDocuments })
      Object.assign(mockShare.default, { countDocuments: mockCountDocuments })
      Object.assign(mockCollection.default, { countDocuments: mockCountDocuments })
      Object.assign(mockView.default, { countDocuments: mockCountDocuments })

      // 執行測試
      const result = await getMixedRecommendations('user123', {
        limit: 10,
        includeDiversity: true,
        includeColdStartAnalysis: true,
      })

      // 驗證結果
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('weights')
      expect(result).toHaveProperty('algorithm')
      expect(result.algorithm).toBe('mixed')
      expect(result.userAuthenticated).toBe(true)
    })

    it('應該處理冷啟動用戶', async () => {
      // Mock 冷啟動狀態
      calculateUserTagPreferences.mockResolvedValue({
        preferences: {},
      })

      const mockMemes = [
        {
          _id: 'meme1',
          title: '熱門迷因',
          hot_score: 500,
          createdAt: new Date(),
          toObject: () => ({
            _id: 'meme1',
            title: '熱門迷因',
            hot_score: 500,
            createdAt: new Date(),
          }),
        },
      ]

      const chain2 = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockMemes),
      }
      Meme.find.mockReturnValue(chain2)

      getContentBasedRecs.mockResolvedValue([])
      getCollaborativeFilteringRecs.mockResolvedValue([])
      getSocialCollaborativeFilteringRecs.mockResolvedValue([])
      getHotScoreLevel.mockReturnValue('trending')

      const result = await getMixedRecommendations('newuser', {
        limit: 5,
        includeColdStartAnalysis: true,
      })

      expect(result.coldStartStatus.isColdStart).toBe(true)
      expect(result.weights.hot).toBeGreaterThan(0.5)
    })

    it('應該計算多樣性統計', async () => {
      const mockMemes = [
        {
          _id: 'meme1',
          title: '迷因1',
          tags_cache: ['funny', 'meme'],
          author_id: { _id: 'author1', username: 'user1' },
          hot_score: 100,
          createdAt: new Date(),
          toObject: () => ({
            _id: 'meme1',
            title: '迷因1',
            tags_cache: ['funny', 'meme'],
            author_id: { _id: 'author1', username: 'user1' },
            hot_score: 100,
            createdAt: new Date(),
          }),
        },
        {
          _id: 'meme2',
          title: '迷因2',
          tags_cache: ['viral', 'trending'],
          author_id: { _id: 'author2', username: 'user2' },
          hot_score: 200,
          createdAt: new Date(),
          toObject: () => ({
            _id: 'meme2',
            title: '迷因2',
            tags_cache: ['viral', 'trending'],
            author_id: { _id: 'author2', username: 'user2' },
            hot_score: 200,
            createdAt: new Date(),
          }),
        },
      ]

      const chain3 = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockMemes),
      }
      Meme.find.mockReturnValue(chain3)

      getContentBasedRecs.mockResolvedValue([])
      getCollaborativeFilteringRecs.mockResolvedValue([])
      getSocialCollaborativeFilteringRecs.mockResolvedValue([])
      getHotScoreLevel.mockReturnValue('popular')

      const result = await getMixedRecommendations('user123', {
        limit: 10,
        includeDiversity: true,
      })

      expect(result.diversity).toBeDefined()
      expect(result.diversity).toHaveProperty('tagDiversity')
      expect(result.diversity).toHaveProperty('authorDiversity')
      expect(result.diversity.uniqueTags).toBe(4)
      expect(result.diversity.uniqueAuthors).toBe(2)
    })
  })

  describe('getRecommendationAlgorithmStats', () => {
    it('應該返回演算法統計', async () => {
      // Mock 統計數據
      Meme.countDocuments.mockResolvedValue(1500)
      User.findById.mockResolvedValue({
        _id: 'user123',
        username: 'testuser',
      })

      calculateUserTagPreferences.mockResolvedValue({
        preferences: { funny: 0.8, meme: 0.6 },
      })

      const result = await getRecommendationAlgorithmStats('user123')

      expect(result).toHaveProperty('totalMemes')
      expect(result).toHaveProperty('hotMemes')
      expect(result).toHaveProperty('trendingMemes')
      expect(result).toHaveProperty('viralMemes')
      expect(result).toHaveProperty('userActivity')
      expect(result).toHaveProperty('coldStart')
      expect(result).toHaveProperty('userPreferences')
    })

    it('應該處理未登入用戶', async () => {
      Meme.countDocuments.mockResolvedValue(1000)

      const result = await getRecommendationAlgorithmStats(null)

      expect(result).toHaveProperty('totalMemes')
      expect(result).not.toHaveProperty('userActivity')
      expect(result).not.toHaveProperty('coldStart')
    })
  })

  describe('adjustRecommendationStrategy', () => {
    it('應該根據用戶行為調整策略', async () => {
      // Mock 用戶活躍度
      User.findById.mockResolvedValue({
        _id: 'user123',
        username: 'activeuser',
      })

      calculateUserTagPreferences.mockResolvedValue({
        preferences: { funny: 0.9, viral: 0.7 },
      })

      const userBehavior = {
        clickRate: 0.4,
        engagementRate: 0.7,
        diversityPreference: 0.8,
      }

      const result = await adjustRecommendationStrategy('user123', userBehavior)

      expect(result).toHaveProperty('weights')
      expect(result).toHaveProperty('focus')
      expect(result).toHaveProperty('coldStartHandling')
      expect(result.focus).toBe('personalization')
    })

    it('應該處理高互動率用戶', async () => {
      User.findById.mockResolvedValue({
        _id: 'user123',
        username: 'socialuser',
      })

      calculateUserTagPreferences.mockResolvedValue({
        preferences: { social: 0.8, trending: 0.6 },
      })

      const userBehavior = {
        clickRate: 0.2,
        engagementRate: 0.8,
        diversityPreference: 0.3,
      }

      const result = await adjustRecommendationStrategy('user123', userBehavior)

      expect(result.focus).toBe('social')
      expect(result.weights.social_collaborative_filtering).toBeGreaterThan(0.2)
    })

    it('應該處理高多樣性偏好用戶', async () => {
      User.findById.mockResolvedValue({
        _id: 'user123',
        username: 'explorer',
      })

      calculateUserTagPreferences.mockResolvedValue({
        preferences: { diverse: 0.9, new: 0.8 },
      })

      const userBehavior = {
        clickRate: 0.3,
        engagementRate: 0.4,
        diversityPreference: 0.9,
      }

      const result = await adjustRecommendationStrategy('user123', userBehavior)

      expect(result.focus).toBe('exploration')
      expect(result.weights.latest).toBeGreaterThan(0.2)
    })
  })

  describe('冷啟動處理', () => {
    it('應該識別冷啟動用戶', async () => {
      // Mock 低互動用戶
      User.findById.mockResolvedValue({
        _id: 'newuser',
        username: 'newuser',
      })

      calculateUserTagPreferences.mockResolvedValue({
        preferences: {},
      })

      // 鏈式查詢 mock：find().sort().limit().populate().lean()
      const chain = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            _id: 'coldstart1',
            title: '冷啟動迷因',
            hot_score: 300,
            createdAt: new Date(),
            author_id: { _id: 'author1' },
          },
        ]),
      }
      Meme.find.mockReturnValue(chain)

      // Mock 活躍度計算相關
      const mockCountDocuments = vi.fn().mockResolvedValue(2) // 低活躍度
      const mockLike = await import('../../../models/Like.js')
      const mockComment = await import('../../../models/Comment.js')
      const mockShare = await import('../../../models/Share.js')
      const mockCollection = await import('../../../models/Collection.js')
      const mockView = await import('../../../models/View.js')

      Object.assign(mockLike.default, { countDocuments: mockCountDocuments })
      Object.assign(mockComment.default, { countDocuments: mockCountDocuments })
      Object.assign(mockShare.default, { countDocuments: mockCountDocuments })
      Object.assign(mockCollection.default, { countDocuments: mockCountDocuments })
      Object.assign(mockView.default, { countDocuments: mockCountDocuments })

      const result = await getMixedRecommendations('newuser', {
        limit: 10,
        includeColdStartAnalysis: true,
      })

      expect(result.coldStartStatus.isColdStart).toBe(true)
      expect(result.weights.hot).toBeGreaterThan(0.6)
      expect(result.weights.content_based).toBe(0)
    })

    it('應該處理活躍用戶', async () => {
      // Mock 高互動用戶
      User.findById.mockResolvedValue({
        _id: 'activeuser',
        username: 'activeuser',
      })

      calculateUserTagPreferences.mockResolvedValue({
        preferences: { funny: 0.8, meme: 0.7, viral: 0.6 },
      })

      // 鏈式查詢 mock：find().sort().limit().populate().lean()
      const chain2 = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            _id: 'active1',
            title: '活躍用戶迷因',
            hot_score: 150,
            createdAt: new Date(),
            author_id: { _id: 'author2' },
          },
        ]),
      }
      Meme.find.mockReturnValue(chain2)

      // Mock 活躍度計算相關
      const mockCountDocuments2 = vi.fn().mockResolvedValue(15) // 高活躍度
      const mockLike2 = await import('../../../models/Like.js')
      const mockComment2 = await import('../../../models/Comment.js')
      const mockShare2 = await import('../../../models/Share.js')
      const mockCollection2 = await import('../../../models/Collection.js')
      const mockView2 = await import('../../../models/View.js')

      Object.assign(mockLike2.default, { countDocuments: mockCountDocuments2 })
      Object.assign(mockComment2.default, { countDocuments: mockCountDocuments2 })
      Object.assign(mockShare2.default, { countDocuments: mockCountDocuments2 })
      Object.assign(mockCollection2.default, { countDocuments: mockCountDocuments2 })
      Object.assign(mockView2.default, { countDocuments: mockCountDocuments2 })

      const result = await getMixedRecommendations('activeuser', {
        limit: 10,
        includeColdStartAnalysis: true,
      })

      expect(result.coldStartStatus.isColdStart).toBe(false)
      expect(result.weights.content_based).toBeGreaterThan(0.15)
    })
  })

  describe('多樣性計算', () => {
    it('應該計算標籤多樣性', async () => {
      const mockMemes = [
        {
          _id: 'meme1',
          tags_cache: ['funny', 'meme'],
          author_id: { _id: 'author1' },
          toObject: () => ({
            _id: 'meme1',
            tags_cache: ['funny', 'meme'],
            author_id: { _id: 'author1' },
          }),
        },
        {
          _id: 'meme2',
          tags_cache: ['viral', 'trending'],
          author_id: { _id: 'author2' },
          toObject: () => ({
            _id: 'meme2',
            tags_cache: ['viral', 'trending'],
            author_id: { _id: 'author2' },
          }),
        },
      ]

      const chain4 = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockMemes),
      }
      Meme.find.mockReturnValue(chain4)

      getContentBasedRecs.mockResolvedValue([])
      getCollaborativeFilteringRecs.mockResolvedValue([])
      getSocialCollaborativeFilteringRecs.mockResolvedValue([])

      const result = await getMixedRecommendations('user123', {
        limit: 10,
        includeDiversity: true,
      })

      expect(result.diversity.tagDiversity).toBe(1) // 4個唯一標籤 / 4個總標籤
      expect(result.diversity.authorDiversity).toBe(1) // 2個唯一作者 / 2個總作者
    })
  })
})
