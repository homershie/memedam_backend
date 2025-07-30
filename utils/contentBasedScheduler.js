/**
 * 內容基礎推薦更新排程器
 * 專門處理內容基礎推薦的定期更新
 */

import { logger } from './logger.js'
import { updateUserPreferencesCache } from './contentBased.js'
import User from '../models/User.js'

/**
 * 更新配置
 */
const CONTENT_BASED_CONFIG = {
  interval: '24h', // 每天更新
  enabled: true,
  batchSize: 100, // 批次處理大小
  minInteractions: 3,
  decayFactor: 0.95,
  maxUsers: 1000, // 最大處理用戶數
}

/**
 * 批次更新用戶偏好快取
 * @param {Object} options - 更新選項
 * @returns {Promise<Object>} 更新結果
 */
export const batchUpdateUserPreferences = async (options = {}) => {
  const config = { ...CONTENT_BASED_CONFIG, ...options }

  if (!config.enabled) {
    logger.info('內容基礎推薦更新已停用')
    return { success: false, message: '內容基礎推薦更新已停用' }
  }

  try {
    logger.info('開始批次更新用戶偏好快取...')
    const startTime = Date.now()

    // 取得活躍用戶列表
    const activeUsers = await User.find({ status: 'active' }).select('_id').limit(config.maxUsers)
    const userIds = activeUsers.map((user) => user._id.toString())

    logger.info(`找到 ${userIds.length} 個活躍用戶需要更新偏好`)

    if (userIds.length === 0) {
      return {
        success: true,
        updated_count: 0,
        message: '沒有用戶需要更新偏好',
      }
    }

    let updatedCount = 0
    let failedCount = 0
    const errors = []

    // 分批處理用戶
    for (let i = 0; i < userIds.length; i += config.batchSize) {
      const batchUserIds = userIds.slice(i, i + config.batchSize)

      logger.info(
        `處理批次 ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(userIds.length / config.batchSize)}`,
      )

      const updatePromises = batchUserIds.map(async (userId) => {
        try {
          const result = await updateUserPreferencesCache(userId)
          if (result.success) {
            updatedCount++
          } else {
            failedCount++
            errors.push({
              user_id: userId,
              error: result.error,
            })
          }
          return result
        } catch (error) {
          failedCount++
          errors.push({
            user_id: userId,
            error: error.message,
          })
          return { success: false, error: error.message }
        }
      })

      await Promise.all(updatePromises)

      // 每處理一個批次記錄一次進度
      logger.info(
        `已處理 ${Math.min(i + config.batchSize, userIds.length)}/${userIds.length} 個用戶`,
      )
    }

    const processingTime = Date.now() - startTime
    logger.info(
      `用戶偏好快取更新完成: 成功 ${updatedCount} 個, 失敗 ${failedCount} 個, 處理時間: ${processingTime}ms`,
    )

    return {
      success: true,
      algorithm: 'content_based',
      updated_count: updatedCount,
      failed_count: failedCount,
      total_users: userIds.length,
      processing_time: processingTime,
      errors: errors.slice(0, 10), // 只返回前10個錯誤
      message: `成功更新 ${updatedCount} 個用戶的偏好快取`,
    }
  } catch (error) {
    logger.error('批次更新用戶偏好快取失敗:', error.message)
    return {
      success: false,
      algorithm: 'content_based',
      error: error.message,
    }
  }
}

/**
 * 更新單一用戶偏好快取
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 更新結果
 */
export const updateSingleUserPreferences = async (userId) => {
  try {
    const user = await User.findById(userId)
    if (!user) {
      throw new Error('找不到用戶')
    }

    const result = await updateUserPreferencesCache(userId)

    if (result.success) {
      logger.info(`用戶 ${userId} 偏好快取更新成功`)
    } else {
      logger.error(`用戶 ${userId} 偏好快取更新失敗:`, result.error)
    }

    return {
      success: result.success,
      user_id: userId,
      result: result,
    }
  } catch (error) {
    logger.error(`更新用戶 ${userId} 偏好快取失敗:`, error.message)
    return {
      success: false,
      user_id: userId,
      error: error.message,
    }
  }
}

/**
 * 定期更新任務（可設定為 cron job）
 * @param {Object} options - 任務選項
 * @returns {Promise<Object>} 任務結果
 */
export const scheduledContentBasedUpdate = async (options = {}) => {
  const {
    updateInterval = '24h', // 更新間隔
    maxUsers = 1000, // 最大更新用戶數
    batchSize = 100, // 批次大小
  } = options

  try {
    logger.info(`開始定期內容基礎推薦更新任務 (間隔: ${updateInterval})`)

    const result = await batchUpdateUserPreferences({
      maxUsers: maxUsers,
      batchSize: batchSize,
    })

    logger.info('定期內容基礎推薦更新任務完成', result)

    return result
  } catch (error) {
    logger.error('定期內容基礎推薦更新任務失敗:', error.message)
    throw error
  }
}

/**
 * 取得內容基礎推薦統計資訊
 * @returns {Promise<Object>} 統計資訊
 */
export const getContentBasedStats = async () => {
  try {
    const totalUsers = await User.countDocuments({ status: 'active' })

    // 這裡可以加入更詳細的統計，比如：
    // - 有偏好數據的用戶數量
    // - 平均偏好標籤數量
    // - 最受歡迎的標籤等

    return {
      success: true,
      data: {
        total_active_users: totalUsers,
        algorithm: 'content_based',
        update_interval: CONTENT_BASED_CONFIG.interval,
        config: CONTENT_BASED_CONFIG,
      },
    }
  } catch (error) {
    logger.error('取得內容基礎推薦統計失敗:', error.message)
    throw error
  }
}

/**
 * 更新內容基礎推薦配置
 * @param {Object} newConfig - 新配置
 * @returns {Object} 更新結果
 */
export const updateContentBasedConfig = (newConfig) => {
  try {
    Object.assign(CONTENT_BASED_CONFIG, newConfig)
    logger.info('內容基礎推薦配置已更新:', CONTENT_BASED_CONFIG)

    return {
      success: true,
      config: CONTENT_BASED_CONFIG,
    }
  } catch (error) {
    logger.error('更新內容基礎推薦配置時發生錯誤:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

export default {
  batchUpdateUserPreferences,
  updateSingleUserPreferences,
  scheduledContentBasedUpdate,
  getContentBasedStats,
  updateContentBasedConfig,
}
