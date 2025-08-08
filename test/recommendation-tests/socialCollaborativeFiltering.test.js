/**
 * 社交協同過濾推薦系統測試
 * 測試社交關係圖譜分析、社交影響力計算、社交相似度計算等功能
 */

import { jest } from '@jest/globals'
import {
  buildSocialGraph,
  calculateSocialInfluenceScore,
  calculateSocialSimilarity,
  findSocialSimilarUsers,
  calculateSocialWeightedSimilarity,
  getSocialCollaborativeFilteringRecommendations,
  getSocialCollaborativeFilteringStats,
  updateSocialCollaborativeFilteringCache,
} from '../utils/collaborativeFiltering.js'

// Mock 模型
jest.mock('../models/User.js', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}))

jest.mock('../models/Meme.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Follow.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Like.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Collection.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Comment.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Share.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/View.js', () => ({
  find: jest.fn(),
}))

describe('社交協同過濾推薦系統測試', () => {
  let mockUser, mockMeme, mockFollow, mockLike, mockCollection, mockComment, mockShare, mockView

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks()

    // 設置 mock 數據
    mockUser = {
      find: jest.fn().mockResolvedValue([{ _id: 'user1' }, { _id: 'user2' }, { _id: 'user3' }]),
    }

    mockMeme = {
      find: jest.fn().mockResolvedValue([
        { _id: 'meme1', hot_score: 100 },
        { _id: 'meme2', hot_score: 200 },
      ]),
    }

    mockFollow = {
      find: jest.fn().mockResolvedValue([
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
      find: jest.fn().mockResolvedValue([
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
      find: jest.fn().mockResolvedValue([
        {
          user_id: 'user1',
          meme_id: 'meme2',
          createdAt: new Date('2024-01-01'),
        },
      ]),
    }

    mockComment = {
      find: jest.fn().mockResolvedValue([]),
    }

    mockShare = {
      find: jest.fn().mockResolvedValue([]),
    }

    mockView = {
      find: jest.fn().mockResolvedValue([]),
    }

    // 設置 mock 模組
    const User = require('../models/User.js')
    const Meme = require('../models/Meme.js')
    const Follow = require('../models/Follow.js')
    const Like = require('../models/Like.js')
    const Collection = require('../models/Collection.js')
    const Comment = require('../models/Comment.js')
    const Share = require('../models/Share.js')
    const View = require('../models/View.js')

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

      const influenceScore = calculateSocialInfluenceScore(userData)

      expect(influenceScore).toBeGreaterThan(0)
      expect(typeof influenceScore).toBe('number')
    })

    test('應該處理空數據的情況', () => {
      const userData = {
        followers: [],
        following: [],
        mutual: [],
      }

      const influenceScore = calculateSocialInfluenceScore(userData)

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

      const similarity = calculateSocialSimilarity('user1', 'user2', socialGraph)

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

      const similarity = calculateSocialSimilarity('user1', 'user2', socialGraph)

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

      const similarUsers = findSocialSimilarUsers('user1', socialGraph, 0.1, 10)

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

      const similarUsers = findSocialSimilarUsers('user1', socialGraph, 0.1, 10)

      expect(similarUsers[0].similarity).toBeGreaterThanOrEqual(similarUsers[1].similarity)
    })
  })

  describe('社交加權相似度計算', () => {
    test('應該正確計算社交加權相似度', () => {
      const user1Interactions = { meme1: 1.0, meme2: 2.0 }
      const user2Interactions = { meme1: 1.5, meme2: 1.8 }
      const socialSimilarity = 0.8
      const user2InfluenceScore = 25.5

      const weightedSimilarity = calculateSocialWeightedSimilarity(
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

      const weightedSimilarity = calculateSocialWeightedSimilarity(
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
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildInteractionMatrix')
        .mockResolvedValue(mockInteractionMatrix)
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildSocialGraph')
        .mockResolvedValue(mockSocialGraph)

      const recommendations = await getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 5,
      })

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
    })

    test('應該處理冷啟動情況', async () => {
      // Mock 空的互動歷史
      const mockInteractionMatrix = {}
      const mockSocialGraph = {}

      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildInteractionMatrix')
        .mockResolvedValue(mockInteractionMatrix)
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildSocialGraph')
        .mockResolvedValue(mockSocialGraph)

      const recommendations = await getSocialCollaborativeFilteringRecommendations('user1', {
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

      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildInteractionMatrix')
        .mockResolvedValue(mockInteractionMatrix)
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildSocialGraph')
        .mockResolvedValue(mockSocialGraph)

      const stats = await getSocialCollaborativeFilteringStats('user1')

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

      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildInteractionMatrix')
        .mockResolvedValue(mockInteractionMatrix)
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildSocialGraph')
        .mockResolvedValue(mockSocialGraph)

      const cacheResults = await updateSocialCollaborativeFilteringCache(['user1', 'user2'])

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

      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildInteractionMatrix')
        .mockResolvedValue(mockInteractionMatrix)
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildSocialGraph')
        .mockResolvedValue(mockSocialGraph)

      // Mock Meme.find 來模擬分頁
      const mockMemeFind = jest.fn()
      mockMemeFind.mockResolvedValueOnce([mockMemes[0], mockMemes[1]]) // 第一頁
      mockMemeFind.mockResolvedValueOnce([mockMemes[2], mockMemes[3]]) // 第二頁
      require('../models/Meme.js').find = mockMemeFind

      // 測試第一頁
      const recommendations1 = await getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 2,
        page: 1,
        excludeIds: [],
      })

      expect(recommendations1).toBeDefined()
      expect(Array.isArray(recommendations1)).toBe(true)
      expect(recommendations1.length).toBeLessThanOrEqual(2)

      // 測試第二頁（排除第一頁的內容）
      const recommendations2 = await getSocialCollaborativeFilteringRecommendations('user1', {
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

      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildInteractionMatrix')
        .mockResolvedValue(mockInteractionMatrix)
      jest
        .spyOn(require('../utils/collaborativeFiltering.js'), 'buildSocialGraph')
        .mockResolvedValue(mockSocialGraph)

      // Mock Meme.find 返回熱門迷因
      const mockMemes = [
        { _id: 'meme1', hot_score: 100, toObject: () => ({ _id: 'meme1', hot_score: 100 }) },
        { _id: 'meme2', hot_score: 200, toObject: () => ({ _id: 'meme2', hot_score: 200 }) },
        { _id: 'meme3', hot_score: 300, toObject: () => ({ _id: 'meme3', hot_score: 300 }) },
      ]

      const mockMemeFind = jest.fn()
      mockMemeFind.mockResolvedValueOnce([mockMemes[0], mockMemes[1]]) // 第一頁
      mockMemeFind.mockResolvedValueOnce([mockMemes[2]]) // 第二頁
      require('../models/Meme.js').find = mockMemeFind

      // 測試第一頁
      const recommendations1 = await getSocialCollaborativeFilteringRecommendations('user1', {
        limit: 2,
        page: 1,
        excludeIds: [],
      })

      expect(recommendations1).toBeDefined()
      expect(Array.isArray(recommendations1)).toBe(true)
      expect(recommendations1[0].recommendation_type).toBe('social_collaborative_fallback')

      // 測試第二頁
      const recommendations2 = await getSocialCollaborativeFilteringRecommendations('user1', {
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
