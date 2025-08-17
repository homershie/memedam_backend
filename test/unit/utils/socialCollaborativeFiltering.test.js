import { vi, describe, test, expect, beforeEach } from 'vitest'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Follow from '../../../models/Follow.js'
import Like from '../../../models/Like.js'
import Collection from '../../../models/Collection.js'
import Comment from '../../../models/Comment.js'
import Share from '../../../models/Share.js'
import View from '../../../models/View.js'
import * as CF from '../../../utils/collaborativeFiltering.js'

// 允許字串 ID 在測試中被接受
vi.spyOn(CF, 'getCollaborativeFilteringRecommendations')
vi.mock('../../../utils/collaborativeFiltering.js', async (orig) => {
  const actual = await orig()
  const safeToObjectIdPatched = (id) => ({ toString: () => String(id) })
  // 暴露 calculateSocialInfluenceScore? 原模塊是內部函式，不覆蓋
  return {
    ...actual,
    // 覆寫內部使用的 safeToObjectId 綁定：用代理包裝公開方法，將其內部轉換改為寬鬆
    buildInteractionMatrix: actual.buildInteractionMatrix,
    buildSocialGraph: actual.buildSocialGraph,
    calculateUserSimilarity: actual.calculateUserSimilarity,
    calculateSocialSimilarity: actual.calculateSocialSimilarity,
    findSimilarUsers: actual.findSimilarUsers,
    findSocialSimilarUsers: actual.findSocialSimilarUsers,
    calculateSocialWeightedSimilarity: actual.calculateSocialWeightedSimilarity,
    getCollaborativeFilteringRecommendations: async (...args) => {
      return actual.getCollaborativeFilteringRecommendations(String(args[0]), args[1])
    },
    getSocialCollaborativeFilteringRecommendations: async (...args) => {
      return actual.getSocialCollaborativeFilteringRecommendations(String(args[0]), args[1])
    },
    getCollaborativeFilteringStats: async (...args) => {
      return actual.getCollaborativeFilteringStats(String(args[0]))
    },
    getSocialCollaborativeFilteringStats: async (...args) => {
      return actual.getSocialCollaborativeFilteringStats(String(args[0]))
    },
    updateCollaborativeFilteringCache: actual.updateCollaborativeFilteringCache,
    updateSocialCollaborativeFilteringCache: actual.updateSocialCollaborativeFilteringCache,
  }
})

import {
  buildSocialGraph,
  calculateSocialSimilarity,
  findSocialSimilarUsers,
  calculateSocialWeightedSimilarity,
  getSocialCollaborativeFilteringRecommendations,
  getSocialCollaborativeFilteringStats,
  updateSocialCollaborativeFilteringCache,
} from '../../../utils/collaborativeFiltering.js'

// Mock 模型
vi.mock('../../../models/User.js', () => ({
  default: { find: vi.fn(), findById: vi.fn() },
}))

vi.mock('../../../models/Meme.js', () => ({
  default: { find: vi.fn() },
}))

vi.mock('../../../models/Follow.js', () => ({
  default: { find: vi.fn() },
}))

vi.mock('../../../models/Like.js', () => ({
  default: { find: vi.fn() },
}))

vi.mock('../../../models/Collection.js', () => ({
  default: { find: vi.fn() },
}))

vi.mock('../../../models/Comment.js', () => ({
  default: { find: vi.fn() },
}))

vi.mock('../../../models/Share.js', () => ({
  default: { find: vi.fn() },
}))

vi.mock('../../../models/View.js', () => ({
  default: { find: vi.fn() },
}))

describe.skip('社交協同過濾推薦系統測試', () => {
  let mockUser, mockMeme, mockFollow, mockLike, mockCollection, mockComment, mockShare, mockView

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()

    // 設置 mock 數據
    mockUser = {
      find: vi.fn().mockResolvedValue([{ _id: 'user1' }, { _id: 'user2' }, { _id: 'user3' }]),
    }

    mockMeme = {
      find: vi.fn().mockResolvedValue([
        { _id: 'meme1', hot_score: 100 },
        { _id: 'meme2', hot_score: 200 },
      ]),
    }

    mockFollow = {
      find: vi.fn().mockResolvedValue([
        {
          follower_id: 'user1',
          following_id: 'user2',
          createdAt: new Date('2024-01-01'),
        },
        {
          follower_id: 'user2',
          following_id: 'user1',
          createdAt: new Date('2024-01-02'),
        },
        {
          follower_id: 'user1',
          following_id: 'user3',
          createdAt: new Date('2024-01-03'),
        },
      ]),
    }

    mockLike = {
      find: vi.fn().mockResolvedValue([
        {
          user_id: 'user1',
          meme_id: 'meme1',
          createdAt: new Date('2024-01-01'),
        },
        {
          user_id: 'user2',
          meme_id: 'meme1',
          createdAt: new Date('2024-01-02'),
        },
      ]),
    }

    mockCollection = {
      find: vi.fn().mockResolvedValue([
        {
          user_id: 'user1',
          meme_id: 'meme2',
          createdAt: new Date('2024-01-01'),
        },
      ]),
    }

    mockComment = {
      find: vi.fn().mockResolvedValue([]),
    }

    mockShare = {
      find: vi.fn().mockResolvedValue([]),
    }

    mockView = {
      find: vi.fn().mockResolvedValue([]),
    }

    // 指派到被 mock 的預設匯出物件
    User.find = mockUser.find
    Meme.find = mockMeme.find
    Follow.find = mockFollow.find
    Like.find = mockLike.find
    Collection.find = mockCollection.find
    Comment.find = mockComment.find
    Share.find = mockShare.find
    View.find = mockView.find
  })

  describe('社交關係圖譜建立', () => {
    test('應該成功建立社交關係圖譜', async () => {
      const socialGraph = await buildSocialGraph(['user1', 'user2', 'user3'])

      expect(socialGraph).toBeDefined()
      expect(Object.keys(socialGraph)).toHaveLength(3)
      expect(socialGraph.user1).toBeDefined()
      expect(socialGraph.user2).toBeDefined()
      expect(socialGraph.user3).toBeDefined()
    })

    test('應該正確計算社交影響力分數', async () => {
      const socialGraph = await buildSocialGraph(['user1', 'user2', 'user3'])

      // user1 有 1 個追隨者，1 個追隨中，1 個互追
      expect(socialGraph.user1.influence_score).toBeGreaterThan(0)
      expect(socialGraph.user1.followers).toHaveLength(1)
      expect(socialGraph.user1.following).toHaveLength(1)
      expect(socialGraph.user1.mutual).toHaveLength(1)
    })
  })

  describe('社交影響力計算', () => {
    test('應該正確計算影響力分數', () => {
      const userData = {
        followers: [{ user_id: 'follower1' }, { user_id: 'follower2' }],
        following: [{ user_id: 'following1' }],
        mutual: ['follower1'],
      }

      const influenceScore = CF.calculateSocialInfluenceScore(userData)

      expect(influenceScore).toBeGreaterThan(0)
      expect(typeof influenceScore).toBe('number')
    })

    test('應該處理空數據的情況', () => {
      const userData = {
        followers: [],
        following: [],
        mutual: [],
      }

      const influenceScore = CF.calculateSocialInfluenceScore(userData)

      expect(influenceScore).toBe(0)
    })
  })

  describe('社交相似度計算', () => {
    test('應該正確計算社交相似度', () => {
      const socialGraph = {
        user1: {
          followers: [{ user_id: 'user2' }, { user_id: 'user3' }],
          following: [{ user_id: 'user2' }],
          mutual: ['user2'],
        },
        user2: {
          followers: [{ user_id: 'user1' }],
          following: [{ user_id: 'user1' }, { user_id: 'user3' }],
          mutual: ['user1'],
        },
      }

      const similarity = CF.calculateSocialSimilarity('user1', 'user2', socialGraph)

      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    test('應該處理無社交關係的情況', () => {
      const socialGraph = {
        user1: {
          followers: [],
          following: [],
          mutual: [],
        },
        user2: {
          followers: [],
          following: [],
          mutual: [],
        },
      }

      const similarity = CF.calculateSocialSimilarity('user1', 'user2', socialGraph)

      expect(similarity).toBe(0)
    })
  })

  describe('社交相似用戶發現', () => {
    test('應該找到社交相似用戶', () => {
      const socialGraph = {
        user1: {
          followers: [{ user_id: 'user2' }],
          following: [{ user_id: 'user2' }],
          mutual: ['user2'],
          influence_score: 10,
          social_connections: 2,
        },
        user2: {
          followers: [{ user_id: 'user1' }],
          following: [{ user_id: 'user1' }],
          mutual: ['user1'],
          influence_score: 15,
          social_connections: 2,
        },
        user3: {
          followers: [],
          following: [],
          mutual: [],
          influence_score: 5,
          social_connections: 0,
        },
      }

      const similarUsers = CF.findSocialSimilarUsers('user1', socialGraph, 0.1, 10)

      expect(similarUsers).toBeDefined()
      expect(Array.isArray(similarUsers)).toBe(true)
      expect(similarUsers.length).toBeGreaterThan(0)
    })

    test('應該按相似度和影響力排序', () => {
      const socialGraph = {
        user1: {
          followers: [{ user_id: 'user2' }],
          following: [{ user_id: 'user2' }],
          mutual: ['user2'],
          influence_score: 10,
          social_connections: 2,
        },
        user2: {
          followers: [{ user_id: 'user1' }],
          following: [{ user_id: 'user1' }],
          mutual: ['user1'],
          influence_score: 15,
          social_connections: 2,
        },
        user3: {
          followers: [{ user_id: 'user1' }],
          following: [],
          mutual: [],
          influence_score: 20,
          social_connections: 1,
        },
      }

      const similarUsers = CF.findSocialSimilarUsers('user1', socialGraph, 0.1, 10)

      expect(similarUsers[0].similarity).toBeGreaterThanOrEqual(similarUsers[1].similarity)
    })
  })

  describe('社交加權相似度計算', () => {
    test('應該正確計算社交加權相似度', () => {
      const user1Interactions = { meme1: 1.0, meme2: 2.0 }
      const user2Interactions = { meme1: 1.5, meme2: 1.8 }
      const socialSimilarity = 0.8
      const user2InfluenceScore = 25.5

      const weightedSimilarity = CF.calculateSocialWeightedSimilarity(
        user1Interactions,
        user2Interactions,
        socialSimilarity,
        user2InfluenceScore,
      )

      expect(weightedSimilarity).toBeGreaterThan(0)
      expect(weightedSimilarity).toBeLessThanOrEqual(1)
    })

    test('應該處理邊界情況', () => {
      const user1Interactions = {}
      const user2Interactions = {}
      const socialSimilarity = 0
      const user2InfluenceScore = 0

      const weightedSimilarity = CF.calculateSocialWeightedSimilarity(
        user1Interactions,
        user2Interactions,
        socialSimilarity,
        user2InfluenceScore,
      )

      expect(weightedSimilarity).toBe(0)
    })
  })

  describe('社交協同過濾推薦生成', () => {
    test('應該生成社交協同過濾推薦', async () => {
      // Mock 互動矩陣和社交圖譜
      const mockInteractionMatrix = {
        user1: { meme1: 1.0, meme2: 2.0 },
        user2: { meme1: 1.5, meme3: 1.8 },
      }

      const mockSocialGraph = {
        user1: {
          followers: [{ user_id: 'user2' }],
          following: [{ user_id: 'user2' }],
          mutual: ['user2'],
          influence_score: 10,
          social_connections: 2,
        },
        user2: {
          followers: [{ user_id: 'user1' }],
          following: [{ user_id: 'user1' }],
          mutual: ['user1'],
          influence_score: 15,
          social_connections: 2,
        },
      }

      // Mock 函數
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue(
        mockInteractionMatrix,
      )
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue(mockSocialGraph)

      const recommendations = await CF.getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 5,
      })

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
    })

    test('應該處理冷啟動情況', async () => {
      // Mock 空的互動歷史
      const mockInteractionMatrix = {}
      const mockSocialGraph = {}

      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue(
        mockInteractionMatrix,
      )
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue(mockSocialGraph)

      const recommendations = await CF.getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 5,
      })

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations[0].recommendation_type).toBe('social_collaborative_fallback')
    })
  })

  describe('社交協同過濾統計', () => {
    test('應該取得用戶社交協同過濾統計', async () => {
      const mockInteractionMatrix = {
        user1: { meme1: 1.0, meme2: 2.0 },
      }

      const mockSocialGraph = {
        user1: {
          followers: [{ user_id: 'user2' }],
          following: [{ user_id: 'user2' }],
          mutual: ['user2'],
          influence_score: 10,
          social_connections: 2,
        },
        user2: {
          followers: [{ user_id: 'user1' }],
          following: [{ user_id: 'user1' }],
          mutual: ['user1'],
          influence_score: 15,
          social_connections: 2,
        },
      }

      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue(
        mockInteractionMatrix,
      )
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue(mockSocialGraph)

      const stats = await CF.getSocialCollaborativeFilteringStats('user1')

      expect(stats).toBeDefined()
      expect(stats.user_id).toBe('user1')
      expect(stats.interaction_count).toBe(2)
      expect(stats.social_connections).toBe(2)
      expect(stats.followers_count).toBe(1)
      expect(stats.following_count).toBe(1)
      expect(stats.mutual_follows_count).toBe(1)
      expect(stats.influence_score).toBe(10)
    })
  })

  describe('社交協同過濾快取更新', () => {
    test('應該更新社交協同過濾快取', async () => {
      const mockInteractionMatrix = {
        user1: { meme1: 1.0 },
        user2: { meme2: 2.0 },
      }

      const mockSocialGraph = {
        user1: {
          followers: [],
          following: [],
          mutual: [],
          influence_score: 5,
          social_connections: 0,
        },
        user2: {
          followers: [{ user_id: 'user1' }],
          following: [],
          mutual: [],
          influence_score: 10,
          social_connections: 1,
        },
      }

      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue(
        mockInteractionMatrix,
      )
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue(mockSocialGraph)

      const cacheResults = await CF.updateSocialCollaborativeFilteringCache(['user1', 'user2'])

      expect(cacheResults).toBeDefined()
      expect(cacheResults.total_users).toBe(2)
      expect(cacheResults.total_interactions).toBe(2)
      expect(cacheResults.total_social_connections).toBe(1)
      expect(cacheResults.average_influence_score).toBe(7.5)
      expect(cacheResults.processing_time).toBeGreaterThan(0)
    })
  })

  describe('分頁功能測試', () => {
    test('應該正確處理分頁和排除ID', async () => {
      const mockInteractionMatrix = {
        user1: { meme1: 1.0, meme2: 2.0, meme3: 3.0 },
        user2: { meme1: 2.0, meme3: 1.0, meme4: 2.0 },
        user3: { meme2: 1.0, meme4: 3.0, meme5: 2.0 },
      }

      const mockSocialGraph = {
        user1: {
          followers: ['user2'],
          following: ['user2'],
          mutualFollows: ['user2'],
        },
        user2: {
          followers: ['user1'],
          following: ['user1'],
          mutualFollows: ['user1'],
        },
        user3: {
          followers: [],
          following: ['user1'],
          mutualFollows: [],
        },
      }

      // Mock Meme.find 返回不同的迷因
      const mockMemes = [
        { _id: 'meme1', hot_score: 100, toObject: () => ({ _id: 'meme1', hot_score: 100 }) },
        { _id: 'meme2', hot_score: 200, toObject: () => ({ _id: 'meme2', hot_score: 200 }) },
        { _id: 'meme3', hot_score: 300, toObject: () => ({ _id: 'meme3', hot_score: 300 }) },
        { _id: 'meme4', hot_score: 400, toObject: () => ({ _id: 'meme4', hot_score: 400 }) },
        { _id: 'meme5', hot_score: 500, toObject: () => ({ _id: 'meme5', hot_score: 500 }) },
      ]

      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue(
        mockInteractionMatrix,
      )
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue(mockSocialGraph)

      // Mock Meme.find 來模擬分頁
      const mockMemeFind = vi.fn()
      mockMemeFind.mockResolvedValueOnce([mockMemes[0], mockMemes[1]]) // 第一頁
      mockMemeFind.mockResolvedValueOnce([mockMemes[2], mockMemes[3]]) // 第二頁
      Meme.find = mockMemeFind

      // 測試第一頁
      const recommendations1 = await CF.getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 2,
        page: 1,
        excludeIds: [],
      })

      expect(recommendations1).toBeDefined()
      expect(Array.isArray(recommendations1)).toBe(true)
      expect(recommendations1.length).toBeLessThanOrEqual(2)

      // 測試第二頁（排除第一頁的內容）
      const recommendations2 = await CF.getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 2,
        page: 2,
        excludeIds: ['meme1', 'meme2'],
      })

      expect(recommendations2).toBeDefined()
      expect(Array.isArray(recommendations2)).toBe(true)
      expect(recommendations2.length).toBeLessThanOrEqual(2)

      // 驗證第二頁的內容不包含第一頁的內容
      const firstPageIds = recommendations1.map((r) => r._id)
      const secondPageIds = recommendations2.map((r) => r._id)

      const hasOverlap = firstPageIds.some((id) => secondPageIds.includes(id))
      expect(hasOverlap).toBe(false)
    })

    test('應該處理冷啟動情況下的分頁', async () => {
      // Mock 空的互動歷史
      const mockInteractionMatrix = {}
      const mockSocialGraph = {}

      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue(
        mockInteractionMatrix,
      )
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue(mockSocialGraph)

      // Mock Meme.find 返回熱門迷因
      const mockMemes = [
        { _id: 'meme1', hot_score: 100, toObject: () => ({ _id: 'meme1', hot_score: 100 }) },
        { _id: 'meme2', hot_score: 200, toObject: () => ({ _id: 'meme2', hot_score: 200 }) },
        { _id: 'meme3', hot_score: 300, toObject: () => ({ _id: 'meme3', hot_score: 300 }) },
      ]

      const mockMemeFind = vi.fn()
      mockMemeFind.mockResolvedValueOnce([mockMemes[0], mockMemes[1]]) // 第一頁
      mockMemeFind.mockResolvedValueOnce([mockMemes[2]]) // 第二頁
      Meme.find = mockMemeFind

      // 測試第一頁
      const recommendations1 = await CF.getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 2,
        page: 1,
        excludeIds: [],
      })

      expect(recommendations1).toBeDefined()
      expect(Array.isArray(recommendations1)).toBe(true)
      expect(recommendations1[0].recommendation_type).toBe('social_collaborative_fallback')

      // 測試第二頁
      const recommendations2 = await CF.getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 2,
        page: 2,
        excludeIds: ['meme1', 'meme2'],
      })

      expect(recommendations2).toBeDefined()
      expect(Array.isArray(recommendations2)).toBe(true)
      expect(recommendations2[0].recommendation_type).toBe('social_collaborative_fallback')
    })
  })
})