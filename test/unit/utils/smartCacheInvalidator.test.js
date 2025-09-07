/**
 * 智慧快取失效器單元測試
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SmartCacheInvalidator, CACHE_OPERATIONS } from '../../../utils/smartCacheInvalidator.js'

// Mock Redis
const mockRedis = {
  delPattern: vi.fn(),
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}

describe('智慧快取失效器', () => {
  let invalidator

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()

    // 創建新的實例
    invalidator = new SmartCacheInvalidator(mockRedis)
  })

  afterEach(() => {
    invalidator.reset()
  })

  describe('基本功能', () => {
    it('應該正確初始化', () => {
      expect(invalidator).toBeDefined()
      expect(invalidator.invalidatedKeys).toBeDefined()
    })

    it('應該能夠重置失效追蹤器', () => {
      invalidator.invalidatedKeys.add('test:key')
      expect(invalidator.invalidatedKeys.size).toBe(1)

      invalidator.reset()
      expect(invalidator.invalidatedKeys.size).toBe(0)
    })
  })

  describe('迷因創建操作', () => {
    it('應該為迷因創建失效相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(5)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {
        memeId: 'meme123',
        tags: ['funny', 'meme'],
        authorId: 'user456',
      })

      // 應該失效多個模式
      expect(mockRedis.delPattern).toHaveBeenCalledWith('hot_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('latest_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*funny*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*meme*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:user456:*')
    })

    it('應該處理沒有標籤的迷因創建', async () => {
      mockRedis.delPattern.mockResolvedValue(3)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {
        memeId: 'meme123',
        tags: [],
        authorId: 'user456',
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('hot_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('latest_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:user456:*')
    })
  })

  describe('迷因更新操作', () => {
    it('應該為迷因更新失效相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(4)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_UPDATED, {
        memeId: 'meme123',
        oldTags: ['old'],
        newTags: ['new', 'updated'],
        authorId: 'user456',
        hotScoreChanged: true,
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*old*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*new*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*updated*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('updated_recommendations:*')
    })

    it('應該處理沒有熱門分數變化的更新', async () => {
      mockRedis.delPattern.mockResolvedValue(2)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_UPDATED, {
        memeId: 'meme123',
        oldTags: ['tag1'],
        newTags: ['tag1'],
        authorId: 'user456',
        hotScoreChanged: false,
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*tag1*')
      expect(mockRedis.delPattern).not.toHaveBeenCalledWith('updated_recommendations:*')
    })
  })

  describe('用戶互動操作', () => {
    it('應該為按讚操作失效相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(3)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.USER_LIKED, {
        userId: 'user123',
        memeId: 'meme456',
        isLike: true,
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('content_based:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('user_activity:user123')
    })

    it('應該為不喜歡操作失效相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(2)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.USER_DISLIKED, {
        userId: 'user123',
        memeId: 'meme456',
        isLike: false,
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('content_based:user123:*')
    })
  })

  describe('用戶評論操作', () => {
    it('應該為評論操作失效相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(4)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.USER_COMMENTED, {
        userId: 'user123',
        memeId: 'meme456',
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('social_collaborative_filtering:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('user_activity:user123')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('hot_recommendations:*')
    })
  })

  describe('用戶收藏操作', () => {
    it('應該為收藏操作失效相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(3)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.USER_COLLECTED, {
        userId: 'user123',
        memeId: 'meme456',
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('content_based:user123:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('user_activity:user123')
    })
  })

  describe('迷因刪除操作', () => {
    it('應該為迷因刪除失效所有相關快取', async () => {
      mockRedis.delPattern.mockResolvedValue(5)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_DELETED, {
        memeId: 'meme123',
        tags: ['funny', 'meme'],
        authorId: 'user456',
      })

      expect(mockRedis.delPattern).toHaveBeenCalledWith('hot_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('latest_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('updated_recommendations:*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*funny*')
      expect(mockRedis.delPattern).toHaveBeenCalledWith('mixed_recommendations:*:*meme*')
    })
  })

  describe('快取失效追蹤', () => {
    it('應該追蹤已失效的鍵以避免重複失效', async () => {
      mockRedis.delPattern.mockResolvedValue(1)

      // 第一次失效
      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {
        memeId: 'meme123',
        tags: ['test'],
        authorId: 'user456',
      })

      // 第二次失效相同模式應該不會再次調用
      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {
        memeId: 'meme124',
        tags: ['test'],
        authorId: 'user456',
      })

      // 檢查重複失效的邏輯（因為我們使用 Set 來追蹤已失效鍵）
      expect(mockRedis.delPattern).toHaveBeenCalledTimes(9) // 第一次6個 + 第二次3個重複的
    })

    it('應該提供失效統計信息', async () => {
      mockRedis.delPattern.mockResolvedValue(1)

      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {
        memeId: 'meme123',
        tags: ['test'],
        authorId: 'user456',
      })

      const stats = invalidator.getInvalidationStats()
      expect(stats.invalidatedKeysCount).toBeGreaterThan(0)
      expect(stats.invalidatedKeys).toBeInstanceOf(Array)
    })
  })

  describe('錯誤處理', () => {
    it('應該處理無效的操作類型', async () => {
      await invalidator.invalidateByOperation('INVALID_OPERATION', {})

      expect(mockRedis.delPattern).not.toHaveBeenCalled()
    })

    it('應該處理缺少必要參數的操作', async () => {
      await invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {})

      // 如果缺少必要參數，不應該失效任何快取
      expect(mockRedis.delPattern).not.toHaveBeenCalled()
    })

    it('應該處理 Redis 錯誤', async () => {
      mockRedis.delPattern.mockRejectedValue(new Error('Redis connection failed'))

      // 不應該拋出錯誤
      await expect(
        invalidator.invalidateByOperation(CACHE_OPERATIONS.MEME_CREATED, {
          memeId: 'meme123',
          tags: ['test'],
          authorId: 'user456',
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('模式匹配失效', () => {
    it('應該正確失效指定的模式', async () => {
      mockRedis.delPattern.mockResolvedValue(3)

      await invalidator.invalidatePattern('test:pattern:*')

      expect(mockRedis.delPattern).toHaveBeenCalledWith('test:pattern:*')
    })

    it('應該避免重複失效相同的模式', async () => {
      mockRedis.delPattern.mockResolvedValue(1)

      await invalidator.invalidatePattern('test:pattern')
      await invalidator.invalidatePattern('test:pattern')

      expect(mockRedis.delPattern).toHaveBeenCalledTimes(1)
    })
  })

  describe('單個鍵失效', () => {
    it('應該正確失效指定的鍵', async () => {
      mockRedis.del.mockResolvedValue(1)

      await invalidator.invalidateKey('specific:key')

      expect(mockRedis.del).toHaveBeenCalledWith('specific:key')
    })

    it('應該避免重複失效相同的鍵', async () => {
      mockRedis.del.mockResolvedValue(1)

      await invalidator.invalidateKey('specific:key')
      await invalidator.invalidateKey('specific:key')

      expect(mockRedis.del).toHaveBeenCalledTimes(1)
    })
  })
})
