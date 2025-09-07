import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  calculateMemeHotScore,
  batchUpdateHotScores,
  getHotScoreLevel,
} from '../../../utils/hotScore.js'
import { batchUpdateHotScores as batchUpdateHotScoresScheduler } from '../../../utils/hotScoreScheduler.js'
import Meme from '../../../models/Meme.js'
import User from '../../../models/User.js'
import { createTestUser, createTestMeme } from '../../setup.js'

// Mock 快取相關模組
vi.mock('../../../config/redis.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null), // 返回 null 表示快取未命中
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('../../../utils/cacheVersionManager.js', () => ({
  default: {
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
    updateVersion: vi.fn().mockResolvedValue('1.0.1'),
    batchUpdateVersions: vi.fn().mockResolvedValue([]),
  },
}))

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('熱門分數系統測試', () => {
  let testUser
  let testMemes = []

  beforeAll(async () => {
    // 創建測試用戶
    testUser = await createTestUser(User, {
      username: 'test_hotscore_user',
      email: 'test_hotscore@example.com',
    })

    // 創建測試迷因
    testMemes = []
    for (let i = 0; i < 5; i++) {
      const meme = await createTestMeme(Meme, testUser._id, {
        title: `測試迷因 ${i + 1}`,
        like_count: Math.floor(Math.random() * 100),
        dislike_count: Math.floor(Math.random() * 20),
        views: Math.floor(Math.random() * 1000),
        comment_count: Math.floor(Math.random() * 50),
        collection_count: Math.floor(Math.random() * 30),
        share_count: Math.floor(Math.random() * 10),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 過去30天內
      })
      testMemes.push(meme)
    }
  })

  afterAll(async () => {
    // 清理測試數據
    await Meme.deleteMany({ author_id: testUser._id })
    await User.deleteMany({ _id: testUser._id })
  })

  describe('calculateMemeHotScore', () => {
    it('應該正確計算正常的迷因熱門分數', async () => {
      const memeData = {
        _id: 'test123',
        like_count: 50,
        dislike_count: 5,
        views: 200,
        comment_count: 20,
        collection_count: 15,
        share_count: 10,
        createdAt: new Date(),
        modified_at: new Date(),
      }

      // 確保Redis mock正確設置
      const redisCache = await import('../../../config/redis.js')
      redisCache.default.get = vi.fn().mockResolvedValue(null)
      redisCache.default.set = vi.fn().mockResolvedValue('OK')

      const hotScore = await calculateMemeHotScore(memeData)

      expect(typeof hotScore).toBe('number')
      expect(hotScore).toBeGreaterThan(0)
      expect(isFinite(hotScore)).toBe(true)
    })

    it('應該處理無效的輸入資料', async () => {
      const invalidData = {
        _id: null,
        like_count: 'invalid',
        dislike_count: null,
        views: undefined,
        createdAt: 'invalid_date',
      }

      const hotScore = await calculateMemeHotScore(invalidData)
      expect(hotScore).toBe(0) // 應該返回預設值
    })

    it('應該處理缺少必要欄位的資料', async () => {
      const incompleteData = {
        _id: 'test_incomplete',
        // 缺少 createdAt
      }

      // 確保Redis mock正確設置
      const redisCache = await import('../../../config/redis.js')
      redisCache.default.get = vi.fn().mockResolvedValue(null)
      redisCache.default.set = vi.fn().mockResolvedValue('OK')

      const hotScore = await calculateMemeHotScore(incompleteData)

      // 應該返回預設值0而不是拋出錯誤
      expect(hotScore).toBe(0)
    })

    it('應該處理數值為零或負數的情況', async () => {
      const zeroData = {
        _id: 'test_zero',
        like_count: 0,
        dislike_count: 0,
        views: 0,
        comment_count: 0,
        collection_count: 0,
        share_count: 0,
        createdAt: new Date(),
      }

      const hotScore = await calculateMemeHotScore(zeroData)
      expect(hotScore).toBeGreaterThanOrEqual(0)
    })

    it('應該正確處理修改時間的加成效果', async () => {
      const oldMeme = {
        _id: 'test_old',
        like_count: 10,
        dislike_count: 1,
        views: 50,
        comment_count: 5,
        collection_count: 2,
        share_count: 1,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
        modified_at: new Date(), // 剛剛修改
      }

      // 確保Redis mock正確設置
      const redisCache = await import('../../../config/redis.js')
      redisCache.default.get = vi.fn().mockResolvedValue(null)
      redisCache.default.set = vi.fn().mockResolvedValue('OK')

      const hotScore = await calculateMemeHotScore(oldMeme)
      expect(hotScore).toBeGreaterThan(0)
    })
  })

  describe('batchUpdateHotScores', () => {
    it('應該成功批次更新多個迷因的熱門分數', async () => {
      const memes = testMemes.slice(0, 3)

      const result = await batchUpdateHotScores(memes)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)

      result.forEach((meme) => {
        expect(meme).toHaveProperty('hot_score')
        expect(typeof meme.hot_score).toBe('number')
        expect(meme.hot_score).toBeGreaterThanOrEqual(0)
      })
    })

    it('應該處理空的迷因陣列', async () => {
      const result = await batchUpdateHotScores([])
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('應該處理包含無效資料的迷因陣列', async () => {
      const mixedMemes = [
        {
          _id: 'valid1',
          like_count: 10,
          dislike_count: 0,
          views: 50,
          comment_count: 2,
          collection_count: 1,
          share_count: 0,
          createdAt: new Date(),
        },
        {
          _id: 'invalid1',
          // 缺少必要欄位
        },
      ]

      const result = await batchUpdateHotScores(mixedMemes)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)

      // 第一個應該成功
      expect(result[0]).toHaveProperty('hot_score')
      expect(typeof result[0].hot_score).toBe('number')

      // 第二個應該有預設值
      expect(result[1]).toHaveProperty('hot_score')
      expect(result[1].hot_score).toBe(0)
    })
  })

  describe('getHotScoreLevel', () => {
    it('應該正確分類熱門分數等級', () => {
      expect(getHotScoreLevel(1500)).toBe('viral')
      expect(getHotScoreLevel(800)).toBe('trending')
      expect(getHotScoreLevel(200)).toBe('popular')
      expect(getHotScoreLevel(80)).toBe('active')
      expect(getHotScoreLevel(25)).toBe('normal')
      expect(getHotScoreLevel(5)).toBe('new')
    })

    it('應該處理邊界值', () => {
      expect(getHotScoreLevel(1000)).toBe('viral')
      expect(getHotScoreLevel(500)).toBe('trending')
      expect(getHotScoreLevel(100)).toBe('popular')
      expect(getHotScoreLevel(50)).toBe('active')
      expect(getHotScoreLevel(10)).toBe('normal')
    })

    it('應該處理負數和零', () => {
      expect(getHotScoreLevel(0)).toBe('new')
      expect(getHotScoreLevel(-10)).toBe('new')
    })
  })

  describe('資料庫整合測試', () => {
    it('應該能夠從資料庫讀取並更新真實的迷因資料', async () => {
      // 從資料庫重新獲取迷因
      const memesFromDb = await Meme.find({
        author_id: testUser._id,
        title: { $regex: /^測試迷因/ },
      }).limit(3)

      expect(memesFromDb.length).toBeGreaterThan(0)

      // 測試批次更新
      const result = await batchUpdateHotScores(memesFromDb)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(memesFromDb.length)

      // 驗證每個迷因都有熱門分數
      result.forEach((meme) => {
        expect(meme).toHaveProperty('hot_score')
        expect(typeof meme.hot_score).toBe('number')
        expect(meme.hot_score).toBeGreaterThanOrEqual(0)
      })
    })

    it('應該處理資料庫查詢超時的情況', async () => {
      // Mock 資料庫查詢超時
      const originalFind = Meme.find
      const mockQuery = {
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        sort: vi.fn().mockRejectedValue(new Error('Operation buffering timed out')),
      }

      Meme.find = vi.fn().mockReturnValue(mockQuery)

      try {
        const result = await batchUpdateHotScoresScheduler({
          limit: 10,
          force: false,
        })

        // 應該成功但有錯誤記錄
        expect(result.success).toBe(true)
        expect(result.error_count).toBeGreaterThan(0)
        expect(result.errors[0].error).toContain('Operation buffering timed out')
      } finally {
        // 恢復原始方法
        Meme.find = originalFind
      }
    })

    it('應該處理空的查詢結果', async () => {
      // Mock 空的查詢結果
      const originalCountDocuments = Meme.countDocuments
      const originalFind = Meme.find

      Meme.countDocuments = vi.fn().mockResolvedValue(0)

      const result = await batchUpdateHotScoresScheduler({
        limit: 10,
        force: false,
      })

      expect(result).toEqual({
        success: true,
        updated_count: 0,
        message: '沒有迷因需要更新',
      })

      // 恢復原始方法
      Meme.countDocuments = originalCountDocuments
      Meme.find = originalFind
    })
  })

  describe('錯誤處理和恢復測試', () => {
    it('應該在快取失敗時降級處理', async () => {
      // Mock 快取失敗
      const redisCache = await import('../../../config/redis.js')
      const originalGet = redisCache.default.get
      const originalSet = redisCache.default.set

      redisCache.default.get = vi.fn().mockRejectedValue(new Error('Redis connection failed'))
      redisCache.default.set = vi.fn().mockRejectedValue(new Error('Redis connection failed'))

      const memeData = {
        _id: 'test_cache_fail',
        like_count: 10,
        dislike_count: 0,
        views: 50,
        comment_count: 2,
        collection_count: 1,
        share_count: 0,
        createdAt: new Date(),
      }

      // 應該不會拋出錯誤，而是返回計算結果
      const hotScore = await calculateMemeHotScore(memeData)
      expect(typeof hotScore).toBe('number')

      // 恢復原始方法
      redisCache.default.get = originalGet
      redisCache.default.set = originalSet
    })

    it('應該處理版本控制失敗', async () => {
      // Mock 版本管理器失敗
      const cacheVersionManager = await import('../../../utils/cacheVersionManager.js')
      const originalGetVersion = cacheVersionManager.default.getVersion

      cacheVersionManager.default.getVersion = vi
        .fn()
        .mockRejectedValue(new Error('Version manager failed'))

      const memeData = {
        _id: 'test_version_fail',
        like_count: 10,
        dislike_count: 0,
        views: 50,
        comment_count: 2,
        collection_count: 1,
        share_count: 0,
        createdAt: new Date(),
      }

      // 應該不會拋出錯誤，而是繼續處理
      const hotScore = await calculateMemeHotScore(memeData)
      expect(typeof hotScore).toBe('number')

      // 恢復原始方法
      cacheVersionManager.default.getVersion = originalGetVersion
    })
  })

  describe('效能測試', () => {
    it('應該能夠處理大量迷因的批次更新', async () => {
      const largeMemeArray = []

      // 創建100個測試迷因
      for (let i = 0; i < 100; i++) {
        largeMemeArray.push({
          _id: `test_large_${i}`,
          like_count: Math.floor(Math.random() * 100),
          dislike_count: Math.floor(Math.random() * 20),
          views: Math.floor(Math.random() * 1000),
          comment_count: Math.floor(Math.random() * 50),
          collection_count: Math.floor(Math.random() * 30),
          share_count: Math.floor(Math.random() * 10),
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        })
      }

      const startTime = Date.now()
      const result = await batchUpdateHotScores(largeMemeArray)
      const endTime = Date.now()

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(100)

      // 驗證所有結果都有熱門分數
      result.forEach((meme) => {
        expect(meme).toHaveProperty('hot_score')
        expect(typeof meme.hot_score).toBe('number')
      })

      const processingTime = endTime - startTime
      console.log(`批次更新100個迷因耗時: ${processingTime}ms`)

      // 應該在合理時間內完成（例如不超過10秒）
      expect(processingTime).toBeLessThan(10000)
    }, 15000) // 設定15秒超時
  })
})
