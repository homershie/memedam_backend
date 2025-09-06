import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import mongoose from 'mongoose'
import notificationQueue from '../../../services/notificationQueue.js'
import {
  createBulkNotificationEvent,
  createEfficientBulkNotification,
} from '../../../services/notificationService.js'
import { logger } from '../../../utils/logger.js'

describe('通知隊列系統整合測試', () => {
  vi.setConfig({ testTimeout: 30000 }) // 30 秒超時
  beforeAll(async () => {
    // 設定測試環境變數
    process.env.NODE_ENV = 'test'

    // 確保資料庫連線
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam_test')
    }
  })

  afterAll(async () => {
    // 清理資源
    await notificationQueue.close()
  })

  beforeEach(async () => {
    // 每個測試前初始化隊列
    await notificationQueue.initialize()
  })

  afterEach(async () => {
    // 每個測試後清空隊列
    await notificationQueue.empty()
  })

  describe('通知隊列基本功能', () => {
    it('應該能夠初始化通知隊列', async () => {
      expect(notificationQueue).toBeDefined()
      expect(notificationQueue.isInitialized).toBe(true)
    })

    it('應該能夠獲取隊列統計資訊', async () => {
      const stats = await notificationQueue.getStats()
      expect(stats).toBeDefined()
      expect(stats).toHaveProperty('waiting')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('delayed')
    })

    it('應該能夠清空隊列', async () => {
      await notificationQueue.empty()
      const stats = await notificationQueue.getStats()
      expect(stats.waiting).toBe(0)
    })
  })

  describe('通知隊列操作', () => {
    it('應該能夠加入讚通知到隊列', async () => {
      const job = await notificationQueue.addLikeNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
      expect(typeof job.id).toBe('string')
    })

    it('應該能夠加入評論通知到隊列', async () => {
      if (!notificationQueue.isInitialized) {
        console.warn('Redis 不可用，跳過此測試')
        return
      }

      const job = await notificationQueue.addCommentNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '這是一個測試評論',
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })

    it('應該能夠加入追蹤通知到隊列', async () => {
      if (!notificationQueue.isInitialized) {
        console.warn('Redis 不可用，跳過此測試')
        return
      }

      const job = await notificationQueue.addFollowNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })

    it('應該能夠加入提及通知到隊列', async () => {
      if (!notificationQueue.isInitialized) {
        console.warn('Redis 不可用，跳過此測試')
        return
      }

      const job = await notificationQueue.addMentionNotification(
        '@testuser 這是一個提及測試',
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        'comment',
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })

    it('應該能夠加入批量通知到隊列', async () => {
      if (!notificationQueue.isInitialized) {
        console.warn('Redis 不可用，跳過此測試')
        return
      }

      const job = await notificationQueue.addBulkNotification(
        {
          actor_id: new mongoose.Types.ObjectId(),
          verb: 'system',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '測試公告',
          content: '這是一個測試通知',
          url: 'https://example.com/test',
        },
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })
  })

  describe('批量通知處理', () => {
    it('應該能夠建立批量通知事件', async () => {
      const result = await createBulkNotificationEvent(
        {
          actor_id: new mongoose.Types.ObjectId(),
          verb: 'system',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '測試公告',
          content: '這是一個測試通知',
          url: 'https://example.com/test',
        },
        ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        {
          notificationType: 'new_like',
        },
      )

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.receiptCount).toBeGreaterThanOrEqual(0)
    })

    it('應該能夠處理高效批量通知', async () => {
      const result = await createEfficientBulkNotification(
        {
          actor_id: new mongoose.Types.ObjectId(),
          verb: 'system',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '高效批量測試公告',
          content: '測試高效批量通知處理',
          url: 'https://example.com/test-efficient',
        },
        {
          userIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
          notificationType: 'new_like',
          batchSize: 100,
        },
      )

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.receiptCount).toBeGreaterThanOrEqual(0)
    })

    it('應該在沒有用戶時正確處理', async () => {
      const result = await createBulkNotificationEvent(
        {
          actor_id: new mongoose.Types.ObjectId(),
          verb: 'system',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '空用戶測試公告',
          content: '測試空用戶情況',
          url: '/test-empty',
        },
        [],
        {
          notificationType: 'new_like',
        },
      )

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.receiptCount).toBe(0)
    })
  })

  describe('錯誤處理', () => {
    it('應該在隊列未初始化時正確處理', async () => {
      // 關閉隊列
      await notificationQueue.close()

      // 嘗試添加通知應該會自動初始化
      const job = await notificationQueue.addLikeNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      expect(job).toBeDefined()
      expect(job.id).toBeDefined()
    })

    it('應該處理無效的用戶ID', async () => {
      // 測試應該拋出錯誤，因為無效的用戶ID無法轉換為 ObjectId
      await expect(
        createBulkNotificationEvent(
          {
            actor_id: new mongoose.Types.ObjectId(),
            verb: 'system',
            object_type: 'meme',
            object_id: new mongoose.Types.ObjectId(),
            title: '無效用戶測試',
            content: '測試無效用戶ID',
            url: 'https://example.com/test-invalid',
          },
          ['invalid_user_id'],
          {
            notificationType: 'new_like',
          },
        ),
      ).rejects.toThrow(/Cast to ObjectId failed/)
    })
  })

  describe('優先級處理', () => {
    it('應該正確設定不同優先級', async () => {
      const likeJob = await notificationQueue.addLikeNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      const followJob = await notificationQueue.addFollowNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      const bulkJob = await notificationQueue.addBulkNotification(
        {
          actor_id: new mongoose.Types.ObjectId(),
          verb: 'system',
          object_type: 'meme',
          object_id: new mongoose.Types.ObjectId(),
          title: '批量測試',
          content: '測試批量通知',
          url: '/test-bulk',
        },
        ['507f1f77bcf86cd799439011'],
      )

      expect(likeJob.opts.priority).toBe(5) // 高優先級
      expect(followJob.opts.priority).toBe(4) // 中等優先級
      expect(bulkJob.opts.priority).toBe(2) // 低優先級
    })
  })

  describe('統計和監控', () => {
    it('應該能夠追蹤隊列統計', async () => {
      // 添加一些工作
      await notificationQueue.addLikeNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      await notificationQueue.addCommentNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '測試評論',
      )

      const stats = await notificationQueue.getStats()

      expect(stats).toBeDefined()
      expect(stats.waiting).toBeGreaterThanOrEqual(0)
      expect(stats.active).toBeGreaterThanOrEqual(0)
      expect(typeof stats.waiting).toBe('number')
      expect(typeof stats.active).toBe('number')
    })

    it('應該記錄操作日誌', async () => {
      const consoleSpy = vi.spyOn(logger, 'info')

      await notificationQueue.addLikeNotification(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('讚通知已加入隊列'),
        expect.objectContaining({
          event: 'like_notification_queued',
        }),
      )

      consoleSpy.mockRestore()
    })
  })
})
