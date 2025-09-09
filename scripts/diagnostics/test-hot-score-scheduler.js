#!/usr/bin/env node

/**
 * 熱門分數排程器診斷腳本
 * 用於手動測試熱門分數更新功能、檢查排程任務狀態、驗證資料庫更新
 */

// 設定基本環境變數用於診斷
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.REDIS_ENABLED = 'true'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.REDIS_DB = '1'
process.env.REDIS_URL = 'redis://localhost:6379'

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Meme from '../../models/Meme.js'
import User from '../../models/User.js'
import { batchUpdateHotScores, getHotScoreStats } from '../../utils/hotScoreScheduler.js'
import {
  updateHotScores,
  startRecommendationScheduler,
  stopRecommendationScheduler,
  getRecommendationSystemStatus,
} from '../../services/recommendationScheduler.js'
import { calculateMemeHotScore, getHotScoreLevel } from '../../utils/hotScore.js'
// import { logger } from '../../utils/logger.js' // 診斷腳本使用console.log，不需要logger
import redisCache from '../../config/redis.js'
import cacheVersionManager from '../../utils/cacheVersionManager.js'

class HotScoreSchedulerDiagnostic {
  constructor() {
    this.mongoServer = null
    this.testUsers = []
    this.testMemes = []
    this.startTime = null
    this.endTime = null
  }

  /**
   * 初始化診斷環境
   */
  async initialize() {
    console.log('🔧 初始化熱門分數排程器診斷環境...')
    this.startTime = Date.now()

    try {
      // 啟動記憶體MongoDB
      this.mongoServer = await MongoMemoryServer.create()
      const mongoUri = this.mongoServer.getUri()

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      })

      console.log('✅ 記憶體MongoDB已啟動並連接')
    } catch (error) {
      console.error('❌ 初始化失敗:', error.message)
      throw error
    }
  }

  /**
   * 建立測試數據
   */
  async createTestData() {
    console.log('📝 建立測試數據...')

    try {
      // 建立測試用戶
      for (let i = 0; i < 20; i++) {
        const user = await User.create({
          username: `diag_user_${i}_${Date.now()}`,
          email: `diag_${i}_${Date.now()}@example.com`,
          password: 'testpassword123',
          role: 'user',
          status: 'active',
          email_verified: true,
        })
        this.testUsers.push(user)
      }

      // 建立測試迷因
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      for (let i = 0; i < 200; i++) {
        const createdAt = i < 50 ? now : i < 100 ? yesterday : weekAgo
        const meme = await Meme.create({
          title: `診斷測試迷因 ${i}`,
          type: 'image',
          content: `這是診斷測試迷因 ${i} 的內容`,
          image_url: `https://example.com/diag_test_${i}.jpg`,
          author_id: this.testUsers[i % this.testUsers.length]._id,
          status: 'public',
          like_count: Math.floor(Math.random() * 500) + 1,
          dislike_count: Math.floor(Math.random() * 50),
          view_count: Math.floor(Math.random() * 5000) + 100,
          comment_count: Math.floor(Math.random() * 200),
          collection_count: Math.floor(Math.random() * 100),
          share_count: Math.floor(Math.random() * 50),
          createdAt,
          modified_at:
            i % 5 === 0 ? new Date(createdAt.getTime() + Math.random() * 86400000) : createdAt,
        })
        this.testMemes.push(meme)
      }

      console.log(
        `✅ 建立 ${this.testUsers.length} 個測試用戶和 ${this.testMemes.length} 個測試迷因`,
      )
    } catch (error) {
      console.error('❌ 建立測試數據失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試單個迷因熱門分數計算
   */
  async testSingleMemeCalculation() {
    console.log('🧮 測試單個迷因熱門分數計算...')

    try {
      const testMeme = this.testMemes[0]
      console.log(`測試迷因: ${testMeme.title}`)
      console.log(
        `原始數據: 讚數=${testMeme.like_count}, 瀏覽數=${testMeme.view_count}, 留言數=${testMeme.comment_count}`,
      )

      const hotScore = await calculateMemeHotScore(testMeme)
      const hotLevel = getHotScoreLevel(hotScore)

      console.log(`計算結果: 熱門分數=${hotScore.toFixed(2)}, 等級=${hotLevel}`)

      // 驗證結果
      if (typeof hotScore !== 'number') {
        throw new Error(`熱門分數應為數字，但得到 ${typeof hotScore}`)
      }
      if (hotScore < 0) {
        throw new Error(`熱門分數應大於等於0，但得到 ${hotScore}`)
      }
      const validLevels = ['viral', 'trending', 'popular', 'active', 'normal', 'new']
      if (!validLevels.includes(hotLevel)) {
        throw new Error(`熱門等級應為 ${validLevels.join(', ')} 之一，但得到 ${hotLevel}`)
      }

      console.log('✅ 單個迷因計算測試通過')
      return { hotScore, hotLevel }
    } catch (error) {
      console.error('❌ 單個迷因計算測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試批次更新功能
   */
  async testBatchUpdate() {
    console.log('🔄 測試批次更新功能...')

    try {
      const startTime = Date.now()

      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 25,
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`批次更新結果:`)
      console.log(`- 成功更新: ${result.updated_count} 個`)
      console.log(`- 更新失敗: ${result.error_count} 個`)
      console.log(`- 處理時間: ${duration}ms`)
      console.log(`- 平均速度: ${Math.round(result.updated_count / (duration / 1000))} 個/秒`)

      // 驗證結果
      if (!result.success) {
        throw new Error('批次更新應成功，但失敗了')
      }
      if (result.updated_count <= 0) {
        throw new Error(`更新數量應大於0，但得到 ${result.updated_count}`)
      }
      if (result.updated_count > this.testMemes.length) {
        throw new Error(
          `更新數量應不大於測試迷因總數 ${this.testMemes.length}，但得到 ${result.updated_count}`,
        )
      }

      console.log('✅ 批次更新測試通過')
      return result
    } catch (error) {
      console.error('❌ 批次更新測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試排程任務啟動
   */
  async testSchedulerStartup() {
    console.log('🚀 測試排程任務啟動...')

    try {
      // 啟動排程器
      startRecommendationScheduler()

      // 等待一下讓任務初始化
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log('✅ 排程任務啟動成功')

      // 檢查系統狀態
      const status = await getRecommendationSystemStatus()
      console.log('系統狀態:')
      console.log(
        `- Hot Score: ${status.status.hotScore.enabled ? '啟用' : '停用'} (${status.status.hotScore.interval})`,
      )
      console.log(
        `- Content Based: ${status.status.contentBased.enabled ? '啟用' : '停用'} (${status.status.contentBased.interval})`,
      )
      console.log(
        `- Collaborative Filtering: ${status.status.collaborativeFiltering.enabled ? '啟用' : '停用'} (${status.status.collaborativeFiltering.interval})`,
      )

      return status
    } catch (error) {
      console.error('❌ 排程任務啟動測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試手動觸發更新
   */
  async testManualUpdate() {
    console.log('🎯 測試手動觸發更新...')

    try {
      const startTime = Date.now()

      const result = await updateHotScores({
        hotScore: {
          enabled: true,
          batchSize: 50,
          force: true,
        },
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`手動更新結果:`)
      console.log(`- 演算法: ${result.algorithm}`)
      console.log(`- 成功: ${result.success}`)
      console.log(`- 處理時間: ${result.processingTime}ms (${duration}ms 實際測量)`)
      console.log(`- 重試次數: ${result.retry_count}`)
      console.log(`- 更新數量: ${result.result.updated_count}`)

      // 驗證結果
      if (!result.success) {
        throw new Error('手動更新應成功，但失敗了')
      }
      if (result.algorithm !== 'hot_score') {
        throw new Error(`演算法應為 'hot_score'，但得到 '${result.algorithm}'`)
      }
      if (result.result.updated_count <= 0) {
        throw new Error(`更新數量應大於0，但得到 ${result.result.updated_count}`)
      }

      console.log('✅ 手動觸發更新測試通過')
      return result
    } catch (error) {
      console.error('❌ 手動觸發更新測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試資料庫更新驗證
   */
  async testDatabaseVerification() {
    console.log('💾 測試資料庫更新驗證...')

    try {
      // 取得更新後的迷因
      const updatedMemes = await Meme.find({}).sort({ hot_score: -1 }).limit(10)

      console.log('前10個最高熱門分數的迷因:')
      updatedMemes.forEach((meme, index) => {
        console.log(`${index + 1}. ${meme.title}: ${meme.hot_score?.toFixed(2) || 0} 分`)
      })

      // 統計熱門分數分布
      const stats = await getHotScoreStats()
      console.log('熱門分數統計:')
      console.log(`- 總迷因數: ${stats.data.overall.total_memes}`)
      console.log(`- 平均熱門分數: ${stats.data.overall.avg_hot_score?.toFixed(2) || 0}`)
      console.log(`- 最高熱門分數: ${stats.data.overall.max_hot_score?.toFixed(2) || 0}`)
      console.log(`- 最低熱門分數: ${stats.data.overall.min_hot_score?.toFixed(2) || 0}`)

      console.log('等級分布:')
      stats.data.by_level.forEach((level) => {
        console.log(`- ${level._id}: ${level.count} 個`)
      })

      // 驗證統計
      if (!stats.success) {
        throw new Error('統計查詢應成功，但失敗了')
      }
      if (stats.data.overall.total_memes <= 0) {
        throw new Error(`總迷因數應大於0，但得到 ${stats.data.overall.total_memes}`)
      }

      console.log('✅ 資料庫更新驗證測試通過')
      return stats
    } catch (error) {
      console.error('❌ 資料庫更新驗證測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試快取功能
   */
  async testCacheFunctionality() {
    console.log('🔄 測試快取功能...')

    try {
      // 檢查快取鍵 - 使用直接的 Redis client 方法
      let cacheKeys = []
      let sampleKey = null

      try {
        if (redisCache.client && redisCache.isConnected) {
          cacheKeys = await redisCache.client.keys('hot_score_batch:*')
          console.log(`找到 ${cacheKeys.length} 個批次快取鍵`)

          if (cacheKeys.length > 0) {
            // 測試快取讀取
            sampleKey = cacheKeys[0]
            const cachedData = await redisCache.get(sampleKey)

            if (cachedData) {
              console.log(
                `快取樣本 (${sampleKey}): ${JSON.stringify(cachedData).substring(0, 100)}...`,
              )
            }
          }
        } else {
          console.log('Redis 未連線，跳過快取鍵檢查')
        }
      } catch (error) {
        console.log('快取鍵檢查失敗:', error.message)
      }

      // 測試版本控制
      try {
        const version = await cacheVersionManager.getVersion('hot_score_batch:*')
        console.log(`快取版本: ${version}`)
      } catch (error) {
        console.log('版本控制檢查失敗:', error.message)
      }

      // 測試快取失效
      const invalidateResult = await cacheVersionManager.batchUpdateVersions(
        ['hot_score_batch:*'],
        'patch',
      )
      console.log(`快取版本更新結果: ${JSON.stringify(invalidateResult, null, 2)}`)

      console.log('✅ 快取功能測試通過')
      return { cacheKeys: cacheKeys.length, versionUpdated: true }
    } catch (error) {
      console.error('❌ 快取功能測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試效能基準
   */
  async testPerformanceBenchmark() {
    console.log('⚡ 測試效能基準...')

    try {
      const testSizes = [10, 50, 100, 200]

      for (const size of testSizes) {
        const startTime = Date.now()

        const result = await batchUpdateHotScores({
          limit: size,
          force: true,
          batchSize: 25,
        })

        const endTime = Date.now()
        const duration = endTime - startTime
        const throughput = Math.round(result.updated_count / (duration / 1000))

        console.log(`效能測試 (${size} 個迷因):`)
        console.log(`- 處理時間: ${duration}ms`)
        console.log(`- 吞吐量: ${throughput} 個/秒`)
        console.log(`- 記憶體使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`)
      }

      console.log('✅ 效能基準測試通過')
    } catch (error) {
      console.error('❌ 效能基準測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 測試錯誤處理
   */
  async testErrorHandling() {
    console.log('🛡️  測試錯誤處理...')

    try {
      // 測試無效的迷因ID
      const invalidResult = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 10,
      })

      console.log(
        `錯誤處理測試: 成功處理 ${invalidResult.updated_count} 個，錯誤 ${invalidResult.error_count} 個`,
      )

      // 測試系統狀態查詢
      const status = await getRecommendationSystemStatus()
      if (!status.success) {
        throw new Error('系統狀態查詢應成功，但失敗了')
      }

      console.log('✅ 錯誤處理測試通過')
      return invalidResult
    } catch (error) {
      console.error('❌ 錯誤處理測試失敗:', error.message)
      throw error
    }
  }

  /**
   * 清理測試環境
   */
  async cleanup() {
    console.log('🧹 清理測試環境...')

    try {
      // 停止排程器
      stopRecommendationScheduler()

      // 清理測試數據
      await Meme.deleteMany({ title: /^診斷測試迷因/ })
      await User.deleteMany({ username: /^diag_user_/ })

      // 清理快取
      try {
        await redisCache.delPattern('hot_score_batch:*')
        await redisCache.delPattern('meme_hot_score:*')
      } catch (error) {
        console.log('清理快取失敗:', error.message)
      }

      // 關閉資料庫連接
      await mongoose.disconnect()
      if (this.mongoServer) {
        await this.mongoServer.stop()
      }

      console.log('✅ 測試環境清理完成')
    } catch (error) {
      console.error('❌ 清理測試環境失敗:', error.message)
    }
  }

  /**
   * 產生診斷報告
   */
  generateReport(results) {
    this.endTime = Date.now()
    const totalDuration = this.endTime - this.startTime

    console.log('\n' + '='.repeat(60))
    console.log('📋 熱門分數排程器診斷報告')
    console.log('='.repeat(60))
    console.log(`總執行時間: ${totalDuration}ms`)
    console.log(`測試項目數: ${Object.keys(results).length}`)
    console.log('')

    Object.entries(results).forEach(([testName, result]) => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${testName}`)
      if (result.details) {
        console.log(`   ${result.details}`)
      }
    })

    console.log('')
    console.log('🔍 詳細結果:')

    if (results.singleMeme) {
      console.log(
        `- 單個迷因計算: 分數=${results.singleMeme.hotScore?.toFixed(2)}, 等級=${results.singleMeme.hotLevel}`,
      )
    }

    if (results.batchUpdate) {
      console.log(
        `- 批次更新: ${results.batchUpdate.updated_count} 成功, ${results.batchUpdate.error_count} 失敗`,
      )
    }

    if (results.manualUpdate) {
      console.log(`- 手動更新: 處理時間 ${results.manualUpdate.processingTime}ms`)
    }

    if (results.databaseVerification) {
      console.log(`- 資料庫統計: ${results.databaseVerification.data.overall.total_memes} 個迷因`)
    }

    if (results.cacheTest) {
      console.log(`- 快取測試: ${results.cacheTest.cacheKeys} 個快取鍵`)
    }

    console.log('='.repeat(60))
    console.log('🏁 診斷完成')
    console.log('='.repeat(60))
  }

  /**
   * 執行完整診斷
   */
  async runFullDiagnostic() {
    const results = {}

    try {
      // 初始化
      await this.initialize()
      results.initialization = { success: true }

      // 建立測試數據
      await this.createTestData()
      results.testDataCreation = { success: true }

      // 測試單個迷因計算
      results.singleMeme = await this.testSingleMemeCalculation()
      results.singleMeme.success = true

      // 測試批次更新
      results.batchUpdate = await this.testBatchUpdate()
      results.batchUpdate.success = true

      // 測試排程任務啟動
      results.schedulerStartup = await this.testSchedulerStartup()
      results.schedulerStartup.success = true

      // 測試手動觸發更新
      results.manualUpdate = await this.testManualUpdate()
      results.manualUpdate.success = true

      // 測試資料庫更新驗證
      results.databaseVerification = await this.testDatabaseVerification()
      results.databaseVerification.success = true

      // 測試快取功能
      results.cacheTest = await this.testCacheFunctionality()
      results.cacheTest.success = true

      // 測試效能基準
      await this.testPerformanceBenchmark()
      results.performanceBenchmark = { success: true }

      // 測試錯誤處理
      results.errorHandling = await this.testErrorHandling()
      results.errorHandling.success = true

      console.log('🎉 所有診斷測試通過！')
    } catch (error) {
      console.error('❌ 診斷過程中發生錯誤:', error.message)
      results.error = { success: false, message: error.message }
    } finally {
      // 清理環境
      await this.cleanup()

      // 產生報告
      this.generateReport(results)
    }
  }
}

// 如果直接執行此腳本
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].includes('test-hot-score-scheduler.js')
) {
  console.log('🚀 開始熱門分數排程器診斷...')
  console.log('Debug info:')
  console.log('- import.meta.url:', import.meta.url)
  console.log('- process.argv[1]:', process.argv[1])
  console.log('- NODE_ENV:', process.env.NODE_ENV)

  const diagnostic = new HotScoreSchedulerDiagnostic()
  diagnostic.runFullDiagnostic().catch((error) => {
    console.error('❌ 診斷腳本執行失敗:', error.message)
    console.error('Error stack:', error.stack)
    process.exit(1)
  })
} else {
  console.log('腳本條件不滿足，跳過執行')
  console.log('import.meta.url:', import.meta.url)
  console.log('process.argv[1]:', process.argv[1])
}

export default HotScoreSchedulerDiagnostic
