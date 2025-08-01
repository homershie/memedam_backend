/**
 * 協同過濾推薦更新排程器
 * 專門處理協同過濾推薦的定期更新
 */

import { logger } from './logger.js'
import {
  updateCollaborativeFilteringCache,
  updateSocialCollaborativeFilteringCache,
} from './collaborativeFiltering.js'

/**
 * 更新配置
 */
const COLLABORATIVE_FILTERING_CONFIG = {
  interval: '24h', // 每天更新
  enabled: true,
  maxUsers: 1000, // 最大處理用戶數
  maxMemes: 5000, // 最大處理迷因數
  batchSize: 50, // 批次處理大小
}

/**
 * 批次更新協同過濾快取
 * @param {Object} options - 更新選項
 * @returns {Promise<Object>} 更新結果
 */
export const batchUpdateCollaborativeFilteringCache = async (options = {}) => {
  const config = { ...COLLABORATIVE_FILTERING_CONFIG, ...(options || {}) }

  if (!config.enabled) {
    logger.info('協同過濾推薦更新已停用')
    return { success: false, message: '協同過濾推薦更新已停用' }
  }

  try {
    logger.info('開始批次更新協同過濾快取...')
    const startTime = Date.now()

    const result = await updateCollaborativeFilteringCache([])

    const processingTime = Date.now() - startTime
    logger.info(`協同過濾快取更新完成，處理時間: ${processingTime}ms`)

    return {
      success: true,
      algorithm: 'collaborative_filtering',
      processing_time: processingTime,
      result: result,
      message: '協同過濾快取更新完成',
    }
  } catch (error) {
    logger.error('批次更新協同過濾快取失敗:', error.message)
    return {
      success: false,
      algorithm: 'collaborative_filtering',
      error: error.message,
    }
  }
}

/**
 * 批次更新社交協同過濾快取
 * @param {Object} options - 更新選項
 * @returns {Promise<Object>} 更新結果
 */
export const batchUpdateSocialCollaborativeFilteringCache = async (options = {}) => {
  const config = { ...COLLABORATIVE_FILTERING_CONFIG, ...(options || {}) }

  if (!config.enabled) {
    logger.info('社交協同過濾推薦更新已停用')
    return { success: false, message: '社交協同過濾推薦更新已停用' }
  }

  try {
    logger.info('開始批次更新社交協同過濾快取...')
    const startTime = Date.now()

    const result = await updateSocialCollaborativeFilteringCache([])

    const processingTime = Date.now() - startTime
    logger.info(`社交協同過濾快取更新完成，處理時間: ${processingTime}ms`)

    return {
      success: true,
      algorithm: 'social_collaborative_filtering',
      processing_time: processingTime,
      result: result,
      message: '社交協同過濾快取更新完成',
    }
  } catch (error) {
    logger.error('批次更新社交協同過濾快取失敗:', error.message)
    return {
      success: false,
      algorithm: 'social_collaborative_filtering',
      error: error.message,
    }
  }
}

/**
 * 定期更新任務（可設定為 cron job）
 * @param {Object} options - 任務選項
 * @returns {Promise<Object>} 任務結果
 */
export const scheduledCollaborativeFilteringUpdate = async (options = {}) => {
  const {
    updateInterval = '24h', // 更新間隔
    maxUsers = 1000, // 最大更新用戶數
    maxMemes = 5000, // 最大更新迷因數
    includeSocial = true, // 是否包含社交協同過濾
  } = options

  try {
    logger.info(`開始定期協同過濾推薦更新任務 (間隔: ${updateInterval})`)

    const results = []

    // 更新一般協同過濾快取
    const collaborativeResult = await batchUpdateCollaborativeFilteringCache({
      maxUsers: maxUsers,
      maxMemes: maxMemes,
    })
    results.push(collaborativeResult)

    // 更新社交協同過濾快取（如果啟用）
    if (includeSocial) {
      const socialResult = await batchUpdateSocialCollaborativeFilteringCache({
        maxUsers: maxUsers,
        maxMemes: maxMemes,
      })
      results.push(socialResult)
    }

    const successfulUpdates = results.filter((r) => r.success).length
    const failedUpdates = results.filter((r) => !r.success).length

    logger.info(`定期協同過濾推薦更新任務完成，成功: ${successfulUpdates}, 失敗: ${failedUpdates}`)

    return {
      success: successfulUpdates > 0,
      results: results,
      successful_updates: successfulUpdates,
      failed_updates: failedUpdates,
    }
  } catch (error) {
    logger.error('定期協同過濾推薦更新任務失敗:', error.message)
    throw error
  }
}

/**
 * 取得協同過濾推薦統計資訊
 * @returns {Promise<Object>} 統計資訊
 */
export const getCollaborativeFilteringStats = async () => {
  try {
    // 這裡可以加入更詳細的統計，比如：
    // - 用戶相似度矩陣大小
    // - 平均用戶相似度
    // - 社交關係圖譜統計等

    return {
      success: true,
      data: {
        algorithm: 'collaborative_filtering',
        update_interval: COLLABORATIVE_FILTERING_CONFIG.interval,
        config: COLLABORATIVE_FILTERING_CONFIG,
        features: ['用戶行為相似度計算', '社交關係圖譜分析', '影響力分數計算', '時間衰減處理'],
      },
    }
  } catch (error) {
    logger.error('取得協同過濾推薦統計失敗:', error.message)
    throw error
  }
}

/**
 * 更新協同過濾推薦配置
 * @param {Object} newConfig - 新配置
 * @returns {Object} 更新結果
 */
export const updateCollaborativeFilteringConfig = (newConfig) => {
  try {
    Object.assign(COLLABORATIVE_FILTERING_CONFIG, newConfig)
    logger.info('協同過濾推薦配置已更新:', COLLABORATIVE_FILTERING_CONFIG)

    return {
      success: true,
      config: COLLABORATIVE_FILTERING_CONFIG,
    }
  } catch (error) {
    logger.error('更新協同過濾推薦配置時發生錯誤:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

export default {
  batchUpdateCollaborativeFilteringCache,
  batchUpdateSocialCollaborativeFilteringCache,
  scheduledCollaborativeFilteringUpdate,
  getCollaborativeFilteringStats,
  updateCollaborativeFilteringConfig,
}
