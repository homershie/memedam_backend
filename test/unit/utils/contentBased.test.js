/**
 * 內容基礎推薦系統測試
 */

import { vi, describe, it, expect } from 'vitest'

// 建立 hoisted 的 Query 模擬器，支援鏈式與 await thenable
const hoisted = vi.hoisted(() => {
  const makeQuery = (resolved) => {
    const q = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(resolved),
      then: (resolve) => resolve(resolved),
    }
    return q
  }
  return {
    makeQuery,
    MemeMock: { find: vi.fn() },
    LikeMock: { find: vi.fn(), distinct: vi.fn() },
    CollectionMock: { find: vi.fn(), distinct: vi.fn() },
    CommentMock: { find: vi.fn(), distinct: vi.fn() },
    ShareMock: { find: vi.fn(), distinct: vi.fn() },
    ViewMock: { find: vi.fn() },
  }
})

vi.mock('../../../models/Meme.js', () => ({ default: hoisted.MemeMock }))
vi.mock('../../../models/Like.js', () => ({ default: hoisted.LikeMock }))
vi.mock('../../../models/Collection.js', () => ({ default: hoisted.CollectionMock }))
vi.mock('../../../models/Comment.js', () => ({ default: hoisted.CommentMock }))
vi.mock('../../../models/Share.js', () => ({ default: hoisted.ShareMock }))
vi.mock('../../../models/View.js', () => ({ default: hoisted.ViewMock }))

describe('內容基礎推薦系統測試', () => {
  describe('calculateUserTagPreferences', () => {
    it('應該正確計算用戶標籤偏好', async () => {
      const mockLikes = [
        {
          user_id: 'user123',
          meme_id: { tags_cache: ['funny', 'meme', 'viral'] },
          createdAt: new Date(),
          toObject: () => ({ user_id: 'user123', meme_id: { tags_cache: ['funny', 'meme', 'viral'] }, createdAt: new Date(), type: 'like' }),
        },
      ]
      const mockCollections = [
        {
          user_id: 'user123',
          meme_id: { tags_cache: ['funny', 'comedy'] },
          createdAt: new Date(),
          toObject: () => ({ user_id: 'user123', meme_id: { tags_cache: ['funny', 'comedy'] }, createdAt: new Date(), type: 'collection' }),
        },
      ]

      const { default: Like } = await import('../../../models/Like.js')
      const { default: Collection } = await import('../../../models/Collection.js')
      const { default: Comment } = await import('../../../models/Comment.js')
      const { default: Share } = await import('../../../models/Share.js')
      const { default: View } = await import('../../../models/View.js')

      Like.find = vi.fn().mockReturnValue(hoisted.makeQuery(mockLikes))
      Collection.find = vi.fn().mockReturnValue(hoisted.makeQuery(mockCollections))
      Comment.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Share.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      View.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))

      const { calculateUserTagPreferences } = await import('../../../utils/contentBased.js')
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

      Like.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Collection.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Comment.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Share.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      View.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))

      const { calculateUserTagPreferences } = await import('../../../utils/contentBased.js')
      const result = await calculateUserTagPreferences('user123')

      expect(result.preferences).toEqual({})
      expect(result.confidence).toBe(0)
      expect(result.totalInteractions).toBe(0)
    })
  })

  describe('calculateTagSimilarity', () => {
    it('應該正確計算標籤相似度', async () => {
      const { calculateTagSimilarity } = await import('../../../utils/contentBased.js')
      const tags1 = ['funny', 'meme', 'viral']
      const tags2 = ['funny', 'comedy', 'humor']
      const similarity = calculateTagSimilarity(tags1, tags2)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    it('應該處理空標籤', async () => {
      const { calculateTagSimilarity } = await import('../../../utils/contentBased.js')
      expect(calculateTagSimilarity([], ['funny'])).toBe(0)
      expect(calculateTagSimilarity(['funny'], [])).toBe(0)
      expect(calculateTagSimilarity([], [])).toBe(0)
    })

    it('應該結合用戶偏好計算相似度', async () => {
      const { calculateTagSimilarity } = await import('../../../utils/contentBased.js')
      const tags1 = ['funny', 'meme']
      const tags2 = ['funny', 'comedy']
      const userPreferences = { funny: 0.8, meme: 0.6, comedy: 0.4 }
      const similarity = calculateTagSimilarity(tags1, tags2, userPreferences)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })
  })

  describe('calculatePreferenceMatch', () => {
    it('應該正確計算偏好匹配度', async () => {
      const { calculatePreferenceMatch } = await import('../../../utils/contentBased.js')
      const memeTags = ['funny', 'meme', 'viral']
      const userPreferences = { funny: 0.8, meme: 0.6, comedy: 0.4 }
      const match = calculatePreferenceMatch(memeTags, userPreferences)
      expect(match).toBeGreaterThan(0)
      expect(match).toBeLessThanOrEqual(1)
    })

    it('應該處理無匹配標籤', async () => {
      const { calculatePreferenceMatch } = await import('../../../utils/contentBased.js')
      const memeTags = ['gaming', 'tech']
      const userPreferences = { funny: 0.8, meme: 0.6 }
      const match = calculatePreferenceMatch(memeTags, userPreferences)
      expect(match).toBe(0)
    })
  })

  describe('getContentBasedRecommendations', () => {
    it('應該返回內容基礎推薦', async () => {
      const mockMemes = [
        { _id: 'meme1', title: 'Funny Meme 1', tags_cache: ['funny', 'meme', 'viral'], hot_score: 100, toObject: () => ({ _id: 'meme1', title: 'Funny Meme 1', tags_cache: ['funny', 'meme', 'viral'], hot_score: 100 }) },
        { _id: 'meme2', title: 'Comedy Meme 2', tags_cache: ['funny', 'comedy'], hot_score: 80, toObject: () => ({ _id: 'meme2', title: 'Comedy Meme 2', tags_cache: ['funny', 'comedy'], hot_score: 80 }) },
      ]

      const { default: Meme } = await import('../../../models/Meme.js')
      const { default: Like } = await import('../../../models/Like.js')
      const { default: Collection } = await import('../../../models/Collection.js')
      const { default: Comment } = await import('../../../models/Comment.js')
      const { default: Share } = await import('../../../models/Share.js')

      Meme.find = vi.fn().mockReturnValue(hoisted.makeQuery(mockMemes))
      Like.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Collection.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Comment.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))
      Share.find = vi.fn().mockReturnValue(hoisted.makeQuery([]))

      const { getContentBasedRecommendations } = await import('../../../utils/contentBased.js')
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
        { _id: 'meme1', title: 'Funny Meme 1', tags_cache: ['funny', 'meme', 'viral'], hot_score: 100, toObject: () => ({ _id: 'meme1', title: 'Funny Meme 1', tags_cache: ['funny', 'meme', 'viral'], hot_score: 100 }) },
      ]

      const { default: Meme } = await import('../../../models/Meme.js')
      Meme.find = vi.fn().mockReturnValue(hoisted.makeQuery(mockMemes))

      const { getTagBasedRecommendations } = await import('../../../utils/contentBased.js')
      const recommendations = await getTagBasedRecommendations(['funny', 'meme'], {
        limit: 10,
        minSimilarity: 0.1,
        includeHotScore: true,
        hotScoreWeight: 0.3,
      })

      expect(Array.isArray(recommendations)).toBe(true)
    })

    it('應該處理空標籤', async () => {
      const { getTagBasedRecommendations } = await import('../../../utils/contentBased.js')
      const recommendations = await getTagBasedRecommendations([], { limit: 10 })
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBe(0)
    })
  })
})

// 測試工具函數
describe('推薦系統工具函數', () => {
  it('時間衰減計算應該介於 0 與 1 之間', () => {
    const decayFactor = 0.95
    const daysSince = 7
    const timeMultiplier = Math.pow(decayFactor, daysSince)
    expect(timeMultiplier).toBeLessThan(1)
    expect(timeMultiplier).toBeGreaterThan(0)
  })

  it('分數標準化應該正確', () => {
    const scores = [10, 20, 30, 40, 50]
    const maxScore = Math.max(...scores)
    const normalizedScores = scores.map((score) => score / maxScore)
    expect(normalizedScores).toEqual([0.2, 0.4, 0.6, 0.8, 1.0])
  })
})
