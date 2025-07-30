/**
 * 社交層分數計算系統測試
 */

import {
  calculateSocialDistance,
  calculateSocialInfluenceScore,
  calculateMultipleMemeSocialScores,
  getUserSocialInfluenceStats,
  generateSocialRecommendationReasons,
  SOCIAL_SCORE_CONFIG,
} from '../utils/socialScoreCalculator.js'

// Mock Mongoose models
jest.mock('../models/Follow.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Like.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Comment.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Share.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/Collection.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/View.js', () => ({
  find: jest.fn(),
}))

jest.mock('../models/User.js', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}))

jest.mock('../models/Meme.js', () => ({
  findById: jest.fn(),
}))

describe('社交層分數計算系統', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
      expect(SOCIAL_SCORE_CONFIG.interactions.publish).toBe(5)
      expect(SOCIAL_SCORE_CONFIG.interactions.like).toBe(3)
      expect(SOCIAL_SCORE_CONFIG.interactions.comment).toBe(3)
      expect(SOCIAL_SCORE_CONFIG.interactions.share).toBe(4)
      expect(SOCIAL_SCORE_CONFIG.interactions.collect).toBe(2)
      expect(SOCIAL_SCORE_CONFIG.interactions.view).toBe(1)
    })

    test('距離權重配置應該正確', () => {
      expect(SOCIAL_SCORE_CONFIG.distanceWeights.directFollow).toBe(1.0)
      expect(SOCIAL_SCORE_CONFIG.distanceWeights.mutualFollow).toBe(1.5)
      expect(SOCIAL_SCORE_CONFIG.distanceWeights.secondDegree).toBe(0.6)
      expect(SOCIAL_SCORE_CONFIG.distanceWeights.thirdDegree).toBe(0.3)
    })

    test('分數上限配置應該正確', () => {
      expect(SOCIAL_SCORE_CONFIG.scoreLimits.maxSocialScore).toBe(20)
      expect(SOCIAL_SCORE_CONFIG.scoreLimits.maxInfluenceScore).toBe(100)
      expect(SOCIAL_SCORE_CONFIG.scoreLimits.maxDistanceScore).toBe(10)
    })
  })

  describe('calculateSocialDistance', () => {
    test('應該正確計算直接關注距離', async () => {
      const socialGraph = {
        user1: {
          following: ['user2'],
          followers: [],
          mutualFollows: [],
        },
        user2: {
          following: [],
          followers: ['user1'],
          mutualFollows: [],
        },
      }

      const result = await calculateSocialDistance('user1', 'user2', socialGraph)
      expect(result.distance).toBe(1)
      expect(result.type).toBe('direct_follow')
      expect(result.weight).toBe(1.0)
    })

    test('應該正確計算互相關注距離', async () => {
      const socialGraph = {
        user1: {
          following: ['user2'],
          followers: ['user2'],
          mutualFollows: ['user2'],
        },
        user2: {
          following: ['user1'],
          followers: ['user1'],
          mutualFollows: ['user1'],
        },
      }

      const result = await calculateSocialDistance('user1', 'user2', socialGraph)
      expect(result.distance).toBe(1)
      expect(result.type).toBe('mutual_follow')
      expect(result.weight).toBe(1.5)
    })

    test('應該正確計算二度關係距離', async () => {
      const socialGraph = {
        user1: {
          following: ['user2'],
          followers: [],
          mutualFollows: [],
        },
        user2: {
          following: ['user3'],
          followers: ['user1'],
          mutualFollows: [],
        },
        user3: {
          following: [],
          followers: ['user2'],
          mutualFollows: [],
        },
      }

      const result = await calculateSocialDistance('user1', 'user3', socialGraph)
      expect(result.distance).toBe(2)
      expect(result.type).toBe('second_degree')
      expect(result.weight).toBe(0.6)
    })

    test('應該處理未知距離', async () => {
      const socialGraph = {
        user1: {
          following: [],
          followers: [],
          mutualFollows: [],
        },
        user2: {
          following: [],
          followers: [],
          mutualFollows: [],
        },
      }

      const result = await calculateSocialDistance('user1', 'user2', socialGraph)
      expect(result.distance).toBe(Infinity)
      expect(result.type).toBe('unknown')
      expect(result.weight).toBe(0)
    })
  })

  describe('calculateSocialInfluenceScore', () => {
    test('應該正確計算影響力分數', () => {
      const userSocialData = {
        followers: ['user2', 'user3', 'user4'],
        following: ['user5', 'user6'],
        mutualFollows: ['user7'],
      }

      const result = calculateSocialInfluenceScore(userSocialData)
      expect(result.score).toBeGreaterThan(0)
      expect(result.level).toBeDefined()
      expect(result.followers).toBe(3)
      expect(result.following).toBe(2)
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

    test('應該限制最大影響力分數', () => {
      const userSocialData = {
        followers: Array(200).fill('user'),
        following: Array(100).fill('user'),
        mutualFollows: Array(50).fill('user'),
      }

      const result = calculateSocialInfluenceScore(userSocialData)
      expect(result.score).toBeLessThanOrEqual(SOCIAL_SCORE_CONFIG.scoreLimits.maxInfluenceScore)
    })
  })

  describe('generateSocialRecommendationReasons', () => {
    test('應該生成推薦原因', () => {
      const socialInteractions = [
        {
          action: 'like',
          weight: 10,
          displayName: '用戶A',
          username: 'userA',
          distance: 1,
          distanceType: 'direct_follow',
          influenceScore: 25,
          influenceLevel: 'active',
        },
        {
          action: 'share',
          weight: 15,
          displayName: '用戶B',
          username: 'userB',
          distance: 2,
          distanceType: 'second_degree',
          influenceScore: 30,
          influenceLevel: 'popular',
        },
      ]

      const reasons = generateSocialRecommendationReasons(socialInteractions, {
        maxReasons: 2,
        minWeight: 5,
      })

      expect(reasons).toHaveLength(2)
      expect(reasons[0].type).toBe('share') // 權重更高的應該在前面
      expect(reasons[0].weight).toBe(15)
      expect(reasons[1].type).toBe('like')
      expect(reasons[1].weight).toBe(10)
    })

    test('應該過濾低權重的互動', () => {
      const socialInteractions = [
        {
          action: 'like',
          weight: 3,
          displayName: '用戶A',
          username: 'userA',
        },
        {
          action: 'view',
          weight: 1,
          displayName: '用戶B',
          username: 'userB',
        },
      ]

      const reasons = generateSocialRecommendationReasons(socialInteractions, {
        maxReasons: 2,
        minWeight: 5,
      })

      expect(reasons).toHaveLength(0)
    })

    test('應該限制推薦原因數量', () => {
      const socialInteractions = [
        { action: 'like', weight: 10, displayName: '用戶A', username: 'userA' },
        { action: 'share', weight: 15, displayName: '用戶B', username: 'userB' },
        { action: 'comment', weight: 8, displayName: '用戶C', username: 'userC' },
      ]

      const reasons = generateSocialRecommendationReasons(socialInteractions, {
        maxReasons: 2,
        minWeight: 5,
      })

      expect(reasons).toHaveLength(2)
    })
  })

  describe('getUserSocialInfluenceStats', () => {
    test('應該返回用戶社交影響力統計', async () => {
      // Mock buildSocialGraph
      const mockBuildSocialGraph = jest.fn().mockResolvedValue({
        user1: {
          followers: ['user2', 'user3'],
          following: ['user4'],
          mutualFollows: ['user5'],
        },
      })

      // Mock calculateSocialInfluenceScore
      const mockCalculateSocialInfluenceScore = jest.fn().mockReturnValue({
        score: 25.3,
        level: 'active',
        followers: 2,
        following: 1,
        mutualFollows: 1,
      })

      // 替換模組中的函數
      jest.doMock('../utils/socialScoreCalculator.js', () => ({
        ...jest.requireActual('../utils/socialScoreCalculator.js'),
        buildSocialGraph: mockBuildSocialGraph,
        calculateSocialInfluenceScore: mockCalculateSocialInfluenceScore,
      }))

      const result = await getUserSocialInfluenceStats('user1')
      expect(result.influenceScore).toBe(25.3)
      expect(result.influenceLevel).toBe('active')
      expect(result.followers).toBe(2)
      expect(result.following).toBe(1)
      expect(result.mutualFollows).toBe(1)
    })
  })

  describe('calculateMultipleMemeSocialScores', () => {
    test('應該批量計算多個迷因的社交分數', async () => {
      const userId = 'user1'
      const memeIds = ['meme1', 'meme2', 'meme3']

      // Mock calculateMemeSocialScore
      const mockCalculateMemeSocialScore = jest.fn().mockResolvedValue({
        socialScore: 10,
        distanceScore: 2,
        influenceScore: 5,
        interactionScore: 3,
        reasons: [],
        socialInteractions: [],
      })

      // 替換模組中的函數
      jest.doMock('../utils/socialScoreCalculator.js', () => ({
        ...jest.requireActual('../utils/socialScoreCalculator.js'),
        calculateMemeSocialScore: mockCalculateMemeSocialScore,
      }))

      const results = await calculateMultipleMemeSocialScores(userId, memeIds)
      expect(results).toHaveLength(3)
      expect(mockCalculateMemeSocialScore).toHaveBeenCalledTimes(3)
    })
  })
})
