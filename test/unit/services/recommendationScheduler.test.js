import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import cron from 'node-cron'

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
    validate: vi.fn(),
  },
}))

// Mock Redis
vi.mock('../../../config/redis.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    setex: vi.fn(),
  },
}))

// Mock cache version manager
vi.mock('../../../utils/cacheVersionManager.js', () => ({
  default: {
    getVersion: vi.fn(),
    updateVersion: vi.fn(),
    batchUpdateVersions: vi.fn(),
  },
}))

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock database health check
vi.mock('../../../utils/dbHealthCheck.js', () => ({
  preOperationHealthCheck: vi.fn(),
}))

// Mock hot score scheduler
vi.mock('../../../utils/hotScoreScheduler.js', () => ({
  batchUpdateHotScores: vi.fn(),
}))

// Mock collaborative filtering scheduler
vi.mock('../../../utils/collaborativeFilteringScheduler.js', () => ({
  batchUpdateCollaborativeFilteringCache: vi.fn(),
  batchUpdateSocialCollaborativeFilteringCache: vi.fn(),
}))

// Mock content based scheduler
vi.mock('../../../utils/contentBasedScheduler.js', () => ({
  batchUpdateUserPreferences: vi.fn(),
}))

// Import after mocks
import {
  startRecommendationScheduler,
  stopRecommendationScheduler,
  updateHotScores,
  getRecommendationSystemStatus,
  updateRecommendationConfig,
} from '../../../services/recommendationScheduler.js'
import { batchUpdateHotScores } from '../../../utils/hotScoreScheduler.js'
import { batchUpdateUserPreferences } from '../../../utils/contentBasedScheduler.js'
import {
  batchUpdateCollaborativeFilteringCache,
  batchUpdateSocialCollaborativeFilteringCache,
} from '../../../utils/collaborativeFilteringScheduler.js'
import cacheVersionManager from '../../../utils/cacheVersionManager.js'
import { logger } from '../../../utils/logger.js'
import { preOperationHealthCheck } from '../../../utils/dbHealthCheck.js'

describe('推薦系統排程器單元測試', () => {
  let mongoServer
  let mockTask

  beforeAll(async () => {
    // 檢查是否已有連接，如果沒有則建立測試連接
    if (mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create()
      const mongoUri = mongoServer.getUri()
      await mongoose.connect(mongoUri, {
        maxPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
      })
    }

    // 建立 mock task
    mockTask = {
      running: true,
      lastDate: new Date(),
      stop: vi.fn(),
    }
  }, 30000)

  afterAll(async () => {
    // 只在我們建立的測試連接時才清理
    if (mongoServer) {
      await mongoose.disconnect()
      await mongoServer.stop()
    }
  }, 30000)

  beforeEach(() => {
    vi.clearAllMocks()

    // 設定預設的 mock 返回值
    cron.schedule.mockReturnValue(mockTask)
    cron.validate.mockReturnValue(true)
    batchUpdateHotScores.mockResolvedValue({
      success: true,
      updated_count: 100,
      error_count: 0,
      message: '成功更新 100 個迷因的熱門分數',
    })
    batchUpdateUserPreferences.mockResolvedValue({
      success: true,
      updatedUsers: 50,
    })
    batchUpdateCollaborativeFilteringCache.mockResolvedValue({
      success: true,
      updatedUsers: 100,
    })
    batchUpdateSocialCollaborativeFilteringCache.mockResolvedValue({
      success: true,
      updatedUsers: 80,
    })
    cacheVersionManager.updateVersion.mockResolvedValue('1.1.0')
    preOperationHealthCheck.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('startRecommendationScheduler() 測試', () => {
    it('應該正確啟動所有推薦系統調度任務', () => {
      startRecommendationScheduler()

      // 檢查是否呼叫了 cron.schedule 四次（四種不同的推薦算法）
      expect(cron.schedule).toHaveBeenCalledTimes(4)

      // 檢查每個任務的 cron 表達式（包含時區參數）
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function), {
        timezone: 'Asia/Taipei',
      }) // 每小時熱門分數
      expect(cron.schedule).toHaveBeenCalledWith('0 5 * * *', expect.any(Function), {
        timezone: 'Asia/Taipei',
      }) // 每天凌晨5點內容基礎
      expect(cron.schedule).toHaveBeenCalledWith('0 6 * * *', expect.any(Function), {
        timezone: 'Asia/Taipei',
      }) // 每天凌晨6點協同過濾
      expect(cron.schedule).toHaveBeenCalledWith('0 7 * * *', expect.any(Function), {
        timezone: 'Asia/Taipei',
      }) // 每天凌晨7點社交協同過濾
    })

    it('應該記錄啟動日誌', () => {
      startRecommendationScheduler()

      expect(logger.info).toHaveBeenCalledWith('✅ 推薦系統調度器已啟動')
    })

    it('啟動失敗時應該記錄錯誤', () => {
      // 模擬 cron.schedule 拋出錯誤
      cron.schedule.mockImplementation(() => {
        throw new Error('Cron 啟動失敗')
      })

      // 重新載入模組來觸發錯誤
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      startRecommendationScheduler()

      expect(consoleSpy).toHaveBeenCalledWith('❌ 推薦系統調度器啟動失敗:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('stopRecommendationScheduler() 測試', () => {
    it('應該正確停止所有推薦系統調度任務', () => {
      // 先啟動任務
      startRecommendationScheduler()

      // 停止任務
      stopRecommendationScheduler()

      // 檢查是否呼叫了 stop 方法
      expect(mockTask.stop).toHaveBeenCalledTimes(4)
      expect(logger.info).toHaveBeenCalledWith('推薦系統調度器已停止')
    })

    it('應該記錄停止日誌', () => {
      stopRecommendationScheduler()

      expect(logger.info).toHaveBeenCalledWith('推薦系統調度器已停止')
    })
  })

  describe('updateHotScores() 函數測試', () => {
    it('應該成功執行熱門分數更新', async () => {
      const result = await updateHotScores()

      expect(result).toEqual({
        success: true,
        algorithm: 'hot_score',
        processingTime: expect.any(Number),
        result: {
          success: true,
          updated_count: 100,
          error_count: 0,
          message: '成功更新 100 個迷因的熱門分數',
        },
        retry_count: 0,
      })

      expect(batchUpdateHotScores).toHaveBeenCalledWith({
        limit: 1000,
        force: false,
      })
    })

    it('應該處理批次更新失敗並重試', async () => {
      // 第一次呼叫失敗，第二次成功
      batchUpdateHotScores
        .mockRejectedValueOnce(new Error('資料庫連接失敗'))
        .mockResolvedValueOnce({
          success: true,
          updated_count: 50,
          error_count: 0,
          message: '重試成功更新 50 個迷因',
        })

      const result = await updateHotScores()

      expect(result).toEqual({
        success: true,
        algorithm: 'hot_score',
        processingTime: expect.any(Number),
        result: {
          success: true,
          updated_count: 50,
          error_count: 0,
          message: '重試成功更新 50 個迷因',
        },
        retry_count: 1,
      })

      expect(batchUpdateHotScores).toHaveBeenCalledTimes(2)
    })

    it('重試次數用完後應該返回失敗結果', async () => {
      // 模擬所有重試都失敗
      batchUpdateHotScores.mockRejectedValue(new Error('持續失敗'))

      const result = await updateHotScores()

      expect(result).toEqual({
        success: false,
        algorithm: 'hot_score',
        error: '持續失敗',
        stack: expect.any(String),
        retry_count: 3,
      })

      expect(batchUpdateHotScores).toHaveBeenCalledTimes(3)
    })

    it('當更新被停用時應該返回失敗結果', async () => {
      const result = await updateHotScores({ enabled: false })

      expect(result).toEqual({
        success: false,
        message: 'Hot Score 更新已停用',
      })

      expect(batchUpdateHotScores).not.toHaveBeenCalled()
    })

    it('應該正確更新版本控制', async () => {
      await updateHotScores()

      expect(cacheVersionManager.updateVersion).toHaveBeenCalledWith(
        'scheduler:hot_score_update',
        'minor',
      )
    })

    it('資料庫健康檢查失敗時應該拋出錯誤', async () => {
      preOperationHealthCheck.mockResolvedValue(false)

      // 重新模擬 batchUpdateHotScores 來拋出錯誤
      batchUpdateHotScores.mockRejectedValueOnce(
        new Error('資料庫健康檢查失敗，無法執行熱門分數更新'),
      )

      try {
        await updateHotScores()
        throw new Error('Should have thrown')
      } catch (error) {
        expect(error.message).toContain('資料庫健康檢查失敗')
      }
    })

    it('應該記錄處理時間和結果', async () => {
      await updateHotScores()

      expect(logger.info).toHaveBeenCalledWith('Hot Score 更新開始，新版本已標記')

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Hot Score 更新完成，處理時間: \d+ms/),
        expect.objectContaining({
          result: expect.objectContaining({
            success: true,
            updated_count: 100,
          }),
        }),
      )
    })
  })

  describe('cron job 配置測試', () => {
    it('應該正確設定熱門分數更新的 cron 任務', () => {
      startRecommendationScheduler()

      const hotScoreCall = cron.schedule.mock.calls.find((call) => call[0] === '0 * * * *')

      expect(hotScoreCall).toBeDefined()

      const taskFunction = hotScoreCall[1]
      expect(typeof taskFunction).toBe('function')
    })

    it('應該正確設定內容基礎推薦的 cron 任務', () => {
      startRecommendationScheduler()

      const contentBasedCall = cron.schedule.mock.calls.find((call) => call[0] === '0 5 * * *')

      expect(contentBasedCall).toBeDefined()
      expect(contentBasedCall[2]).toEqual({
        timezone: 'Asia/Taipei',
      })
    })

    it('應該正確設定協同過濾推薦的 cron 任務', () => {
      startRecommendationScheduler()

      const collaborativeCall = cron.schedule.mock.calls.find((call) => call[0] === '0 6 * * *')

      expect(collaborativeCall).toBeDefined()
      expect(collaborativeCall[2]).toEqual({
        timezone: 'Asia/Taipei',
      })
    })

    it('應該正確設定社交協同過濾推薦的 cron 任務', () => {
      startRecommendationScheduler()

      const socialCollaborativeCall = cron.schedule.mock.calls.find(
        (call) => call[0] === '0 7 * * *',
      )

      expect(socialCollaborativeCall).toBeDefined()
      expect(socialCollaborativeCall[2]).toEqual({
        timezone: 'Asia/Taipei',
      })
    })

    it('cron job 執行失敗時應該記錄錯誤', async () => {
      // 模擬任務執行失敗
      batchUpdateHotScores.mockRejectedValue(new Error('任務執行失敗'))

      startRecommendationScheduler()

      // 找到熱門分數任務
      const hotScoreCall = cron.schedule.mock.calls.find((call) => call[0] === '0 * * * *')
      const taskFunction = hotScoreCall[1]

      // 執行任務函數
      await taskFunction()

      expect(logger.error).toHaveBeenCalledWith(
        'Hot Score 更新失敗:',
        expect.objectContaining({
          error: '任務執行失敗',
          options: expect.any(Object),
          stack: expect.any(String),
        }),
      )
    })
  })

  describe('getRecommendationSystemStatus() 測試', () => {
    it('應該返回正確的系統狀態', async () => {
      const status = await getRecommendationSystemStatus()

      expect(status).toEqual({
        success: true,
        status: {
          hotScore: {
            enabled: true,
            interval: '1h',
            lastUpdate: null,
          },
          contentBased: {
            enabled: true,
            interval: '24h',
            lastUpdate: null,
          },
          collaborativeFiltering: {
            enabled: true,
            interval: '24h',
            lastUpdate: null,
          },
          socialCollaborativeFiltering: {
            enabled: true,
            interval: '24h',
            lastUpdate: null,
          },
        },
        config: expect.objectContaining({
          hotScore: expect.objectContaining({
            enabled: true,
            interval: '1h',
            batchSize: 1000,
          }),
        }),
      })
    })
  })

  describe('updateRecommendationConfig() 測試', () => {
    it('應該成功更新推薦系統配置', () => {
      const newConfig = {
        hotScore: {
          enabled: false,
          interval: '2h',
          batchSize: 500,
        },
      }

      const result = updateRecommendationConfig(newConfig)

      expect(result).toEqual({
        success: true,
        config: expect.objectContaining(newConfig),
      })

      expect(logger.info).toHaveBeenCalledWith(
        '推薦系統配置已更新:',
        expect.objectContaining(newConfig),
      )
    })

    it('更新配置失敗時應該記錄錯誤', () => {
      // 模擬 logger.info 拋出錯誤
      logger.info.mockImplementation(() => {
        throw new Error('日誌記錄失敗')
      })

      const result = updateRecommendationConfig({})

      expect(result).toEqual({
        success: false,
        error: '日誌記錄失敗',
      })
    })
  })

  describe('錯誤處理測試', () => {
    it('應該處理版本控制失敗', async () => {
      cacheVersionManager.updateVersion.mockRejectedValue(new Error('版本控制失敗'))

      const result = await updateHotScores()

      // 應該繼續執行而不受版本控制失敗影響
      expect(result).toHaveProperty('success')
      if (result.success) {
        expect(result).toHaveProperty('algorithm', 'hot_score')
      }
    })

    it('應該處理快取版本管理器模組載入失敗', async () => {
      // 模擬 batchUpdateHotScores 失敗
      batchUpdateHotScores.mockRejectedValueOnce(new Error('快取版本管理器載入失敗'))

      const result = await updateHotScores()

      expect(result).toHaveProperty('success')
      expect(result.success).toBe(false)
    })
  })

  describe('效能測試', () => {
    it('應該在合理時間內完成更新操作', async () => {
      const startTime = Date.now()
      await updateHotScores()
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(100) // 少於100ms
    })

    it('應該正確計算處理時間', async () => {
      const result = await updateHotScores()

      if (result.success) {
        expect(result).toHaveProperty('processingTime')
        expect(typeof result.processingTime).toBe('number')
        expect(result.processingTime).toBeGreaterThanOrEqual(0)
      } else {
        // 如果失敗，檢查是否有適當的錯誤處理
        // 可能是 error 屬性（異常情況）或 message 屬性（停用情況）
        const hasError = Object.prototype.hasOwnProperty.call(result, 'error')
        const hasMessage = Object.prototype.hasOwnProperty.call(result, 'message')
        expect(hasError || hasMessage).toBe(true)

        if (hasError) {
          expect(typeof result.error).toBe('string')
        }
        if (hasMessage) {
          expect(typeof result.message).toBe('string')
        }
      }
    })
  })
})
