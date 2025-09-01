/**
 * 熱門分數定期更新任務
 * 提供自動化更新熱門分數的功能
 */

import Meme from '../models/Meme.js'
import { calculateMemeHotScore, getHotScoreLevel } from './hotScore.js'
import { logger } from './logger.js'
import { preOperationHealthCheck } from './dbHealthCheck.js'

/**
 * 批次更新熱門分數任務
 * @param {Object} options - 更新選項
 * @param {number} options.limit - 每次更新的迷因數量限制
 * @param {boolean} options.force - 是否強制更新所有迷因
 * @param {number} options.batchSize - 批次處理大小
 * @returns {Promise<Object>} 更新結果
 */
export const batchUpdateHotScores = async (options = {}) => {
  const { limit = 1000, force = false, batchSize = 100 } = options || {}

  try {
    logger.info('開始批次更新熱門分數...')

    // 執行資料庫健康檢查
    const healthCheck = await preOperationHealthCheck('批次更新熱門分數')
    if (!healthCheck) {
      throw new Error('資料庫健康檢查失敗，無法執行熱門分數更新')
    }

    // 建立查詢條件
    const query = { status: { $ne: 'deleted' } }

    // 如果不是強制更新，只更新最近有活動的迷因
    if (!force) {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      query.$or = [
        { updatedAt: { $gte: oneWeekAgo } },
        { hot_score: { $exists: false } },
        { hot_score: 0 },
      ]
    }

    // 取得需要更新的迷因總數
    const totalCount = await Meme.countDocuments(query)
    logger.info(`找到 ${totalCount} 個迷因需要更新熱門分數`)

    if (totalCount === 0) {
      return {
        success: true,
        updated_count: 0,
        message: '沒有迷因需要更新',
      }
    }

    let updatedCount = 0
    let processedCount = 0
    const errors = []

    // 分批處理
    for (let skip = 0; skip < Math.min(totalCount, limit); skip += batchSize) {
      try {
        const memes = await Meme.find(query).skip(skip).limit(batchSize).sort({ updatedAt: -1 })

        logger.info(
          `處理批次 ${Math.floor(skip / batchSize) + 1}/${Math.ceil(Math.min(totalCount, limit) / batchSize)}`,
        )

        for (const meme of memes) {
          try {
            // 驗證迷因資料完整性
            if (!meme._id || !meme.createdAt) {
              logger.warn(`迷因資料不完整，跳過: ${meme._id || 'unknown'}`)
              continue
            }

            const hotScore = calculateMemeHotScore(meme)

            // 驗證計算結果
            if (typeof hotScore !== 'number' || isNaN(hotScore)) {
              logger.warn(`迷因 ${meme._id} 熱門分數計算結果無效: ${hotScore}`)
              continue
            }

            // 更新熱門分數
            meme.hot_score = hotScore
            await meme.save()

            updatedCount++
            processedCount++

            // 每處理100個迷因記錄一次進度
            if (processedCount % 100 === 0) {
              logger.info(`已處理 ${processedCount}/${Math.min(totalCount, limit)} 個迷因`)
            }
          } catch (error) {
            logger.error(`更新迷因 ${meme._id} 熱門分數失敗:`, {
              error: error.message,
              stack: error.stack,
              meme_id: meme._id,
              meme_data: {
                like_count: meme.like_count,
                dislike_count: meme.dislike_count,
                views: meme.views,
                comment_count: meme.comment_count,
                collection_count: meme.collection_count,
                share_count: meme.share_count,
                createdAt: meme.createdAt,
                modified_at: meme.modified_at,
              },
            })
            errors.push({
              meme_id: meme._id,
              error: error.message,
              stack: error.stack,
            })
          }
        }

        // 批次處理完成後稍作休息，避免資料庫壓力過大
        if (skip + batchSize < Math.min(totalCount, limit)) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (batchError) {
        logger.error(`批次 ${Math.floor(skip / batchSize) + 1} 處理失敗:`, {
          error: batchError.message,
          stack: batchError.stack,
          skip,
          batchSize,
        })
        errors.push({
          batch_error: true,
          skip,
          batchSize,
          error: batchError.message,
          stack: batchError.stack,
        })
      }
    }

    logger.info(`熱門分數更新完成: 成功 ${updatedCount} 個, 失敗 ${errors.length} 個`)

    return {
      success: true,
      updated_count: updatedCount,
      error_count: errors.length,
      errors: errors.slice(0, 10), // 只返回前10個錯誤
      message: `成功更新 ${updatedCount} 個迷因的熱門分數`,
    }
  } catch (error) {
    logger.error('批次更新熱門分數失敗:', {
      error: error.message,
      stack: error.stack,
      options,
    })
    throw error
  }
}

/**
 * 更新單一迷因的熱門分數
 * @param {string} memeId - 迷因ID
 * @returns {Promise<Object>} 更新結果
 */
export const updateSingleMemeHotScore = async (memeId) => {
  try {
    const meme = await Meme.findById(memeId)
    if (!meme) {
      throw new Error('找不到迷因')
    }

    const hotScore = calculateMemeHotScore(meme)
    const hotLevel = getHotScoreLevel(hotScore)

    meme.hot_score = hotScore
    await meme.save()

    logger.info(`迷因 ${memeId} 熱門分數更新: ${hotScore} (${hotLevel})`)

    return {
      success: true,
      meme_id: memeId,
      hot_score: hotScore,
      hot_level: hotLevel,
    }
  } catch (error) {
    logger.error(`更新迷因 ${memeId} 熱門分數失敗:`, error.message)
    throw error
  }
}

/**
 * 定期更新任務（可設定為 cron job）
 * @param {Object} options - 任務選項
 * @returns {Promise<Object>} 任務結果
 */
export const scheduledHotScoreUpdate = async (options = {}) => {
  const {
    updateInterval = '1h', // 更新間隔
    maxUpdates = 1000, // 最大更新數量
    force = false, // 是否強制更新
  } = options || {}

  try {
    logger.info(`開始定期熱門分數更新任務 (間隔: ${updateInterval})`)

    const result = await batchUpdateHotScores({
      limit: maxUpdates,
      force: force,
      batchSize: 50,
    })

    logger.info('定期熱門分數更新任務完成', result)

    return result
  } catch (error) {
    logger.error('定期熱門分數更新任務失敗:', error.message)
    throw error
  }
}

/**
 * 取得熱門分數統計資訊
 * @returns {Promise<Object>} 統計資訊
 */
export const getHotScoreStats = async () => {
  try {
    const stats = await Meme.aggregate([
      { $match: { status: { $ne: 'deleted' } } },
      {
        $group: {
          _id: null,
          total_memes: { $sum: 1 },
          avg_hot_score: { $avg: '$hot_score' },
          max_hot_score: { $max: '$hot_score' },
          min_hot_score: { $min: '$hot_score' },
          total_hot_score: { $sum: '$hot_score' },
        },
      },
    ])

    const levelStats = await Meme.aggregate([
      { $match: { status: { $ne: 'deleted' } } },
      {
        $addFields: {
          hot_level: {
            $switch: {
              branches: [
                { case: { $gte: ['$hot_score', 1000] }, then: 'viral' },
                { case: { $gte: ['$hot_score', 500] }, then: 'trending' },
                { case: { $gte: ['$hot_score', 100] }, then: 'popular' },
                { case: { $gte: ['$hot_score', 50] }, then: 'active' },
                { case: { $gte: ['$hot_score', 10] }, then: 'normal' },
              ],
              default: 'new',
            },
          },
        },
      },
      {
        $group: {
          _id: '$hot_level',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])

    return {
      success: true,
      data: {
        overall: stats[0] || {
          total_memes: 0,
          avg_hot_score: 0,
          max_hot_score: 0,
          min_hot_score: 0,
          total_hot_score: 0,
        },
        by_level: levelStats,
      },
    }
  } catch (error) {
    logger.error('取得熱門分數統計失敗:', error.message)
    throw error
  }
}

export default {
  batchUpdateHotScores,
  updateSingleMemeHotScore,
  scheduledHotScoreUpdate,
  getHotScoreStats,
}
