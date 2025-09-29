import Queue from 'bull'
import mongoose from 'mongoose'
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
        redisClient = new Redis({
          ...redisConfig,
          lazyConnect: true,
          showFriendlyErrorStack: true,
          retryDelayOnFailover: 100,
          retryDelayOnClusterDown: 300,
          enableOfflineQueue: true,
          maxRetriesPerRequest: 3, // 與主 Redis 配置保持一致
          connectTimeout: 5000,
          commandTimeout: 5000,
        })
      }

      // 建立通知隊列
      // 若提供 REDIS_URL，使用 ioredis 連線字串，避免 Bull 對 host/port 物件的解析歧義
      const bullRedisOptions = redisClient
        ? { client: redisClient }
        : redisConfig.url
          ? {
              redis: redisConfig.url,
            }
          : {
              redis: {
                ...redisConfig,
                lazyConnect: true,
                showFriendlyErrorStack: process.env.NODE_ENV === 'development',
                retryDelayOnFailover: 100,
                retryDelayOnClusterDown: 300,
                enableOfflineQueue: true,
                maxRetriesPerRequest: 3,
                connectTimeout: 5000,
                commandTimeout: 5000,
              },
            }

      this.queue = new Queue('notifications', {
        ...bullRedisOptions,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 20,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
        settings: {
          lockDuration: 30000,
          stalledInterval: 30000,
          maxStalledCount: 2,
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
      // 僅在非預期錯誤時升級為 error，常見重連類型降級為 warn 以避免日誌泛濫
      const msg = (error && (error.message || error.toString())) || 'unknown error'
      const isTransient =
        msg.includes('ECONNREFUSED') ||
        msg.includes('Connection is closed') ||
        msg.includes('Redis connection lost') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('Timeout') ||
        msg.includes('getaddrinfo ENOTFOUND')

      if (isTransient) {
        logger.warn(`通知隊列連線暫時性問題 (自動重試中): ${msg}`)
      } else {
        logger.error('通知隊列錯誤:', {
          message: msg,
          stack: error?.stack,
        })
      }
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

    // 添加連線恢復事件
    this.queue.on('stalled', (jobId) => {
      logger.warn(`通知工作 ${jobId} 停滯，可能需要重新處理`)
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

      if (!result) {
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
    try {
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
    } catch (error) {
      logger.error(`添加追蹤通知到隊列失敗`, {
        error: error.message,
        followedUserId,
        followerUserId,
        event: 'follow_notification_queue_error',
      })

      // 如果是連線問題，嘗試重新連線
      if (
        error.message.includes('Connection') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('MaxRetriesPerRequestError')
      ) {
        try {
          logger.info('嘗試重新連線通知隊列...')
          await this.reconnect()
          // 重新嘗試添加通知
          const retryJob = await this.queue.add(
            'follow',
            {
              followedUserId,
              followerUserId,
            },
            {
              priority: 4,
            },
          )
          logger.info(`重新連線後成功添加追蹤通知`, {
            jobId: retryJob.id,
            followedUserId,
            followerUserId,
            event: 'follow_notification_queued_retry',
          })
          return retryJob
        } catch (retryError) {
          logger.error(`重新連線後仍無法添加追蹤通知`, {
            error: retryError.message,
            followedUserId,
            followerUserId,
            event: 'follow_notification_queue_retry_failed',
          })
          throw retryError
        }
      }

      throw error
    }
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
   * 檢查隊列健康狀態
   */
  async checkHealth() {
    try {
      if (!this.isInitialized) {
        return { healthy: false, message: '隊列未初始化' }
      }

      const stats = await this.getStats()
      if (!stats) {
        return { healthy: false, message: '無法取得隊列統計' }
      }

      // 檢查是否有過多的失敗工作
      const failureRate = stats.failed / (stats.completed + stats.failed + 1) // +1 避免除零
      if (failureRate > 0.5) {
        return { healthy: false, message: `失敗率過高: ${(failureRate * 100).toFixed(1)}%` }
      }

      return {
        healthy: true,
        message: '隊列運行正常',
        stats,
      }
    } catch (error) {
      logger.error('檢查隊列健康狀態失敗:', error)
      return { healthy: false, message: `健康檢查失敗: ${error.message}` }
    }
  }

  /**
   * 重新連接隊列
   */
  async reconnect() {
    if (this.isInitialized) {
      try {
        logger.info('開始重新連接通知隊列...')
        await this.close()

        // 等待一小段時間再重新初始化
        await new Promise((resolve) => setTimeout(resolve, 1000))

        await this.initialize()
        logger.info('通知隊列重新連接成功')

        // 驗證重新連接是否成功
        const health = await this.checkHealth()
        if (!health.healthy) {
          logger.warn('重新連接後隊列健康檢查失敗:', health.message)
        }

        return health
      } catch (error) {
        logger.error('通知隊列重新連接失敗:', error)
        this.isInitialized = false
        throw error
      }
    } else {
      // 如果未初始化，直接初始化
      return await this.initialize()
    }
  }

  /**
   * 添加一般通知到隊列
   * @param {string} userId - 用戶ID
   * @param {Object} notificationData - 通知資料
   */
  async addNotification(userId, notificationData) {
    if (!this.isInitialized) await this.initialize()

    try {
      // 直接創建通知記錄，不使用隊列（因為這是即時通知）
      const Notification = (await import('../models/Notification.js')).default
      const NotificationReceipt = (await import('../models/NotificationReceipt.js')).default

      logger.debug('準備創建通知', {
        userId,
        userIdType: typeof userId,
        userIdValid: mongoose.Types.ObjectId.isValid(userId),
        notificationData: {
          verb: notificationData.verb,
          object_type: notificationData.object_type,
          title: notificationData.title,
          hasData: !!notificationData.data,
          object_id: notificationData.object_id,
          object_idValid: mongoose.Types.ObjectId.isValid(
            notificationData.object_id || notificationData.data?.sponsor_id || userId,
          ),
        },
      })

      // 創建通知事件
      const notification = new Notification({
        actor_id: userId, // 使用接收者作為觸發者（系統通知）
        verb: notificationData.verb || 'system', // 預設為系統通知
        object_type: notificationData.object_type || 'user', // 預設為用戶類型
        object_id: notificationData.object_id || notificationData.data?.sponsor_id || userId,
        payload: notificationData.data || {},
        title: notificationData.title,
        content: notificationData.message,
        url: notificationData.url || '', // 空字串是允許的
        action_text: notificationData.action_text || '查看',
        expire_at: notificationData.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天後過期
      })

      await notification.save()

      // 創建通知收據
      const receipt = new NotificationReceipt({
        notification_id: notification._id,
        user_id: userId,
        read_at: null,
        deleted_at: null,
        archived_at: null,
      })

      await receipt.save()

      logger.info(`通知已創建`, {
        notificationId: notification._id,
        receiptId: receipt._id,
        userId,
        verb: notification.verb,
        event: 'notification_created',
      })

      return { notification, receipt }
    } catch (error) {
      logger.error('創建通知失敗:', {
        error: error.message,
        stack: error.stack,
        userId,
        notificationData: {
          verb: notificationData.verb,
          object_type: notificationData.object_type,
          title: notificationData.title,
        },
      })
      throw error
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
