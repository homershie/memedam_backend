/**
 * 快取整合測試
 * 測試 controllers 中快取功能的集成
 */

import { describe, it, expect } from 'vitest'
import smartCacheInvalidator, { CACHE_OPERATIONS } from '../../../utils/smartCacheInvalidator.js'

describe('Controller 快取整合測試', () => {
  describe('快取操作類型驗證', () => {
    it('應該包含所有 controller 中使用的快取操作類型', () => {
      // 驗證所有必要的操作類型都存在
      expect(CACHE_OPERATIONS.SOCIAL_RELATIONSHIP).toBe('SOCIAL_RELATIONSHIP')
      expect(CACHE_OPERATIONS.COLLABORATIVE_UPDATE).toBe('COLLABORATIVE_UPDATE')
      expect(CACHE_OPERATIONS.SOCIAL_COLLABORATIVE_UPDATE).toBe('SOCIAL_COLLABORATIVE_UPDATE')
      expect(CACHE_OPERATIONS.CONTENT_INTERACTION).toBe('CONTENT_INTERACTION')
      expect(CACHE_OPERATIONS.HOT_SCORE_UPDATE).toBe('HOT_SCORE_UPDATE')
      expect(CACHE_OPERATIONS.POPULAR_CONTENT).toBe('POPULAR_CONTENT')
      expect(CACHE_OPERATIONS.USER_ACTIVITY).toBe('USER_ACTIVITY')
    })

    it('應該能夠處理所有支持的操作類型而不拋出錯誤', async () => {
      const operations = [
        CACHE_OPERATIONS.SOCIAL_RELATIONSHIP,
        CACHE_OPERATIONS.COLLABORATIVE_UPDATE,
        CACHE_OPERATIONS.SOCIAL_COLLABORATIVE_UPDATE,
        CACHE_OPERATIONS.CONTENT_INTERACTION,
        CACHE_OPERATIONS.HOT_SCORE_UPDATE,
        CACHE_OPERATIONS.POPULAR_CONTENT,
        CACHE_OPERATIONS.USER_ACTIVITY,
      ]

      // 測試每個操作類型都能被處理而不拋出錯誤
      for (const operation of operations) {
        await expect(
          smartCacheInvalidator.invalidateByOperation(operation, {
            userId: 'testUser',
            reason: '測試操作',
          }),
        ).resolves.not.toThrow()
      }
    })
  })

  describe('Controller 快取操作模擬', () => {
    it('應該能夠模擬 followController 的快取失效操作', async () => {
      // 模擬 followController 中的快取失效調用
      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.SOCIAL_RELATIONSHIP, {
          userId: 'follower123',
          targetUserId: 'followed456',
          reason: '用戶追隨行為影響社交推薦',
        }),
      ).resolves.not.toThrow()

      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.COLLABORATIVE_UPDATE, {
          userId: 'follower123',
          reason: '追隨行為影響協同過濾推薦',
        }),
      ).resolves.not.toThrow()

      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.SOCIAL_COLLABORATIVE_UPDATE, {
          userId: 'follower123',
          reason: '社交關係變化影響社交協同過濾',
        }),
      ).resolves.not.toThrow()
    })

    it('應該能夠模擬 shareController 的快取失效操作', async () => {
      // 模擬 shareController 中的快取失效調用
      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.CONTENT_INTERACTION, {
          userId: 'user123',
          memeId: 'meme456',
          reason: '用戶分享行為',
        }),
      ).resolves.not.toThrow()

      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.COLLABORATIVE_UPDATE, {
          userId: 'user123',
          memeId: 'meme456',
          reason: '用戶分享影響協同過濾',
        }),
      ).resolves.not.toThrow()

      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.HOT_SCORE_UPDATE, {
          memeId: 'meme456',
          reason: '分享行為大幅提升熱門分數',
        }),
      ).resolves.not.toThrow()
    })

    it('應該能夠模擬 viewController 的快取失效操作', async () => {
      // 模擬 viewController 中的快取失效調用
      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.USER_ACTIVITY, {
          userId: 'user123',
          memeId: 'meme456',
          reason: '用戶瀏覽行為',
        }),
      ).resolves.not.toThrow()

      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.POPULAR_CONTENT, {
          memeId: 'meme456',
          reason: '迷因瀏覽數更新',
        }),
      ).resolves.not.toThrow()

      await expect(
        smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.HOT_SCORE_UPDATE, {
          memeId: 'meme456',
          reason: '熱門分數受瀏覽影響',
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('快取失效策略驗證', () => {
    it('應該根據不同操作類型執行不同的失效策略', async () => {
      // 重置失效追蹤器
      smartCacheInvalidator.reset()

      // 測試社交關係操作的失效策略
      await smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.SOCIAL_RELATIONSHIP, {
        userId: 'user123',
        targetUserId: 'user456',
        reason: '測試',
      })

      let stats = smartCacheInvalidator.getInvalidationStats()
      expect(stats.invalidatedKeysCount).toBeGreaterThan(0)

      // 重置並測試內容互動操作的失效策略
      smartCacheInvalidator.reset()

      await smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.CONTENT_INTERACTION, {
        userId: 'user123',
        memeId: 'meme456',
        reason: '測試',
      })

      stats = smartCacheInvalidator.getInvalidationStats()
      expect(stats.invalidatedKeysCount).toBeGreaterThan(0)

      // 重置並測試熱門分數更新操作的失效策略
      smartCacheInvalidator.reset()

      await smartCacheInvalidator.invalidateByOperation(CACHE_OPERATIONS.HOT_SCORE_UPDATE, {
        memeId: 'meme456',
        reason: '測試',
      })

      stats = smartCacheInvalidator.getInvalidationStats()
      expect(stats.invalidatedKeysCount).toBeGreaterThan(0)
    })
  })
})
