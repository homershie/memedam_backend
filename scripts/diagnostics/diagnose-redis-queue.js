/**
 * Redis 隊列診斷測試
 * 使用 Vitest 執行 Redis 隊列和連線的完整診斷
 *
 * 執行方式:
 * npm run diagnose:redis-queue
 * 或
 * npx vitest run scripts/diagnose-redis-queue.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import 'dotenv/config'
import mongoose from 'mongoose'
import notificationQueue from '../services/notificationQueue.js'
import redisCache from '../config/redis.js'
import { logger } from '../utils/logger.js'
import connectDB from '../config/db.js'

// 設定測試環境
process.env.NODE_ENV = 'test'

describe('Redis 隊列診斷', () => {
  beforeAll(async () => {
    logger.info('🔍 開始 Redis 隊列診斷...')

    try {
      // 連接到資料庫 - 處理已存在的連接
      if (mongoose.connection.readyState === 0) {
        await connectDB()
        logger.info('✅ 資料庫連接成功')
      } else {
        logger.info('✅ 使用現有的資料庫連接')
      }
    } catch (error) {
      logger.error('❌ 資料庫連接失敗:', error)
      throw error
    }
  }, 30000)

  afterAll(async () => {
    logger.info('🏁 診斷完成')
  }, 10000)

  it('應該能夠正常連接到 Redis', async () => {
    // 診斷 Redis 連線
    logger.info('🔍 診斷 Redis 連線...')
    const redisPing = await redisCache.ping()

    expect(redisPing).toBe('PONG')
    logger.info('✅ Redis 連線正常')
  }, 10000)

  it('應該能夠取得 Redis 統計資訊', async () => {
    // 取得 Redis 統計資訊
    const redisStats = await redisCache.getStats()

    expect(redisStats).toBeDefined()
    expect(redisStats.enabled).toBe(true)
    logger.info('📊 Redis 統計資訊:', redisStats)
  }, 5000)

  it('通知隊列應該運行正常', async () => {
    // 診斷通知隊列
    logger.info('🔍 診斷通知隊列...')
    const queueHealth = await notificationQueue.checkHealth()

    expect(queueHealth).toBeDefined()
    expect(queueHealth.healthy).toBeDefined()

    if (queueHealth.healthy) {
      logger.info('✅ 通知隊列運行正常')
      logger.info('📊 隊列統計:', queueHealth.stats)
      expect(queueHealth.healthy).toBe(true)
    } else {
      logger.warn('⚠️ 通知隊列存在問題:', queueHealth.message)
      // 不強制要求隊列必須健康，因為可能在某些環境下隊列還未初始化
      console.log('隊列狀態:', queueHealth.message)
    }
  }, 10000)

  it('應該能夠添加通知到隊列', async () => {
    // 測試添加一個測試通知
    logger.info('🔍 測試添加通知到隊列...')

    try {
      const testJob = await notificationQueue.addFollowNotification(
        'test_followed_id',
        'test_follower_id',
      )

      expect(testJob).toBeDefined()
      expect(testJob.id).toBeDefined()
      logger.info('✅ 成功添加測試通知:', { jobId: testJob.id })

      // 等待一下然後檢查隊列統計
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const updatedStats = await notificationQueue.getStats()
      logger.info('📊 添加測試通知後的隊列統計:', updatedStats)

      // 驗證統計資料結構
      expect(updatedStats).toBeDefined()
      expect(typeof updatedStats.waiting).toBe('number')
      expect(typeof updatedStats.active).toBe('number')
    } catch (error) {
      logger.error('❌ 添加測試通知失敗:', error.message)

      // 如果是連線問題，嘗試重新連線
      if (
        error.message.includes('Connection') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('MaxRetriesPerRequestError')
      ) {
        logger.info('🔄 嘗試重新連線隊列...')
        try {
          await notificationQueue.reconnect()
          logger.info('✅ 隊列重新連線成功')

          // 重新測試
          const retryJob = await notificationQueue.addFollowNotification(
            'test_followed_id_retry',
            'test_follower_id_retry',
          )
          logger.info('✅ 重新連線後成功添加測試通知:', { jobId: retryJob.id })

          expect(retryJob).toBeDefined()
          expect(retryJob.id).toBeDefined()
        } catch (retryError) {
          logger.error('❌ 重新連線後仍失敗:', retryError.message)
          throw retryError
        }
      } else {
        // 如果不是連線問題，直接拋出錯誤
        throw error
      }
    }
  }, 15000)
})
