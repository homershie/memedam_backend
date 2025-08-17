import { vi, describe, test, expect, beforeEach } from 'vitest'
import {
  calculateSocialDistance,
  calculateSocialInfluenceScore,
  calculateMultipleMemeSocialScores,
  getUserSocialInfluenceStats,
  generateSocialRecommendationReasons,
  SOCIAL_SCORE_CONFIG,
} from '../../../utils/socialScoreCalculator.js'

// Mock Mongoose models
vi.mock('../../../models/Follow.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../../models/Like.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../../models/Comment.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../../models/Share.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../../models/Collection.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../../models/View.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../../models/User.js', () => ({ default: { find: vi.fn(), findById: vi.fn() } }))
vi.mock('../../../models/Meme.js', () => ({ default: { findById: vi.fn(), find: vi.fn() } }))

describe('社交層分數計算系統', () => {
  const U1 = '000000000000000000000001'
  const U2 = '000000000000000000000002'
  const U3 = '000000000000000000000003'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SOCIAL_SCORE_CONFIG', () => {
    test('應該有正確的配置結構', () => {
      expect(SOCIAL_SCORE_CONFIG).toHaveProperty('interactions')
      expect(SOCIAL_SCORE_CONFIG).toHaveProperty('distanceWeights')
      expect(SOCIAL_SCORE_CONFIG).toHaveProperty('influenceConfig')
      expect(SOCIAL_SCORE_CONFIG).toHaveProperty('scoreLimits')
      expect(SOCIAL_SCORE_CONFIG).toHaveProperty('reasonConfig')
    })

    test('互動分數配置應該正確', () => {
      expect(SOCIAL_SCORE_CONFIG.interactions.publish).toBeGreaterThan(0)
      expect(SOCIAL_SCORE_CONFIG.interactions.like).toBeGreaterThan(0)
      expect(SOCIAL_SCORE_CONFIG.interactions.comment).toBeGreaterThan(0)
      expect(SOCIAL_SCORE_CONFIG.interactions.share).toBeGreaterThan(0)
      expect(SOCIAL_SCORE_CONFIG.interactions.collect).toBeGreaterThan(0)
      expect(SOCIAL_SCORE_CONFIG.interactions.view).toBeGreaterThan(0)
    })
  })

  describe('calculateSocialDistance', () => {
    test('應該正確計算直接關注距離', async () => {
      const socialGraph = {
        [U1]: {
          following: [U2],
          followers: [],
          mutualFollows: [],
        },
        [U2]: {
          following: [],
          followers: [U1],
          mutualFollows: [],
        },
      }

      const result = await calculateSocialDistance(U1, U2, socialGraph)
      expect(result.distance).toBe(1)
      expect(result.type).toBe('direct_follow')
      expect(result.weight).toBe(SOCIAL_SCORE_CONFIG.distanceWeights.directFollow)
    })

    test('應該正確計算互相關注距離', async () => {
      const socialGraph = {
        [U1]: {
          following: [U2],
          followers: [U2],
          mutualFollows: [U2],
        },
        [U2]: {
          following: [U1],
          followers: [U1],
          mutualFollows: [U1],
        },
      }

      const result = await calculateSocialDistance(U1, U2, socialGraph)
      expect(result.distance).toBe(1)
      expect(result.type).toBe('mutual_follow')
      expect(result.weight).toBe(SOCIAL_SCORE_CONFIG.distanceWeights.mutualFollow)
    })

    test('應該正確計算二度關係距離', async () => {
      const socialGraph = {
        [U1]: {
          following: [U2],
          followers: [],
          mutualFollows: [],
        },
        [U2]: {
          following: [U3],
          followers: [U1],
          mutualFollows: [],
        },
        [U3]: {
          following: [],
          followers: [U2],
          mutualFollows: [],
        },
      }

      const result = await calculateSocialDistance(U1, U3, socialGraph)
      expect(result.distance).toBe(2)
      expect(result.type).toBe('second_degree')
      expect(result.weight).toBe(SOCIAL_SCORE_CONFIG.distanceWeights.secondDegree)
    })

    test('應該處理未知距離', async () => {
      const socialGraph = {
        [U1]: { following: [], followers: [], mutualFollows: [] },
        [U2]: { following: [], followers: [], mutualFollows: [] },
      }

      const result = await calculateSocialDistance(U1, U2, socialGraph)
      expect(result.distance).toBe(Infinity)
      expect(result.type).toBe('unknown')
      expect(result.weight).toBe(0)
    })
  })

  describe('calculateSocialInfluenceScore', () => {
    test('應該正確計算影響力分數', () => {
      const userSocialData = {
        followers: [U2, U3],
        following: [U3],
        mutualFollows: [U2],
      }

      const result = calculateSocialInfluenceScore(userSocialData)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.level).toBeDefined()
      expect(result.followers).toBe(2)
      expect(result.following).toBe(1)
      expect(result.mutualFollows).toBe(1)
    })

    test('應該處理空數據', () => {
      const result = calculateSocialInfluenceScore(null)
      expect(result.score).toBe(0)
      expect(result.level).toBe('none')
      expect(result.followers).toBe(0)
      expect(result.following).toBe(0)
      expect(result.mutualFollows).toBe(0)
    })
  })

  describe('generateSocialRecommendationReasons', () => {
    test('應該生成推薦原因', () => {
      const socialInteractions = [
        { action: 'like', weight: 10, displayName: '用戶A', username: 'userA', distance: 1, distanceType: 'direct_follow', influenceScore: 25, influenceLevel: 'active' },
        { action: 'share', weight: 15, displayName: '用戶B', username: 'userB', distance: 2, distanceType: 'second_degree', influenceScore: 30, influenceLevel: 'popular' },
      ]

      const reasons = generateSocialRecommendationReasons(socialInteractions, { maxReasons: 2, minWeight: 5 })

      expect(reasons).toHaveLength(2)
      expect(reasons[0].weight).toBeGreaterThanOrEqual(reasons[1].weight)
    })
  })

  describe('getUserSocialInfluenceStats', () => {
    test('應該返回用戶社交影響力統計', async () => {
      const { default: Follow } = await import('../../../models/Follow.js')
      // 模擬追隨關係（U2 -> U1, U1 -> U3，形成 1 follower、1 following）
      Follow.find = vi.fn().mockResolvedValue([
        { follower_id: U2, following_id: U1, createdAt: new Date() },
        { follower_id: U1, following_id: U3, createdAt: new Date() },
      ])

      const result = await getUserSocialInfluenceStats(U1)
      expect(result).toHaveProperty('influenceScore')
      expect(result).toHaveProperty('influenceLevel')
      expect(result.followers).toBeGreaterThanOrEqual(0)
      expect(result.following).toBeGreaterThanOrEqual(0)
      expect(result.mutualFollows).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateMultipleMemeSocialScores', () => {
    test('應該批量計算多個迷因的社交分數', async () => {
      const userId = U1
      const memeIds = ['0000000000000000000000a1', '0000000000000000000000a2', '0000000000000000000000a3']

      // 最小化資料依賴：讓內部查詢回傳空集合，使函數仍能返回結構
      const { default: Like } = await import('../../../models/Like.js')
      const { default: Comment } = await import('../../../models/Comment.js')
      const { default: Share } = await import('../../../models/Share.js')
      const { default: Collection } = await import('../../../models/Collection.js')
      const { default: View } = await import('../../../models/View.js')
      const { default: Meme } = await import('../../../models/Meme.js')

      Like.find = vi.fn().mockResolvedValue([])
      Comment.find = vi.fn().mockResolvedValue([])
      Share.find = vi.fn().mockResolvedValue([])
      Collection.find = vi.fn().mockResolvedValue([])
      View.find = vi.fn().mockResolvedValue([])
      Meme.findById = vi.fn().mockResolvedValue({ populate: vi.fn().mockReturnThis(), author_id: { _id: U2, username: 'u2' } })

      const results = await calculateMultipleMemeSocialScores(userId, memeIds)
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(3)
    })
  })
})