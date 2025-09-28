import Queue from 'bull'
import mongoose from 'mongoose'
import Meme from '../models/Meme.js'
import { calculateMemeHotScore } from '../utils/hotScore.js'
import { logger } from '../utils/logger.js'

class HotScoreQueueService {
  constructor() {
    this.queue = null
    this.isInitialized = false
  }

  async initialize() {
    if (this.isInitialized) return

    try {
      const redisConfig = {
        host:
          process.env.REDIS_HOST || (process.env.NODE_ENV === 'production' ? 'redis' : 'localhost'),
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
      }

      if (process.env.REDIS_URL) {
        redisConfig.url = process.env.REDIS_URL
      }

      this.queue = new Queue('hot-score', {
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
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 50,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
        },
        settings: {
          lockDuration: 30000,
          stalledInterval: 30000,
          maxStalledCount: 2,
        },
      })

      this.queue.on('completed', (job) => {
        logger.info('Hot score 重試完成', {
          jobId: job.id,
          memeId: job.data.memeId,
          event: 'hot_score_retry_completed',
        })
      })

      this.queue.on('failed', (job, err) => {
        logger.warn('Hot score 重試失敗', {
          jobId: job?.id,
          memeId: job?.data?.memeId,
          error: err?.message,
          name: err?.name,
          event: 'hot_score_retry_failed',
        })
      })

      this.queue.process('retry', async (job) => {
        const { memeId } = job.data

        if (!mongoose.Types.ObjectId.isValid(memeId)) {
          throw new Error('無效的 memeId')
        }

        const meme = await Meme.findById(memeId)
        if (!meme) {
          throw new Error('找不到迷因')
        }

        const hotScore = await calculateMemeHotScore(meme)
        if (typeof hotScore !== 'number' || isNaN(hotScore)) {
          throw new Error('計算熱門分數失敗')
        }

        meme.hot_score = hotScore
        await meme.save()

        return { success: true, memeId, hotScore }
      })

      this.isInitialized = true
      logger.info('Hot score 佇列初始化成功')
    } catch (error) {
      logger.error('Hot score 佇列初始化失敗:', error)
      throw error
    }
  }

  async addRetry(memeId, meta = {}) {
    try {
      if (!this.isInitialized) await this.initialize()
      const job = await this.queue.add('retry', { memeId, ...meta }, { priority: 4 })
      logger.info('已加入 Hot score 重試佇列', {
        jobId: job.id,
        memeId,
        event: 'hot_score_retry_enqueued',
      })
      return job
    } catch (error) {
      logger.warn('加入 Hot score 重試佇列失敗（跳過）：', {
        memeId,
        error: error.message,
        name: error.name,
      })
      return null
    }
  }

  async close() {
    if (this.queue) {
      await this.queue.close()
      this.isInitialized = false
      logger.info('Hot score 佇列已關閉')
    }
  }
}

const hotScoreQueue = new HotScoreQueueService()
export default hotScoreQueue
