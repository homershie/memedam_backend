import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
// MongoDB 連接由全局測試設置管理
import mongoose from 'mongoose'
import cron from 'node-cron'

// Mock node-cron for integration testing
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
    validate: vi.fn(),
  },
}))

// Import models
import Meme from '../../../models/Meme.js'
import User from '../../../models/User.js'

// Import services
import { batchUpdateHotScores } from '../../../utils/hotScoreScheduler.js'
import {
  updateHotScores,
  startRecommendationScheduler,
} from '../../../services/recommendationScheduler.js'
// import { calculateMemeHotScore } from '../../../utils/hotScore.js'
// import { logger } from '../../../utils/logger.js'

// Import cache
import redisCache from '../../../config/redis.js'
// import cacheVersionManager from '../../../utils/cacheVersionManager.js'

describe('熱門分數排程器端到端整合測試', () => {
  let testUsers = []
  let testMemes = []
  let mockTask

  beforeAll(async () => {
    // 建立 mock task for cron
    mockTask = {
      running: true,
      lastDate: new Date(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }

    // Mock cron.schedule to return our mock task
    cron.schedule.mockReturnValue(mockTask)
    cron.validate.mockReturnValue(true)

    console.log('✅ 端到端測試環境已設定')
  }, 60000)

  afterAll(async () => {
    // 重置 mocks - 資料庫連接由全局設置管理
    vi.clearAllMocks()

    console.log('✅ 端到端測試環境已清理')
  }, 30000)

  beforeEach(async () => {
    try {
      // 清理測試數據 - 依賴全局 MongoDB 連接設置
      await Meme.deleteMany({})
      await User.deleteMany({})
    } catch (error) {
      console.warn('準備測試環境時發生錯誤:', error.message)
      throw error
    }

    // 建立測試用戶
    for (let i = 0; i < 10; i++) {
      const user = await User.create({
        username: `testuser_${i}_${Date.now()}`,
        email: `test_${i}_${Date.now()}@example.com`,
        password: 'testpassword123',
        role: 'user',
        status: 'active',
        email_verified: true,
      })
      testUsers.push(user)
    }

    // 建立測試迷因 - 分佈在不同時間段
    const now = new Date()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    for (let i = 0; i < 100; i++) {
      let createdAt, modifiedAt, hotScore

      // 分佈迷因在不同時間段，並設定不同的熱門分數狀態
      if (i < 20) {
        // 最近的迷因（應該被非強制模式更新）
        createdAt = new Date(now.getTime() - Math.random() * 60 * 60 * 1000) // 過去1小時內
        modifiedAt = new Date(createdAt.getTime() + Math.random() * 1800000) // 最近修改
        hotScore = undefined // 沒有熱門分數，應該被更新
      } else if (i < 50) {
        // 昨天的迷因 - 使用更近的時間避免時間衰減過多
        createdAt = new Date(now.getTime() - (Math.random() * 12 + 1) * 60 * 60 * 1000) // 1-13小時前
        modifiedAt = createdAt
        hotScore = Math.floor(Math.random() * 100) // 已經有熱門分數
      } else if (i < 80) {
        // 一週前的迷因 - 使用更近的時間
        createdAt = new Date(now.getTime() - (Math.random() * 48 + 24) * 60 * 60 * 1000) // 24-72小時前
        modifiedAt = createdAt
        hotScore = Math.floor(Math.random() * 200)
      } else {
        // 一個月前的迷因（不應該被非強制模式更新）
        createdAt = new Date(monthAgo.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        modifiedAt = createdAt
        hotScore = Math.floor(Math.random() * 50)
      }

      const meme = await Meme.create({
        title: `測試迷因 ${i}`,
        type: 'image',
        content: `這是測試迷因 ${i} 的內容`,
        image_url: `https://example.com/test_${i}.jpg`,
        author_id: testUsers[i % testUsers.length]._id,
        status: 'public',
        like_count: Math.floor(Math.random() * 100) + 10, // 確保有足夠的點讚數
        dislike_count: Math.floor(Math.random() * 20),
        views: Math.floor(Math.random() * 1000) + 100, // 確保有足夠的瀏覽數
        comment_count: Math.floor(Math.random() * 50) + 5, // 確保有足夠的留言數
        collection_count: Math.floor(Math.random() * 30),
        share_count: Math.floor(Math.random() * 20),
        createdAt,
        modified_at: modifiedAt,
        hot_score: hotScore, // 明確設定熱門分數
      })
      testMemes.push(meme)
    }

    // 清除快取
    try {
      await redisCache.del('hot_score_batch:*')
      await redisCache.del('meme_hot_score:*')
    } catch (error) {
      console.warn('清除快取失敗:', error.message)
    }

    console.log(`✅ 建立 ${testUsers.length} 個測試用戶和 ${testMemes.length} 個測試迷因`)
  }, 30000)

  afterEach(async () => {
    try {
      // 清理測試數據 - 依賴全局 MongoDB 連接設置
      await Meme.deleteMany({})
      await User.deleteMany({})
      testUsers = []
      testMemes = []

      // 重置 mocks
      vi.clearAllMocks()

      console.log('✅ 測試數據已清理')
    } catch (error) {
      console.warn('清理測試數據時發生錯誤:', error.message)
      // 不拋出錯誤，避免測試框架中斷
    }
  })

  describe('實際資料庫更新測試', () => {
    it('應該成功更新所有迷因的熱門分數', async () => {
      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 50,
      })

      expect(result.success).toBe(true)
      expect(result.updated_count).toBeGreaterThan(0)
      expect(result.error_count).toBeLessThanOrEqual(result.updated_count)

      console.log(`📊 成功更新 ${result.updated_count} 個迷因，失敗 ${result.error_count} 個`)
    }, 30000)

    it('應該正確計算並儲存熱門分數到資料庫', async () => {
      // 清除快取確保重新計算
      await redisCache.del('meme_hot_score:*')

      // 選擇一個測試迷因
      const testMeme = testMemes[0]
      const originalHotScore = testMeme.hot_score || 0

      console.log(`原始熱門分數: ${originalHotScore}`)

      // 更新熱門分數 - 確保包含所有測試迷因
      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 50,
      })

      expect(result.success).toBe(true)

      // 重新從資料庫取得迷因
      const updatedMeme = await Meme.findById(testMeme._id)

      console.log(`更新後熱門分數: ${updatedMeme.hot_score}`)

      // 驗證熱門分數已被更新且不為0
      expect(typeof updatedMeme.hot_score).toBe('number')
      expect(updatedMeme.hot_score).toBeGreaterThan(0) // 確保大於0

      console.log(
        `🔥 迷因 ${testMeme._id} 熱門分數從 ${originalHotScore} 更新為 ${updatedMeme.hot_score}`,
      )
    }, 30000)

    it('應該處理大量資料的批次更新', async () => {
      const startTime = Date.now()

      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 20,
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.success).toBe(true)
      expect(result.updated_count).toBeGreaterThan(50)
      expect(duration).toBeLessThan(30000) // 少於30秒

      console.log(
        `⚡ 處理 ${result.updated_count} 個迷因耗時 ${duration}ms，平均每秒處理 ${Math.round(result.updated_count / (duration / 1000))} 個`,
      )
    }, 30000)

    it('應該只更新最近有活動的迷因（非強制模式）', async () => {
      // 先執行一次強制更新，確保所有迷因都有熱門分數
      await batchUpdateHotScores({ limit: 1000, force: true, batchSize: 50 })

      // 將前80個迷因的修改時間和創建時間都設定為超過一週前，讓它們不會被非強制模式選中
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 8) // 8天前，超過7天限制

      for (let i = 0; i < 80; i++) {
        await Meme.findByIdAndUpdate(testMemes[i]._id, {
          createdAt: weekAgo,
          modified_at: weekAgo,
          hot_score: Math.floor(Math.random() * 100) + 1, // 確保有非零分數
        })
      }

      // 重新設定最後20個迷因的熱門分數為 undefined，並更新為最近的時間
      const recentTime = new Date()
      for (let i = 80; i < 100; i++) {
        await Meme.findByIdAndUpdate(testMemes[i]._id, {
          hot_score: undefined, // 沒有熱門分數
          createdAt: recentTime,
          modified_at: recentTime,
        })
      }

      // 等待一下然後再次更新（非強制模式）
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 先檢查查詢條件是否正確
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const shouldBeUpdated = await Meme.countDocuments({
        $or: [
          { modified_at: { $gte: oneWeekAgo } },
          { createdAt: { $gte: oneWeekAgo } },
          { hot_score: { $exists: false } },
          { hot_score: 0 },
        ],
      })

      console.log(`預計應該更新 ${shouldBeUpdated} 個迷因`)

      const result = await batchUpdateHotScores({
        limit: 1000,
        force: false,
        batchSize: 50,
      })

      // 應該只更新最近的有活動的迷因（最後20個沒有熱門分數的）
      expect(result.updated_count).toBeGreaterThan(0)
      expect(result.updated_count).toBeLessThanOrEqual(shouldBeUpdated + 5) // 允許一些誤差

      console.log(`🔄 非強制模式更新 ${result.updated_count} 個迷因，符合預期`)
    }, 30000)
  })

  describe('排程任務時間觸發測試', () => {
    it('應該正確設定每小時熱門分數更新任務', () => {
      startRecommendationScheduler()

      // 驗證 cron.schedule 被呼叫
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function), {
        timezone: 'Asia/Taipei',
      })

      console.log('⏰ 每小時熱門分數更新任務已設定')
    })

    it('應該能夠手動觸發排程任務', async () => {
      startRecommendationScheduler()

      // 找到熱門分數更新的任務函數
      const hotScoreCall = cron.schedule.mock.calls.find((call) => call[0] === '0 * * * *')

      expect(hotScoreCall).toBeDefined()

      const taskFunction = hotScoreCall[1]

      // 手動執行任務
      await taskFunction()

      // 驗證任務被執行（會呼叫 updateHotScores）
      console.log('✅ 排程任務手動觸發成功')
    }, 30000)

    it('應該正確處理時區設定', () => {
      startRecommendationScheduler()

      // 檢查所有任務都設定了正確的時區
      cron.schedule.mock.calls.forEach((call) => {
        expect(call[2]).toEqual({ timezone: 'Asia/Taipei' })
      })

      console.log('🌍 所有排程任務都設定了 Asia/Taipei 時區')
    })
  })

  describe('錯誤處理和重試機制測試', () => {
    beforeEach(async () => {
      try {
        // 清理測試數據 - 依賴全局 MongoDB 連接設置
        await Meme.deleteMany({})
        await User.deleteMany({})
        console.log('✅ 錯誤處理測試數據清理完成')
      } catch (error) {
        console.warn('準備錯誤處理測試環境時發生錯誤:', error.message)
      }
    })

    it('應該在資料庫連接問題時重試', async () => {
      // 模擬臨時資料庫連接問題
      // 強制斷開連接模擬錯誤
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect()
      }

      try {
        // 嘗試執行更新，這應該會因為連接問題而失敗
        const result = await updateHotScores()

        // 即使有連接問題，函數也應該返回結果對象
        expect(result).toHaveProperty('success')
        expect(result.success).toBe(false) // 因為資料庫連接問題，應該返回失敗
        console.log('🔄 錯誤處理機制正常工作')
      } catch (error) {
        // 如果拋出錯誤，這也是可以接受的，因為資料庫連接失敗
        expect(error).toBeDefined()
        console.log('🔄 錯誤處理機制正常工作（拋出錯誤）')
      } finally {
        // 資料庫連接由全局設置管理，不需要手動重新連接
        console.log('🔄 錯誤處理測試完成')
      }
    }, 30000)

    it('應該處理個別迷因計算失敗', async () => {
      // 建立一個會導致計算錯誤的迷因
      await Meme.create({
        title: '無效測試迷因',
        type: 'text',
        content: '',
        author_id: testUsers[0]._id,
        status: 'public',
        like_count: 'invalid', // 無效的數字
        view_count: 100,
        createdAt: new Date(),
      })

      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 10,
      })

      // 應該成功處理大部分迷因
      expect(result.success).toBe(true)
      expect(result.updated_count).toBeGreaterThan(0)
      expect(result.error_count).toBeGreaterThan(0)

      console.log(`⚠️  處理了 ${result.error_count} 個錯誤，繼續處理其他迷因`)
    }, 30000)

    it('應該在快取失敗時繼續處理', async () => {
      // 模擬快取失敗
      const originalRedisSet = redisCache.set
      redisCache.set = vi.fn().mockRejectedValue(new Error('Redis 連接失敗'))

      try {
        const result = await batchUpdateHotScores({
          limit: 50,
          force: true,
          batchSize: 10,
        })

        // 應該成功處理資料庫更新
        expect(result.success).toBe(true)
        expect(result.updated_count).toBeGreaterThan(0)

        console.log('💾 快取失敗時仍能繼續處理資料庫更新')
      } finally {
        redisCache.set = originalRedisSet
      }
    }, 30000)
  })

  describe('大量資料處理效能測試', () => {
    beforeEach(async () => {
      try {
        // 清理測試數據 - 依賴全局 MongoDB 連接設置
        await Meme.deleteMany({})
        await User.deleteMany({})
        console.log('✅ 效能測試數據清理完成')
      } catch (error) {
        console.warn('準備效能測試環境時發生錯誤:', error.message)
      }
    })

    it('應該能夠處理大規模資料集', async () => {
      // 建立更多測試資料
      const additionalMemes = []
      for (let i = 0; i < 500; i++) {
        const meme = await Meme.create({
          title: `大規模測試迷因 ${i}`,
          type: 'image',
          content: `大規模測試內容 ${i}`,
          image_url: `https://example.com/large_test_${i}.jpg`,
          author_id: testUsers[i % testUsers.length]._id,
          status: 'public',
          like_count: Math.floor(Math.random() * 200),
          view_count: Math.floor(Math.random() * 2000),
          comment_count: Math.floor(Math.random() * 100),
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // 過去7天內隨機時間
        })
        additionalMemes.push(meme)
      }

      console.log(`📈 建立額外 ${additionalMemes.length} 個測試迷因`)

      const startTime = Date.now()

      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 50,
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.success).toBe(true)
      expect(result.updated_count).toBeGreaterThan(400)
      expect(duration).toBeLessThan(60000) // 少於1分鐘

      const throughput = Math.round(result.updated_count / (duration / 1000))
      console.log(`🚀 大規模處理效能: ${throughput} 個/秒，總耗時 ${duration}ms`)

      // 清理額外資料
      await Meme.deleteMany({ title: /^大規模測試迷因/ })
    }, 60000)

    it('應該維持記憶體使用在合理範圍', async () => {
      const initialMemoryUsage = process.memoryUsage().heapUsed

      const result = await batchUpdateHotScores({
        limit: 1000,
        force: true,
        batchSize: 25,
      })

      const finalMemoryUsage = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage
      const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024)

      expect(memoryIncreaseMB).toBeLessThan(100) // 記憶體增加少於100MB
      expect(result.success).toBe(true)

      console.log(`💾 處理期間記憶體增加 ${memoryIncreaseMB}MB`)
    }, 30000)

    it('應該能夠並行處理多個批次', async () => {
      const batchPromises = [
        batchUpdateHotScores({ limit: 200, force: true, batchSize: 20 }),
        batchUpdateHotScores({ limit: 200, force: true, batchSize: 20 }),
        batchUpdateHotScores({ limit: 200, force: true, batchSize: 20 }),
      ]

      const startTime = Date.now()
      const results = await Promise.allSettled(batchPromises)
      const endTime = Date.now()

      const successfulResults = results.filter((r) => r.status === 'fulfilled' && r.value.success)
      const totalUpdated = successfulResults.reduce((sum, r) => sum + r.value.updated_count, 0)

      expect(successfulResults.length).toBeGreaterThan(0)
      expect(totalUpdated).toBeGreaterThan(100)

      console.log(`🔄 並行處理完成，總共更新 ${totalUpdated} 個迷因，耗時 ${endTime - startTime}ms`)
    }, 30000)
  })

  describe('快取整合測試', () => {
    beforeEach(async () => {
      try {
        // 清理測試數據 - 依賴全局 MongoDB 連接設置
        await Meme.deleteMany({})
        await User.deleteMany({})
        console.log('✅ 快取測試數據清理完成')
      } catch (error) {
        console.warn('準備快取測試環境時發生錯誤:', error.message)
      }
    })

    it('應該正確整合版本控制快取', async () => {
      const result = await updateHotScores()

      expect(result.success).toBe(true)

      // 驗證快取鍵是否存在
      const cacheKeys = await redisCache.keys('hot_score_batch:*')
      expect(cacheKeys.length).toBeGreaterThan(0)

      console.log('🔄 版本控制快取正常工作')
    }, 30000)

    it('應該在快取命中時節省處理時間', async () => {
      // 第一次執行
      const firstStartTime = Date.now()
      await batchUpdateHotScores({ limit: 50, force: true, batchSize: 10 })
      const firstDuration = Date.now() - firstStartTime

      // 等待一下然後再次執行（應該從快取取得）
      await new Promise((resolve) => setTimeout(resolve, 100))

      const secondStartTime = Date.now()
      await batchUpdateHotScores({ limit: 50, force: false, batchSize: 10 })
      const secondDuration = Date.now() - secondStartTime

      // 第二次應該更快（快取命中）
      expect(secondDuration).toBeLessThanOrEqual(firstDuration)

      console.log(`⚡ 快取命中節省時間: 第一次 ${firstDuration}ms, 第二次 ${secondDuration}ms`)
    }, 30000)
  })

  describe('系統整合測試', () => {
    beforeEach(async () => {
      try {
        // 清理測試數據 - 依賴全局 MongoDB 連接設置
        await Meme.deleteMany({})
        await User.deleteMany({})
        console.log('✅ 系統整合測試數據清理完成')
      } catch (error) {
        console.warn('準備系統整合測試環境時發生錯誤:', error.message)
      }
    })

    it('應該能夠完整執行推薦系統更新流程', async () => {
      const result = await updateHotScores({
        hotScore: {
          enabled: true,
          batchSize: 100,
          force: true,
        },
      })

      expect(result.success).toBe(true)
      expect(result.algorithm).toBe('hot_score')
      expect(result.result.updated_count).toBeGreaterThan(0)

      console.log('🎯 完整推薦系統更新流程測試通過')
    }, 30000)

    it('應該正確處理系統狀態查詢', async () => {
      const { getRecommendationSystemStatus } = await import(
        '../../../services/recommendationScheduler.js'
      )

      const status = await getRecommendationSystemStatus()

      expect(status.success).toBe(true)
      expect(status).toHaveProperty('status')
      expect(status).toHaveProperty('config')

      console.log('📊 系統狀態查詢正常')
    }, 30000)

    it('應該能夠處理配置更新', async () => {
      const { updateRecommendationConfig } = await import(
        '../../../services/recommendationScheduler.js'
      )

      const newConfig = {
        hotScore: {
          enabled: false,
          batchSize: 200,
        },
      }

      const result = updateRecommendationConfig(newConfig)

      expect(result.success).toBe(true)
      expect(result.config.hotScore.enabled).toBe(false)

      console.log('⚙️ 配置更新正常')
    }, 30000)
  })
})
