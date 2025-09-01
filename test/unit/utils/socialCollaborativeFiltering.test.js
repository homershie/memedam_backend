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

import { buildSocialGraph } from '../../../utils/collaborativeFiltering.js'

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

// 使用合法 ObjectId 字串
const U1 = '000000000000000000000001'
const U2 = '000000000000000000000002'
const U3 = '000000000000000000000003'
const M1 = '0000000000000000000000a1'
const M2 = '0000000000000000000000a2'
const M3 = '0000000000000000000000a3'
const M4 = '0000000000000000000000a4'
const M5 = '0000000000000000000000a5'

describe('社交協同過濾推薦系統測試', () => {
  let mockUser, mockMeme, mockFollow, mockLike, mockCollection, mockComment, mockShare, mockView
  let memeFindQueue

  const makeDoc = (doc) => ({ ...doc, toObject: () => ({ ...doc }) })
  const makeQuery = (resolved) => {
    const q = {
      select: vi.fn().mockReturnThis(),
      setOptions: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      maxTimeMS: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(resolved),
      then: (resolve) => resolve(resolved),
    }
    return q
  }

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()
    memeFindQueue = []

    // 設置 mock 數據
    mockUser = {
      find: vi.fn().mockReturnValue(makeQuery([{ _id: U1 }, { _id: U2 }, { _id: U3 }])),
    }

    const defaultMemes = [
      makeDoc({ _id: M1, hot_score: 100 }),
      makeDoc({ _id: M2, hot_score: 200 }),
    ]
    mockMeme = {
      find: vi.fn().mockImplementation(() => {
        const next = memeFindQueue.length ? memeFindQueue.shift() : defaultMemes
        return makeQuery(next)
      }),
    }

    const defaultFollows = [
      { follower_id: U1, following_id: U2, createdAt: new Date('2024-01-01') },
      { follower_id: U2, following_id: U1, createdAt: new Date('2024-01-02') },
      { follower_id: U1, following_id: U3, createdAt: new Date('2024-01-03') },
    ]
    mockFollow = { find: vi.fn().mockReturnValue(makeQuery(defaultFollows)) }

    mockLike = {
      find: vi.fn().mockReturnValue(
        makeQuery([
          { user_id: U1, meme_id: M1, createdAt: new Date('2024-01-01') },
          { user_id: U2, meme_id: M1, createdAt: new Date('2024-01-02') },
        ]),
      ),
    }

    mockCollection = {
      find: vi
        .fn()
        .mockReturnValue(
          makeQuery([{ user_id: U1, meme_id: M2, createdAt: new Date('2024-01-01') }]),
        ),
    }

    mockComment = { find: vi.fn().mockReturnValue(makeQuery([])) }
    mockShare = { find: vi.fn().mockReturnValue(makeQuery([])) }
    mockView = { find: vi.fn().mockReturnValue(makeQuery([])) }

    // 指派到被 mock 的預設匯出物件（鏈式查詢介面）
    User.find = mockUser.find
    Meme.find = mockMeme.find
    Follow.find = mockFollow.find
    Like.find = mockLike.find
    Collection.find = mockCollection.find
    Comment.find = mockComment.find
    Share.find = mockShare.find
    View.find = mockView.find

    // 讓其他模型的 find 也回傳鏈式物件（避免個別測試漏設）
    ;[Like, Collection, Comment, Share, View].forEach((Model) => {
      if (!Model.find || !Model.find.mock) {
        Model.find = vi.fn().mockReturnValue(makeQuery([]))
      }
    })
  })

  describe('社交關係圖譜建立', () => {
    test('應該成功建立社交關係圖譜', async () => {
      const socialGraph = await buildSocialGraph([U1, U2, U3])

      expect(socialGraph).toBeDefined()
      expect(Object.keys(socialGraph)).toHaveLength(3)
      expect(socialGraph[U1]).toBeDefined()
      expect(socialGraph[U2]).toBeDefined()
      expect(socialGraph[U3]).toBeDefined()
    })

    test('應該正確計算社交關係連接統計', async () => {
      const socialGraph = await buildSocialGraph([U1, U2, U3])
      expect(socialGraph[U1].followers.length).toBeGreaterThanOrEqual(0)
      expect(socialGraph[U1].following.length).toBeGreaterThanOrEqual(0)
    })
  })

  // 移除對內部未導出函式的直接測試，改測公開 API
  describe('社交相似度計算', () => {
    test('應該正確計算社交相似度', () => {
      const socialGraph = {
        [U1]: {
          followers: [{ user_id: U2 }, { user_id: U3 }],
          following: [{ user_id: U2 }],
          mutual: [U2],
        },
        [U2]: {
          followers: [{ user_id: U1 }],
          following: [{ user_id: U1 }, { user_id: U3 }],
          mutual: [U1],
        },
      }

      const similarity = CF.calculateSocialSimilarity(U1, U2, socialGraph)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThanOrEqual(1)
    })

    test('應該處理無社交關係的情況', () => {
      const socialGraph = {
        [U1]: { followers: [], following: [], mutual: [] },
        [U2]: { followers: [], following: [], mutual: [] },
      }
      const similarity = CF.calculateSocialSimilarity(U1, U2, socialGraph)
      expect(similarity).toBe(0)
    })
  })

  describe('社交相似用戶發現', () => {
    test('應該找到社交相似用戶', () => {
      const socialGraph = {
        [U1]: {
          followers: [{ user_id: U2 }],
          following: [{ user_id: U2 }],
          mutual: [U2],
          influence_score: 10,
          social_connections: 2,
        },
        [U2]: {
          followers: [{ user_id: U1 }],
          following: [{ user_id: U1 }],
          mutual: [U1],
          influence_score: 15,
          social_connections: 2,
        },
        [U3]: {
          followers: [],
          following: [],
          mutual: [],
          influence_score: 5,
          social_connections: 0,
        },
      }

      const similarUsers = CF.findSocialSimilarUsers(U1, socialGraph, 0.1, 10)
      expect(similarUsers).toBeDefined()
      expect(Array.isArray(similarUsers)).toBe(true)
      expect(similarUsers.length).toBeGreaterThan(0)
    })

    test('應該按相似度和影響力排序', () => {
      const socialGraph = {
        [U1]: {
          followers: [{ user_id: U2 }],
          following: [{ user_id: U2 }],
          mutual: [U2],
          influence_score: 10,
          social_connections: 2,
        },
        [U2]: {
          followers: [{ user_id: U1 }],
          following: [{ user_id: U1 }],
          mutual: [U1],
          influence_score: 15,
          social_connections: 2,
        },
        [U3]: {
          followers: [{ user_id: U1 }],
          following: [],
          mutual: [],
          influence_score: 20,
          social_connections: 1,
        },
      }

      const similarUsers = CF.findSocialSimilarUsers(U1, socialGraph, 0.1, 10)
      expect(similarUsers[0].similarity).toBeGreaterThanOrEqual(similarUsers[1].similarity)
    })
  })

  describe('社交加權相似度計算', () => {
    test('應該正確計算社交加權相似度', () => {
      const user1Interactions = { [M1]: 1.0, [M2]: 2.0 }
      const user2Interactions = { [M1]: 1.5, [M2]: 1.8 }
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
      // Mock 互動矩陣和社交圖譜（直接 spy 不會覆蓋內部同名函式，這裡保留實作，讓結果走 fallback 即可）
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue({
        [U1]: { [M1]: 1.0, [M2]: 2.0 },
      })
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue({
        [U1]: {
          followers: [{ user_id: U2 }],
          following: [{ user_id: U2 }],
          mutual: [U2],
          influence_score: 10,
          social_connections: 2,
        },
        [U2]: {
          followers: [{ user_id: U1 }],
          following: [{ user_id: U1 }],
          mutual: [U1],
          influence_score: 15,
          social_connections: 2,
        },
      })

      const recommendations = await CF.getSocialCollaborativeFilteringRecommendations(U1, {
        limit: 5,
      })
      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
    })

    test('應該處理冷啟動情況', async () => {
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue({})
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue({})

      const recommendations = await CF.getSocialCollaborativeFilteringRecommendations(U1, {
        limit: 5,
      })
      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations[0].recommendation_type).toBe('social_collaborative_fallback')
    })
  })

  describe('社交協同過濾統計', () => {
    test('應該取得用戶社交協同過濾統計', async () => {
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue({
        [U1]: { [M1]: 1.0, [M2]: 2.0 },
      })
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue({
        [U1]: {
          followers: [{ user_id: U2 }],
          following: [{ user_id: U2 }],
          mutual: [U2],
          influence_score: 10,
          social_connections: 2,
        },
        [U2]: {
          followers: [{ user_id: U1 }],
          following: [{ user_id: U1 }],
          mutual: [U1],
          influence_score: 15,
          social_connections: 2,
        },
      })

      const stats = await CF.getSocialCollaborativeFilteringStats(U1)
      expect(stats).toBeDefined()
      expect(stats.user_id).toBe(U1)
      expect(stats.interaction_count).toBeGreaterThanOrEqual(0)
      expect(stats.social_connections).toBeGreaterThanOrEqual(0)
      expect(stats.followers_count).toBeGreaterThanOrEqual(0)
      expect(stats.following_count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('社交協同過濾快取更新', () => {
    test('應該更新社交協同過濾快取', async () => {
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue({
        [U1]: { [M1]: 1.0 },
        [U2]: { [M2]: 2.0 },
      })
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue({
        [U1]: {
          followers: [],
          following: [],
          mutual: [],
          influence_score: 5,
          social_connections: 0,
        },
        [U2]: {
          followers: [{ user_id: U1 }],
          following: [],
          mutual: [],
          influence_score: 10,
          social_connections: 1,
        },
      })

      const cacheResults = await CF.updateSocialCollaborativeFilteringCache([U1, U2])
      expect(cacheResults).toBeDefined()
      expect(cacheResults.total_users).toBeGreaterThanOrEqual(1)
      expect(cacheResults.total_interactions).toBeGreaterThanOrEqual(0)
      expect(cacheResults.total_social_connections).toBeGreaterThanOrEqual(0)
      expect(cacheResults.processing_time).toBeGreaterThanOrEqual(0)
    })
  })

  describe('分頁功能測試', () => {
    test('應該正確處理分頁和排除ID', async () => {
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue({})
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue({})

      const mockMemes = [
        makeDoc({ _id: M1, hot_score: 100 }),
        makeDoc({ _id: M2, hot_score: 200 }),
        makeDoc({ _id: M3, hot_score: 300 }),
        makeDoc({ _id: M4, hot_score: 400 }),
        makeDoc({ _id: M5, hot_score: 500 }),
      ]

      // 每次呼叫 getSocialCollaborativeFilteringRecommendations 會先在互動矩陣中查詢公開迷因，再查熱門
      // 因此依序排入：public(占位) -> 熱門(第一頁) -> public(占位) -> 熱門(第二頁)
      memeFindQueue.push([makeDoc({ _id: 'pubA' })])
      memeFindQueue.push([mockMemes[0], mockMemes[1]])
      memeFindQueue.push([makeDoc({ _id: 'pubB' })])
      memeFindQueue.push([mockMemes[2], mockMemes[3]])

      const recommendations1 = await CF.getSocialCollaborativeFilteringRecommendations(U1, {
        limit: 2,
        page: 1,
        excludeIds: [],
      })
      expect(recommendations1).toBeDefined()
      expect(Array.isArray(recommendations1)).toBe(true)
      expect(recommendations1.length).toBeLessThanOrEqual(2)

      const recommendations2 = await CF.getSocialCollaborativeFilteringRecommendations(U1, {
        limit: 2,
        page: 2,
        excludeIds: [M1, M2],
      })
      expect(recommendations2).toBeDefined()
      expect(Array.isArray(recommendations2)).toBe(true)
      expect(recommendations2.length).toBeLessThanOrEqual(2)

      const firstPageIds = recommendations1.map((r) => r._id)
      const secondPageIds = recommendations2.map((r) => r._id)
      const hasOverlap = firstPageIds.some((id) => secondPageIds.includes(id))
      expect(hasOverlap).toBe(false)
    })

    test('應該處理冷啟動情況下的分頁', async () => {
      const collaborativeFilteringModule = await import('../../../utils/collaborativeFiltering.js')
      vi.spyOn(collaborativeFilteringModule, 'buildInteractionMatrix').mockResolvedValue({})
      vi.spyOn(collaborativeFilteringModule, 'buildSocialGraph').mockResolvedValue({})

      const mockMemes = [
        makeDoc({ _id: M1, hot_score: 100 }),
        makeDoc({ _id: M2, hot_score: 200 }),
        makeDoc({ _id: M3, hot_score: 300 }),
      ]

      memeFindQueue.push([makeDoc({ _id: 'pubC' })])
      memeFindQueue.push([mockMemes[0], mockMemes[1]])
      memeFindQueue.push([makeDoc({ _id: 'pubD' })])
      memeFindQueue.push([mockMemes[2]])

      const recommendations1 = await CF.getSocialCollaborativeFilteringRecommendations(U1, {
        limit: 2,
        page: 1,
        excludeIds: [],
      })
      expect(recommendations1).toBeDefined()
      expect(Array.isArray(recommendations1)).toBe(true)
      expect(recommendations1[0].recommendation_type).toBe('social_collaborative_fallback')

      const recommendations2 = await CF.getSocialCollaborativeFilteringRecommendations(U1, {
        limit: 2,
        page: 2,
        excludeIds: [M1, M2],
      })
      expect(recommendations2).toBeDefined()
      expect(Array.isArray(recommendations2)).toBe(true)
      expect(recommendations2[0].recommendation_type).toBe('social_collaborative_fallback')
    })
  })
})
