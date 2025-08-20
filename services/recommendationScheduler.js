/**
 * 推薦系統更新調度器
 * 統一管理所有推薦算法的定期更新
 */

import cron from 'node-cron'
import { logger } from '../utils/logger.js'
import { batchUpdateHotScores } from '../utils/hotScoreScheduler.js'
import { batchUpdateUserPreferences } from '../utils/contentBasedScheduler.js'
import {
  batchUpdateCollaborativeFilteringCache,
  batchUpdateSocialCollaborativeFilteringCache,
} from '../utils/collaborativeFilteringScheduler.js'

/**
 * 更新配置
 */
const UPDATE_CONFIG = {
  // Hot Score 更新配置
  hotScore: {
    interval: '1h', // 每小時更新
    enabled: true,
    batchSize: 1000,
    force: false,
  },

  // Content-Based 更新配置
  contentBased: {
    interval: '24h', // 每天更新
    enabled: true,
    minInteractions: 3,
    decayFactor: 0.95,
  },

  // Collaborative Filtering 更新配置
  collaborativeFiltering: {
    interval: '24h', // 每天更新
    enabled: true,
    maxUsers: 1000,
    maxMemes: 5000,
  },

  // Social Collaborative Filtering 更新配置
  socialCollaborativeFiltering: {
    interval: '24h', // 每天更新
    enabled: true,
    maxUsers: 1000,
  },
}

/**
 * 調度器任務管理
 */
class RecommendationCronScheduler {
  constructor() {
    this.tasks = new Map()
  }

  /**
   * 啟動所有推薦系統調度任務
   */
  startAllTasks() {
    try {
      // 每小時更新熱門分數
      this.scheduleHotScoreUpdate()

      // 每天凌晨5點更新內容基礎推薦
      this.scheduleContentBasedUpdate()

      // 每天凌晨6點更新協同過濾推薦
      this.scheduleCollaborativeFilteringUpdate()

      // 每天凌晨7點更新社交協同過濾推薦
      this.scheduleSocialCollaborativeFilteringUpdate()

      logger.info('✅ 推薦系統調度器已啟動')
      console.log('✅ 推薦系統調度器已啟動')
      console.log('- 熱門分數更新：每小時整點')
      console.log('- 內容基礎推薦更新：每天凌晨5點')
      console.log('- 協同過濾推薦更新：每天凌晨6點')
      console.log('- 社交協同過濾推薦更新：每天凌晨7點')
    } catch (error) {
      logger.error('推薦系統調度器啟動失敗:', error)
      console.error('❌ 推薦系統調度器啟動失敗:', error)
    }
  }

  /**
   * 停止所有推薦系統調度任務
   */
  stopAllTasks() {
    try {
      this.tasks.forEach((task, name) => {
        task.stop()
        console.log(`⏹️ 已停止推薦任務: ${name}`)
      })
      this.tasks.clear()
      logger.info('推薦系統調度器已停止')
      console.log('✅ 推薦系統調度器已停止')
    } catch (error) {
      logger.error('停止推薦系統調度器失敗:', error)
      console.error('❌ 停止推薦系統調度器失敗:', error)
    }
  }

  /**
   * 每小時更新熱門分數
   */
  scheduleHotScoreUpdate() {
    const task = cron.schedule(
      '0 * * * *', // 每小時整點
      async () => {
        try {
          console.log('🔥 開始每小時熱門分數更新...')
          await updateHotScores()
          console.log('✅ 熱門分數更新完成')
        } catch (error) {
          console.error('❌ 熱門分數更新失敗:', error)
          logger.error('Hourly hot score update failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('hotScoreUpdate', task)
    console.log('📅 已排程每小時熱門分數更新')
  }

  /**
   * 每日內容基礎推薦更新 (凌晨5點)
   */
  scheduleContentBasedUpdate() {
    const task = cron.schedule(
      '0 5 * * *',
      async () => {
        try {
          console.log('📝 開始每日內容基礎推薦更新...')
          await updateContentBasedCache()
          console.log('✅ 內容基礎推薦更新完成')
        } catch (error) {
          console.error('❌ 內容基礎推薦更新失敗:', error)
          logger.error('Daily content-based update failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('contentBasedUpdate', task)
    console.log('📅 已排程每日內容基礎推薦更新 (凌晨5點)')
  }

  /**
   * 每日協同過濾推薦更新 (凌晨6點)
   */
  scheduleCollaborativeFilteringUpdate() {
    const task = cron.schedule(
      '0 6 * * *',
      async () => {
        try {
          console.log('👥 開始每日協同過濾推薦更新...')
          await updateCollaborativeFilteringCacheScheduler()
          console.log('✅ 協同過濾推薦更新完成')
        } catch (error) {
          console.error('❌ 協同過濾推薦更新失敗:', error)
          logger.error('Daily collaborative filtering update failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('collaborativeFilteringUpdate', task)
    console.log('📅 已排程每日協同過濾推薦更新 (凌晨6點)')
  }

  /**
   * 每日社交協同過濾推薦更新 (凌晨7點)
   */
  scheduleSocialCollaborativeFilteringUpdate() {
    const task = cron.schedule(
      '0 7 * * *',
      async () => {
        try {
          console.log('🤝 開始每日社交協同過濾推薦更新...')
          await updateSocialCollaborativeFilteringCacheScheduler()
          console.log('✅ 社交協同過濾推薦更新完成')
        } catch (error) {
          console.error('❌ 社交協同過濾推薦更新失敗:', error)
          logger.error('Daily social collaborative filtering update failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('socialCollaborativeFilteringUpdate', task)
    console.log('📅 已排程每日社交協同過濾推薦更新 (凌晨7點)')
  }

  /**
   * 獲取任務狀態
   */
  getTasksStatus() {
    const status = {}
    this.tasks.forEach((task, name) => {
      status[name] = {
        running: task.running,
        lastDate: task.lastDate,
      }
    })
    return status
  }
}

// 創建全局調度器實例
const recommendationCronScheduler = new RecommendationCronScheduler()

/**
 * 啟動推薦系統調度器
 */
export const startRecommendationScheduler = () => {
  recommendationCronScheduler.startAllTasks()
}

/**
 * 停止推薦系統調度器
 */
export const stopRecommendationScheduler = () => {
  recommendationCronScheduler.stopAllTasks()
}

/**
 * 更新 Hot Score
 */
export const updateHotScores = async (options = {}) => {
  const config = { ...UPDATE_CONFIG.hotScore, ...(options || {}) }

  if (!config.enabled) {
    logger.info('Hot Score 更新已停用')
    return { success: false, message: 'Hot Score 更新已停用' }
  }

  try {
    logger.info('開始更新 Hot Score...')
    const startTime = Date.now()

    const result = await batchUpdateHotScores({
      limit: config.batchSize,
      force: config.force,
    })

    const processingTime = Date.now() - startTime
    logger.info(`Hot Score 更新完成，處理時間: ${processingTime}ms`)

    return {
      success: true,
      algorithm: 'hot_score',
      processingTime,
      result,
    }
  } catch (error) {
    logger.error('Hot Score 更新失敗:', error.message)
    return {
      success: false,
      algorithm: 'hot_score',
      error: error.message,
    }
  }
}

/**
 * 更新 Content-Based 推薦快取
 */
export const updateContentBasedCache = async (options = {}) => {
  const config = { ...UPDATE_CONFIG.contentBased, ...(options || {}) }

  if (!config.enabled) {
    logger.info('Content-Based 更新已停用')
    return { success: false, message: 'Content-Based 更新已停用' }
  }

  try {
    logger.info('開始更新 Content-Based 推薦快取...')
    const startTime = Date.now()

    const result = await batchUpdateUserPreferences({
      maxUsers: config.maxUsers,
      batchSize: config.batchSize,
    })

    const processingTime = Date.now() - startTime
    logger.info(`Content-Based 快取更新完成，處理時間: ${processingTime}ms`)

    return {
      success: result.success,
      algorithm: 'content_based',
      processingTime,
      result: result,
    }
  } catch (error) {
    logger.error('Content-Based 快取更新失敗:', error.message)
    return {
      success: false,
      algorithm: 'content_based',
      error: error.message,
    }
  }
}

/**
 * 更新 Collaborative Filtering 快取
 */
export const updateCollaborativeFilteringCacheScheduler = async (options = {}) => {
  const config = { ...UPDATE_CONFIG.collaborativeFiltering, ...(options || {}) }

  if (!config.enabled) {
    logger.info('Collaborative Filtering 更新已停用')
    return { success: false, message: 'Collaborative Filtering 更新已停用' }
  }

  try {
    logger.info('開始更新 Collaborative Filtering 快取...')
    const startTime = Date.now()

    const result = await batchUpdateCollaborativeFilteringCache({
      maxUsers: config.maxUsers,
      maxMemes: config.maxMemes,
    })

    const processingTime = Date.now() - startTime
    logger.info(`Collaborative Filtering 快取更新完成，處理時間: ${processingTime}ms`)

    return {
      success: result.success,
      algorithm: 'collaborative_filtering',
      processingTime,
      result: result,
    }
  } catch (error) {
    logger.error('Collaborative Filtering 快取更新失敗:', error.message)
    return {
      success: false,
      algorithm: 'collaborative_filtering',
      error: error.message,
    }
  }
}

/**
 * 更新 Social Collaborative Filtering 快取
 */
export const updateSocialCollaborativeFilteringCacheScheduler = async (options = {}) => {
  const config = { ...UPDATE_CONFIG.socialCollaborativeFiltering, ...(options || {}) }

  if (!config.enabled) {
    logger.info('Social Collaborative Filtering 更新已停用')
    return { success: false, message: 'Social Collaborative Filtering 更新已停用' }
  }

  try {
    logger.info('開始更新 Social Collaborative Filtering 快取...')
    const startTime = Date.now()

    const result = await batchUpdateSocialCollaborativeFilteringCache({
      maxUsers: config.maxUsers,
      maxMemes: config.maxMemes,
    })

    const processingTime = Date.now() - startTime
    logger.info(`Social Collaborative Filtering 快取更新完成，處理時間: ${processingTime}ms`)

    return {
      success: result.success,
      algorithm: 'social_collaborative_filtering',
      processingTime,
      result: result,
    }
  } catch (error) {
    logger.error('Social Collaborative Filtering 快取更新失敗:', error.message)
    return {
      success: false,
      algorithm: 'social_collaborative_filtering',
      error: error.message,
    }
  }
}

/**
 * 執行所有推薦算法的更新
 */
export const updateAllRecommendationSystems = async (options = {}) => {
  try {
    logger.info('開始執行所有推薦系統更新...')
    const startTime = Date.now()

    const results = await Promise.allSettled([
      updateHotScores(options.hotScore || {}),
      updateContentBasedCache(options.contentBased || {}),
      updateCollaborativeFilteringCacheScheduler(options.collaborativeFiltering || {}),
      updateSocialCollaborativeFilteringCacheScheduler(options.socialCollaborativeFiltering || {}),
    ])

    const processingTime = Date.now() - startTime
    const successfulUpdates = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    ).length
    const failedUpdates = results.filter((r) => r.status === 'rejected' || !r.value.success).length

    logger.info(
      `所有推薦系統更新完成，成功: ${successfulUpdates}, 失敗: ${failedUpdates}, 總處理時間: ${processingTime}ms`,
    )

    return {
      success: successfulUpdates > 0,
      totalProcessingTime: processingTime,
      successfulUpdates,
      failedUpdates,
      results: results.map((result, index) => {
        const algorithms = [
          'hot_score',
          'content_based',
          'collaborative_filtering',
          'social_collaborative_filtering',
        ]
        return {
          algorithm: algorithms[index],
          success: result.status === 'fulfilled' && result.value.success,
          result: result.status === 'fulfilled' ? result.value : { error: result.reason?.message },
        }
      }),
    }
  } catch (error) {
    logger.error('執行所有推薦系統更新時發生錯誤:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 取得推薦系統更新狀態
 */
export const getRecommendationSystemStatus = async () => {
  try {
    const status = {
      hotScore: {
        enabled: UPDATE_CONFIG.hotScore.enabled,
        interval: UPDATE_CONFIG.hotScore.interval,
        lastUpdate: null, // 可以從快取或資料庫取得
      },
      contentBased: {
        enabled: UPDATE_CONFIG.contentBased.enabled,
        interval: UPDATE_CONFIG.contentBased.interval,
        lastUpdate: null,
      },
      collaborativeFiltering: {
        enabled: UPDATE_CONFIG.collaborativeFiltering.enabled,
        interval: UPDATE_CONFIG.collaborativeFiltering.interval,
        lastUpdate: null,
      },
      socialCollaborativeFiltering: {
        enabled: UPDATE_CONFIG.socialCollaborativeFiltering.enabled,
        interval: UPDATE_CONFIG.socialCollaborativeFiltering.interval,
        lastUpdate: null,
      },
    }

    return {
      success: true,
      status,
      config: UPDATE_CONFIG,
    }
  } catch (error) {
    logger.error('取得推薦系統狀態時發生錯誤:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 更新推薦系統配置
 */
export const updateRecommendationConfig = (newConfig) => {
  try {
    Object.assign(UPDATE_CONFIG, newConfig)
    logger.info('推薦系統配置已更新:', UPDATE_CONFIG)

    return {
      success: true,
      config: UPDATE_CONFIG,
    }
  } catch (error) {
    logger.error('更新推薦系統配置時發生錯誤:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

export default {
  updateHotScores,
  updateContentBasedCache,
  updateCollaborativeFilteringCacheScheduler,
  updateSocialCollaborativeFilteringCacheScheduler,
  updateAllRecommendationSystems,
  getRecommendationSystemStatus,
  updateRecommendationConfig,
  startRecommendationScheduler,
  stopRecommendationScheduler,
}
