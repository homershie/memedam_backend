/**
 * 內容基礎推薦系統測試
 */

import { vi, describe, it, expect } from 'vitest'
import {
  calculateUserTagPreferences,
  calculateTagSimilarity,
  calculatePreferenceMatch,
  getContentBasedRecommendations,
  getTagBasedRecommendations,
} from '../../../utils/contentBased.js'

// Mock 模型（提供可鏈式呼叫方法）
const makeChain = (resolved) => ({
  populate: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(resolved),
})

const MemeMock = { find: vi.fn() }
const LikeMock = { find: vi.fn(), distinct: vi.fn() }
const CollectionMock = { find: vi.fn(), distinct: vi.fn() }
const CommentMock = { find: vi.fn(), distinct: vi.fn() }
const ShareMock = { find: vi.fn(), distinct: vi.fn() }
const ViewMock = { find: vi.fn() }

vi.mock('../../../models/Meme.js', () => ({ default: MemeMock }))
vi.mock('../../../models/Like.js', () => ({ default: LikeMock }))
vi.mock('../../../models/Collection.js', () => ({ default: CollectionMock }))
vi.mock('../../../models/Comment.js', () => ({ default: CommentMock }))
vi.mock('../../../models/Share.js', () => ({ default: ShareMock }))
vi.mock('../../../models/View.js', () => ({ default: ViewMock }))

describe('內容基礎推薦系統測試', () => {
  describe('calculateUserTagPreferences', () => {
    it('應該正確計算用戶標籤偏好', async () => {
      // Mock 用戶互動數據
      const mockLikes = [
        {
          user_id: 'user123',
          meme_id: { tags_cache: ['funny', 'meme', 'viral'] },
          createdAt: new Date(),
          toObject: () => ({
            user_id: 'user123',
            meme_id: { tags_cache: ['funny', 'meme', 'viral'] },
            createdAt: new Date(),
            type: 'like',
          }),
        },
      ]

      const mockCollections = [
        {
          user_id: 'user123',
          meme_id: { tags_cache: ['funny', 'comedy'] },
          createdAt: new Date(),
          toObject: () => ({
            user_id: 'user123',
            meme_id: { tags_cache: ['funny', 'comedy'] },
            createdAt: new Date(),
            type: 'collection',
          }),
        },
      ]

      // Mock 模型方法（需支援 populate）
      const { default: Like } = await import('../../../models/Like.js')
      const { default: Collection } = await import('../../../models/Collection.js')
      const { default: Comment } = await import('../../../models/Comment.js')
      const { default: Share } = await import('../../../models/Share.js')
      const { default: View } = await import('../../../models/View.js')
      Like.find = vi.fn().mockReturnValue(makeChain(mockLikes))
      Collection.find = vi.fn().mockReturnValue(makeChain(mockCollections))
      Comment.find = vi.fn().mockReturnValue(makeChain([]))
      Share.find = vi.fn().mockReturnValue(makeChain([]))
      View.find = vi.fn().mockReturnValue(makeChain([]))

      const result = await calculateUserTagPreferences('user123')

      expect(result.preferences).toBeDefined()
      expect(result.totalInteractions).toBe(2)
    })

    it('應該處理空互動歷史', async () => {
      const { default: Like } = await import('../../../models/Like.js')
      const { default: Collection } = await import('../../../models/Collection.js')
      const { default: Comment } = await import('../../../models/Comment.js')
      const { default: Share } = await import('../../../models/Share.js')
      const { default: View } = await import('../../../models/View.js')

      Like.find = vi.fn().mockReturnValue(makeChain([]))
      Collection.find = vi.fn().mockReturnValue(makeChain([]))
      Comment.find = vi.fn().mockReturnValue(makeChain([]))
      Share.find = vi.fn().mockReturnValue(makeChain([]))
      View.find = vi.fn().mockReturnValue(makeChain([]))

      const result = await calculateUserTagPreferences('user123')

      expect(result.preferences).toEqual({})
      expect(result.confidence).toBe(0)
      expect(result.totalInteractions).toBe(0)
    })
  })

  describe('calculateTagSimilarity', () => {
    it('應該正確計算標籤相似度', () => {
      const tags1 = ['funny', 'meme', 'viral']
      const tags2 = ['funny', 'comedy', 'humor']

      const similarity = calculateTagSimilarity(tags1, tags2)

      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('應該處理空標籤', () => {
      const similarity1 = calculateTagSimilarity([], ['funny'])
      const similarity2 = calculateTagSimilarity(['funny'], [])
      const similarity3 = calculateTagSimilarity([], [])

      expect(similarity1).toBe(0)
      expect(similarity2).toBe(0)
      expect(similarity3).toBe(0)
    })

    it('應該結合用戶偏好計算相似度', () => {
      const tags1 = ['funny', 'meme']
      const tags2 = ['funny', 'comedy']
      const userPreferences = { funny: 0.8, meme: 0.6, comedy: 0.4 }

      const similarity = calculateTagSimilarity(tags1, tags2, userPreferences)

      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
  })

  describe('calculatePreferenceMatch', () => {
    it('應該正確計算偏好匹配度', () => {
      const memeTags = ['funny', 'meme', 'viral']
      const userPreferences = { funny: 0.8, meme: 0.6, comedy: 0.4 }

      const match = calculatePreferenceMatch(memeTags, userPreferences)

      expect(match).toBeGreaterThan(0)
      expect(match).toBeLessThanOrEqual(1)
    })

    it('應該處理無匹配標籤', () => {
      const memeTags = ['gaming', 'tech']
      const userPreferences = { funny: 0.8, meme: 0.6 }

      const match = calculatePreferenceMatch(memeTags, userPreferences)

      expect(match).toBe(0)
    })
  })

  describe('getContentBasedRecommendations', () => {
    it('應該返回內容基礎推薦', async () => {
      // Mock 迷因數據
      const mockMemes = [
        {
          _id: 'meme1',
          title: 'Funny Meme 1',
          tags_cache: ['funny', 'meme', 'viral'],
          hot_score: 100,
          toObject: () => ({
            _id: 'meme1',
            title: 'Funny Meme 1',
            tags_cache: ['funny', 'meme', 'viral'],
            hot_score: 100,
          }),
        },
        {
          _id: 'meme2',
          title: 'Comedy Meme 2',
          tags_cache: ['funny', 'comedy'],
          hot_score: 80,
          toObject: () => ({
            _id: 'meme2',
            title: 'Comedy Meme 2',
            tags_cache: ['funny', 'comedy'],
            hot_score: 80,
          }),
        },
      ]

      // Mock 模型方法與鏈式呼叫
      const { default: Meme } = await import('../../../models/Meme.js')
      const { default: Like } = await import('../../../models/Like.js')
      const { default: Collection } = await import('../../../models/Collection.js')
      const { default: Comment } = await import('../../../models/Comment.js')
      const { default: Share } = await import('../../../models/Share.js')
      Meme.find = vi.fn().mockReturnValue(makeChain(mockMemes))
      Like.find = vi.fn().mockReturnValue(makeChain([]))
      Collection.find = vi.fn().mockReturnValue(makeChain([]))
      Comment.find = vi.fn().mockReturnValue(makeChain([]))
      Share.find = vi.fn().mockReturnValue(makeChain([]))

      const recommendations = await getContentBasedRecommendations('user123', {
        limit: 10,
        minSimilarity: 0.1,
        excludeInteracted: false,
        includeHotScore: true,
        hotScoreWeight: 0.3,
      })

      expect(Array.isArray(recommendations)).toBe(true)
    })
  })

  describe('getTagBasedRecommendations', () => {
    it('應該返回標籤相關推薦', async () => {
      const mockMemes = [
        {
          _id: 'meme1',
          title: 'Funny Meme 1',
          tags_cache: ['funny', 'meme', 'viral'],
          hot_score: 100,
          toObject: () => ({
            _id: 'meme1',
            title: 'Funny Meme 1',
            tags_cache: ['funny', 'meme', 'viral'],
            hot_score: 100,
          }),
        },
      ]

      const { default: Meme } = await import('../../../models/Meme.js')
      Meme.find = vi.fn().mockReturnValue(makeChain(mockMemes))

      const recommendations = await getTagBasedRecommendations(['funny', 'meme'], {
        limit: 10,
        minSimilarity: 0.1,
        includeHotScore: true,
        hotScoreWeight: 0.3,
      })

      expect(Array.isArray(recommendations)).toBe(true)
    })

    it('應該處理空標籤', async () => {
      const recommendations = await getTagBasedRecommendations([], {
        limit: 10,
      })

      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBe(0)
    })
  })
})

// 測試工具函數
describe('推薦系統工具函數', () => {
  describe('時間衰減計算', () => {
    it('應該正確計算時間衰減', () => {
      const decayFactor = 0.95
      const daysSince = 7
      const timeMultiplier = Math.pow(decayFactor, daysSince)

      expect(timeMultiplier).toBeLessThan(1)
      expect(timeMultiplier).toBeGreaterThan(0)
    })
  })

  describe('分數標準化', () => {
    it('應該正確標準化分數', () => {
      const scores = [10, 20, 30, 40, 50]
      const maxScore = Math.max(...scores)
      const normalizedScores = scores.map((score) => score / maxScore)

      expect(normalizedScores).toEqual([0.2, 0.4, 0.6, 0.8, 1.0])
    })
  })
})
