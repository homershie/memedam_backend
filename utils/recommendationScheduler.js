/**
 * 推薦系統更新調度器
 * 統一管理所有推薦算法的定期更新
 */

import { logger } from './logger.js'
import { batchUpdateHotScores } from './hotScoreScheduler.js'
import { batchUpdateUserPreferences } from './contentBasedScheduler.js'
import {
  batchUpdateCollaborativeFilteringCache,
  batchUpdateSocialCollaborativeFilteringCache,
} from './collaborativeFilteringScheduler.js'

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
 * 更新 Hot Score
 */
export const updateHotScores = async (options = {}) => {
  const config = { ...UPDATE_CONFIG.hotScore, ...options }

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
  const config = { ...UPDATE_CONFIG.contentBased, ...options }

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
  const config = { ...UPDATE_CONFIG.collaborativeFiltering, ...options }

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
  const config = { ...UPDATE_CONFIG.socialCollaborativeFiltering, ...options }

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
      updateHotScores(options.hotScore),
      updateContentBasedCache(options.contentBased),
      updateCollaborativeFilteringCacheScheduler(options.collaborativeFiltering),
      updateSocialCollaborativeFilteringCacheScheduler(options.socialCollaborativeFiltering),
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
}
