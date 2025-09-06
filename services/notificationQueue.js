import Queue from 'bull'
import { logger } from '../utils/logger.js'
import {
  createNewLikeNotification,
  createNewCommentNotification,
  createNewFollowerNotification,
  createMentionNotifications,
  createBulkNotificationEvent,
} from './notificationService.js'

// 在測試環境中使用 ioredis-mock
let Redis
if (process.env.NODE_ENV === 'test') {
  Redis = (await import('ioredis-mock')).default
} else {
  Redis = (await import('ioredis')).default
}

/**
 * 通知隊列服務
 * 負責管理通知的異步處理和重試機制
 */
class NotificationQueueService {
  constructor() {
    this.queue = null
    this.isInitialized = false
  }

  /**
   * 初始化通知隊列
   */
  async initialize() {
    if (this.isInitialized) return

    try {
      // 從環境變數取得 Redis 配置
      const redisConfig = {
        host:
          process.env.REDIS_HOST || (process.env.NODE_ENV === 'production' ? 'redis' : 'localhost'),
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
      }

      // 如果有 REDIS_URL，使用它
      if (process.env.REDIS_URL) {
        redisConfig.url = process.env.REDIS_URL
      }

      // 在測試環境中建立模擬 Redis 客戶端
      let redisClient = null
      if (process.env.NODE_ENV === 'test') {
        redisClient = new Redis(redisConfig)
      }

      // 建立通知隊列
      this.queue = new Queue('notifications', {
        redis: redisClient || redisConfig,
        defaultJobOptions: {
          removeOnComplete: 50, // 保留最近50個完成的工作
          removeOnFail: 20, // 保留最近20個失敗的工作
          attempts: 3, // 最多重試3次
          backoff: {
            type: 'exponential', // 指數退避
            delay: 5000, // 初始延遲5秒
          },
        },
      })

      // 設定事件監聽器
      this.setupEventListeners()

      // 設定處理器
      await this.setupProcessors()

      this.isInitialized = true
      logger.info('通知隊列服務初始化成功')
    } catch (error) {
      logger.error('通知隊列服務初始化失敗:', error)
      throw error
    }
  }

  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    if (!this.queue) return

    this.queue.on('ready', () => {
      logger.info('通知隊列已準備就緒')
    })

    this.queue.on('error', (error) => {
      logger.error('通知隊列錯誤:', error)
    })

    this.queue.on('waiting', (jobId) => {
      logger.debug(`通知工作 ${jobId} 正在等待處理`)
    })

    this.queue.on('active', (job) => {
      logger.debug(`通知工作 ${job.id} 開始處理: ${job.data.type}`)
    })

    this.queue.on('completed', (job, result) => {
      logger.info(`通知工作 ${job.id} 處理完成: ${job.data.type}`, {
        jobId: job.id,
        type: job.data.type,
        result: result,
        event: 'notification_job_completed',
      })
    })

    this.queue.on('failed', (job, err) => {
      logger.error(`通知工作 ${job.id} 處理失敗: ${job.data.type}`, {
        jobId: job.id,
        type: job.data.type,
        error: err.message,
        attemptsMade: job.attemptsMade,
        attemptsRemaining: job.opts.attempts - job.attemptsMade,
        event: 'notification_job_failed',
      })
    })
  }

  /**
   * 設定工作處理器
   */
  async setupProcessors() {
    if (!this.queue) return

    // 處理新讚通知
    this.queue.process('like', async (job) => {
      const { memeId, likerUserId } = job.data
      logger.info(`處理讚通知工作: ${job.id}`, {
        memeId,
        likerUserId,
        event: 'processing_like_notification',
      })

      const result = await createNewLikeNotification(memeId, likerUserId)

      if (!result.success) {
        throw new Error(result.error || '建立讚通知失敗')
      }

      return result
    })

    // 處理新評論通知
    this.queue.process('comment', async (job) => {
      const { memeId, commentUserId, commentContent } = job.data
      logger.info(`處理評論通知工作: ${job.id}`, {
        memeId,
        commentUserId,
        event: 'processing_comment_notification',
      })

      const result = await createNewCommentNotification(memeId, commentUserId, commentContent)

      if (!result || !result.success) {
        throw new Error('建立評論通知失敗')
      }

      return result
    })

    // 處理新追蹤者通知
    this.queue.process('follow', async (job) => {
      const { followedUserId, followerUserId } = job.data
      logger.info(`處理追蹤通知工作: ${job.id}`, {
        followedUserId,
        followerUserId,
        event: 'processing_follow_notification',
      })

      const result = await createNewFollowerNotification(followedUserId, followerUserId)

      if (!result || !result.success) {
        throw new Error('建立追蹤通知失敗')
      }

      return result
    })

    // 處理提及通知
    this.queue.process('mention', async (job) => {
      const { content, mentionerUserId, memeId, contextType } = job.data
      logger.info(`處理提及通知工作: ${job.id}`, {
        mentionerUserId,
        memeId,
        contextType,
        event: 'processing_mention_notification',
      })

      await createMentionNotifications(content, mentionerUserId, memeId, contextType)
      return { success: true }
    })

    // 處理批量通知
    this.queue.process('bulk', async (job) => {
      const { eventData, userIds, options } = job.data
      logger.info(`處理批量通知工作: ${job.id}`, {
        userCount: userIds.length,
        event: 'processing_bulk_notification',
      })

      const result = await createBulkNotificationEvent(eventData, userIds, options)

      if (!result.success) {
        throw new Error(result.error || '批量通知處理失敗')
      }

      return result
    })

    logger.info('通知隊列處理器設定完成')
  }

  /**
   * 添加讚通知到隊列
   * @param {string} memeId - 迷因ID
   * @param {string} likerUserId - 按讚者ID
   * @param {Object} options - 選項
   */
  async addLikeNotification(memeId, likerUserId, options = {}) {
    if (!this.isInitialized) await this.initialize()

    const job = await this.queue.add(
      'like',
      {
        memeId,
        likerUserId,
        ...options,
      },
      {
        priority: 5, // 高優先級
        delay: options.delay || 0,
      },
    )

    logger.info(`讚通知已加入隊列`, {
      jobId: job.id,
      memeId,
      likerUserId,
      event: 'like_notification_queued',
    })

    return job
  }

  /**
   * 添加評論通知到隊列
   * @param {string} memeId - 迷因ID
   * @param {string} commentUserId - 評論者ID
   * @param {string} commentContent - 評論內容
   */
  async addCommentNotification(memeId, commentUserId, commentContent) {
    if (!this.isInitialized) await this.initialize()

    const job = await this.queue.add(
      'comment',
      {
        memeId,
        commentUserId,
        commentContent,
      },
      {
        priority: 5, // 高優先級
      },
    )

    logger.info(`評論通知已加入隊列`, {
      jobId: job.id,
      memeId,
      commentUserId,
      event: 'comment_notification_queued',
    })

    return job
  }

  /**
   * 添加追蹤通知到隊列
   * @param {string} followedUserId - 被追蹤者ID
   * @param {string} followerUserId - 追蹤者ID
   */
  async addFollowNotification(followedUserId, followerUserId) {
    if (!this.isInitialized) await this.initialize()

    const job = await this.queue.add(
      'follow',
      {
        followedUserId,
        followerUserId,
      },
      {
        priority: 4, // 中等優先級
      },
    )

    logger.info(`追蹤通知已加入隊列`, {
      jobId: job.id,
      followedUserId,
      followerUserId,
      event: 'follow_notification_queued',
    })

    return job
  }

  /**
   * 添加提及通知到隊列
   * @param {string} content - 內容
   * @param {string} mentionerUserId - 提及者ID
   * @param {string} memeId - 迷因ID（可選）
   * @param {string} contextType - 上下文類型
   */
  async addMentionNotification(content, mentionerUserId, memeId = null, contextType = 'comment') {
    if (!this.isInitialized) await this.initialize()

    const job = await this.queue.add(
      'mention',
      {
        content,
        mentionerUserId,
        memeId,
        contextType,
      },
      {
        priority: 3, // 較低優先級
      },
    )

    logger.info(`提及通知已加入隊列`, {
      jobId: job.id,
      mentionerUserId,
      contextType,
      event: 'mention_notification_queued',
    })

    return job
  }

  /**
   * 添加批量通知到隊列
   * @param {Object} eventData - 通知事件資料
   * @param {string[]} userIds - 用戶ID陣列
   * @param {Object} options - 選項
   */
  async addBulkNotification(eventData, userIds, options = {}) {
    if (!this.isInitialized) await this.initialize()

    const job = await this.queue.add(
      'bulk',
      {
        eventData,
        userIds,
        options,
      },
      {
        priority: 2, // 低優先級，但批量處理
      },
    )

    logger.info(`批量通知已加入隊列`, {
      jobId: job.id,
      userCount: userIds.length,
      event: 'bulk_notification_queued',
    })

    return job
  }

  /**
   * 取得隊列統計資訊
   */
  async getStats() {
    if (!this.isInitialized) return null

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ])

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      }
    } catch (error) {
      logger.error('取得隊列統計失敗:', error)
      return null
    }
  }

  /**
   * 清空隊列
   * @param {string} state - 要清空的狀態（waiting, active, completed, failed）
   */
  async empty(state = 'waiting') {
    if (!this.isInitialized) return

    try {
      await this.queue.empty()
      logger.info(`通知隊列已清空: ${state}`)
    } catch (error) {
      logger.error('清空隊列失敗:', error)
    }
  }

  /**
   * 關閉隊列
   */
  async close() {
    if (this.queue) {
      await this.queue.close()
      this.isInitialized = false
      logger.info('通知隊列已關閉')
    }
  }
}

// 創建單例實例
const notificationQueue = new NotificationQueueService()

export default notificationQueue
