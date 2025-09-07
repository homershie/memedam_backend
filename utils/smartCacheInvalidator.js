/**
 * 智慧快取失效器
 * 根據操作類型實現增量快取更新而非全量清除
 * 提升系統效能並減少不必要的重計算
 */

import redisCache from '../config/redis.js'
import { logger } from './logger.js'

/**
 * 快取操作類型常量
 */
export const CACHE_OPERATIONS = {
  MEME_CREATED: 'MEME_CREATED',
  MEME_UPDATED: 'MEME_UPDATED',
  MEME_DELETED: 'MEME_DELETED',
  USER_LIKED: 'USER_LIKED',
  USER_DISLIKED: 'USER_DISLIKED',
  USER_COMMENTED: 'USER_COMMENTED',
  USER_COLLECTED: 'USER_COLLECTED',
  USER_FOLLOWED: 'USER_FOLLOWED',
  USER_UNFOLLOWED: 'USER_UNFOLLOWED',
  USER_ACTIVITY_CHANGED: 'USER_ACTIVITY_CHANGED',
}

/**
 * 智慧快取失效器
 * 實現精確的快取失效策略，避免全量清除
 */
class SmartCacheInvalidator {
  constructor(redisClient = redisCache) {
    this.redis = redisClient
    this.invalidatedKeys = new Set() // 記錄已失效的鍵，避免重複失效
  }

  /**
   * 根據操作類型智慧失效快取
   * @param {string} operation - 操作類型
   * @param {Object} params - 操作參數
   * @param {Object} options - 選項
   */
  async invalidateByOperation(operation, params = {}, options = {}) {
    const { skipLogging = false, forceInvalidate = false } = options

    try {
      if (!skipLogging) {
        logger.info('開始智慧快取失效', { operation, params })
      }

      // 重置已失效鍵追蹤
      if (forceInvalidate) {
        this.invalidatedKeys.clear()
      }

      switch (operation) {
        case CACHE_OPERATIONS.MEME_CREATED:
          await this.handleMemeCreated(params)
          break

        case CACHE_OPERATIONS.MEME_UPDATED:
          await this.handleMemeUpdated(params)
          break

        case CACHE_OPERATIONS.MEME_DELETED:
          await this.handleMemeDeleted(params)
          break

        case CACHE_OPERATIONS.USER_LIKED:
        case CACHE_OPERATIONS.USER_DISLIKED:
          await this.handleUserInteraction(params)
          break

        case CACHE_OPERATIONS.USER_COMMENTED:
          await this.handleUserComment(params)
          break

        case CACHE_OPERATIONS.USER_COLLECTED:
          await this.handleUserCollection(params)
          break

        case CACHE_OPERATIONS.USER_FOLLOWED:
        case CACHE_OPERATIONS.USER_UNFOLLOWED:
          await this.handleUserFollow(params)
          break

        case CACHE_OPERATIONS.USER_ACTIVITY_CHANGED:
          await this.handleUserActivityChanged(params)
          break

        default:
          logger.warn('未知的快取操作類型', { operation })
          return
      }

      if (!skipLogging) {
        logger.info('智慧快取失效完成', {
          operation,
          invalidatedCount: this.invalidatedKeys.size,
        })
      }
    } catch (error) {
      logger.error('智慧快取失效失敗', { operation, params, error: error.message })
      // 快取失效失敗不應該影響主要業務邏輯
    }
  }

  /**
   * 處理迷因創建操作
   * @param {Object} params - 參數
   */
  async handleMemeCreated(params) {
    const { memeId, tags = [], authorId } = params

    if (!memeId) {
      logger.warn('MEME_CREATED 操作缺少必要參數', params)
      return
    }

    logger.info('處理迷因創建快取失效', { memeId, tags, authorId })

    // 1. 清除熱門推薦快取（新內容可能影響熱門排序）
    await this.invalidatePattern('hot_recommendations:*')

    // 2. 清除最新推薦快取（新內容應該立即顯示）
    await this.invalidatePattern('latest_recommendations:*')

    // 3. 如果有標籤，清除相關標籤的推薦快取
    if (tags.length > 0) {
      for (const tag of tags) {
        await this.invalidatePattern(`mixed_recommendations:*:*${tag}*`)
        await this.invalidatePattern(`hot_recommendations:*:*${tag}*`)
        await this.invalidatePattern(`latest_recommendations:*:*${tag}*`)
      }
    }

    // 4. 清除作者相關的個人化快取
    if (authorId) {
      await this.invalidatePattern(`mixed_recommendations:${authorId}:*`)
      await this.invalidatePattern(`content_based:${authorId}:*`)
    }

    // 5. 清除推薦統計快取（總數量變化）
    await this.invalidatePattern('recommendation_stats:*')

    // 6. 清除社交分數快取（新內容可能影響社交計算）
    await this.invalidatePattern('social_scores:*')
  }

  /**
   * 處理迷因更新操作
   * @param {Object} params - 參數
   */
  async handleMemeUpdated(params) {
    const { memeId, oldTags = [], newTags = [], authorId, hotScoreChanged = false } = params

    if (!memeId) {
      logger.warn('MEME_UPDATED 操作缺少必要參數', params)
      return
    }

    logger.info('處理迷因更新快取失效', { memeId, oldTags, newTags, authorId })

    // 1. 如果標籤發生變化，清除相關標籤快取
    const allTags = [...new Set([...oldTags, ...newTags])]
    if (allTags.length > 0) {
      for (const tag of allTags) {
        await this.invalidatePattern(`mixed_recommendations:*:*${tag}*`)
        await this.invalidatePattern(`hot_recommendations:*:*${tag}*`)
        await this.invalidatePattern(`latest_recommendations:*:*${tag}*`)
      }
    }

    // 2. 如果熱門分數發生變化，清除熱門推薦快取
    if (hotScoreChanged) {
      await this.invalidatePattern('hot_recommendations:*')
      await this.invalidatePattern('updated_recommendations:*')
    }

    // 3. 清除作者相關的個人化快取
    if (authorId) {
      await this.invalidatePattern(`mixed_recommendations:${authorId}:*`)
      await this.invalidatePattern(`content_based:${authorId}:*`)
    }

    // 4. 清除社交分數快取（內容更新可能影響社交計算）
    await this.invalidatePattern('social_scores:*')
  }

  /**
   * 處理迷因刪除操作
   * @param {Object} params - 參數
   */
  async handleMemeDeleted(params) {
    const { memeId, tags = [], authorId } = params

    if (!memeId) {
      logger.warn('MEME_DELETED 操作缺少必要參數', params)
      return
    }

    logger.info('處理迷因刪除快取失效', { memeId, tags, authorId })

    // 1. 清除所有推薦快取（刪除的內容不應該再出現）
    await this.invalidatePattern('hot_recommendations:*')
    await this.invalidatePattern('latest_recommendations:*')
    await this.invalidatePattern('updated_recommendations:*')

    // 2. 如果有標籤，清除相關標籤快取
    if (tags.length > 0) {
      for (const tag of tags) {
        await this.invalidatePattern(`mixed_recommendations:*:*${tag}*`)
      }
    }

    // 3. 清除作者相關快取
    if (authorId) {
      await this.invalidatePattern(`mixed_recommendations:${authorId}:*`)
      await this.invalidatePattern(`content_based:${authorId}:*`)
    }

    // 4. 清除推薦統計快取
    await this.invalidatePattern('recommendation_stats:*')

    // 5. 清除社交分數快取
    await this.invalidatePattern('social_scores:*')
  }

  /**
   * 處理用戶互動操作（按讚/不喜歡）
   * @param {Object} params - 參數
   */
  async handleUserInteraction(params) {
    const { userId, memeId, isLike } = params

    if (!userId || !memeId) {
      logger.warn('USER_INTERACTION 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶互動快取失效', { userId, memeId, isLike })

    // 1. 清除用戶個人化推薦快取（用戶偏好發生變化）
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    await this.invalidatePattern(`content_based:${userId}:*`)
    await this.invalidatePattern(`collaborative_filtering:${userId}:*`)
    await this.invalidatePattern(`social_collaborative_filtering:${userId}:*`)

    // 2. 清除用戶活躍度快取（互動數量變化）
    await this.invalidatePattern(`user_activity:${userId}`)
    await this.invalidatePattern(`cold_start:${userId}`)

    // 3. 清除社交分數快取（用戶行為影響社交計算）
    await this.invalidatePattern(`social_scores:${userId}:*`)

    // 4. 如果是按讚且熱門分數可能受影響，清除熱門推薦快取
    if (isLike) {
      await this.invalidatePattern('hot_recommendations:*')
    }
  }

  /**
   * 處理用戶評論操作
   * @param {Object} params - 參數
   */
  async handleUserComment(params) {
    const { userId, memeId } = params

    if (!userId || !memeId) {
      logger.warn('USER_COMMENTED 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶評論快取失效', { userId, memeId })

    // 1. 清除用戶個人化推薦快取
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    await this.invalidatePattern(`social_collaborative_filtering:${userId}:*`)

    // 2. 清除用戶活躍度快取
    await this.invalidatePattern(`user_activity:${userId}`)
    await this.invalidatePattern(`cold_start:${userId}`)

    // 3. 清除社交分數快取
    await this.invalidatePattern(`social_scores:${userId}:*`)

    // 4. 評論可能影響熱門度，清除熱門推薦快取
    await this.invalidatePattern('hot_recommendations:*')
  }

  /**
   * 處理用戶收藏操作
   * @param {Object} params - 參數
   */
  async handleUserCollection(params) {
    const { userId, memeId } = params

    if (!userId || !memeId) {
      logger.warn('USER_COLLECTED 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶收藏快取失效', { userId, memeId })

    // 1. 清除用戶個人化推薦快取（收藏行為反映用戶偏好）
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    await this.invalidatePattern(`content_based:${userId}:*`)

    // 2. 清除用戶活躍度快取
    await this.invalidatePattern(`user_activity:${userId}`)
    await this.invalidatePattern(`cold_start:${userId}`)
  }

  /**
   * 處理用戶關注操作
   * @param {Object} params - 參數
   */
  async handleUserFollow(params) {
    const { followerId, followeeId } = params

    if (!followerId || !followeeId) {
      logger.warn('USER_FOLLOW 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶關注快取失效', { followerId, followeeId })

    // 1. 清除關注者相關快取
    await this.invalidatePattern(`mixed_recommendations:${followerId}:*`)
    await this.invalidatePattern(`social_collaborative_filtering:${followerId}:*`)

    // 2. 清除被關注者相關快取（關注者變化可能影響其內容推薦）
    await this.invalidatePattern(`mixed_recommendations:${followeeId}:*`)

    // 3. 清除社交分數快取
    await this.invalidatePattern(`social_scores:${followerId}:*`)
    await this.invalidatePattern(`social_scores:${followeeId}:*`)
  }

  /**
   * 處理用戶活躍度變化
   * @param {Object} params - 參數
   */
  async handleUserActivityChanged(params) {
    const { userId } = params

    if (!userId) {
      logger.warn('USER_ACTIVITY_CHANGED 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶活躍度變化快取失效', { userId })

    // 1. 清除用戶個人化推薦快取
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    await this.invalidatePattern(`content_based:${userId}:*`)
    await this.invalidatePattern(`collaborative_filtering:${userId}:*`)
    await this.invalidatePattern(`social_collaborative_filtering:${userId}:*`)

    // 2. 清除用戶活躍度快取
    await this.invalidatePattern(`user_activity:${userId}`)
    await this.invalidatePattern(`cold_start:${userId}`)
  }

  /**
   * 智慧失效特定模式的所有鍵
   * @param {string} pattern - 鍵模式
   */
  async invalidatePattern(pattern) {
    try {
      if (this.invalidatedKeys.has(pattern)) {
        return // 已經失效過了，跳過
      }

      const count = await this.redis.delPattern(pattern)
      this.invalidatedKeys.add(pattern)

      if (count > 0) {
        logger.debug(`已失效快取模式: ${pattern}, 影響鍵數: ${count}`)
      }

      return count
    } catch (error) {
      logger.error(`失效快取模式失敗: ${pattern}`, error)
      return 0
    }
  }

  /**
   * 失效特定鍵
   * @param {string} key - 快取鍵
   */
  async invalidateKey(key) {
    try {
      if (this.invalidatedKeys.has(key)) {
        return // 已經失效過了，跳過
      }

      const result = await this.redis.del(key)
      this.invalidatedKeys.add(key)

      if (result > 0) {
        logger.debug(`已失效快取鍵: ${key}`)
      }

      return result
    } catch (error) {
      logger.error(`失效快取鍵失敗: ${key}`, error)
      return 0
    }
  }

  /**
   * 批量失效多個鍵
   * @param {Array<string>} keys - 快取鍵列表
   */
  async invalidateKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return
    }

    const promises = keys.map((key) => this.invalidateKey(key))
    const results = await Promise.all(promises)

    return results.reduce((sum, count) => sum + count, 0)
  }

  /**
   * 取得已失效鍵的統計信息
   */
  getInvalidationStats() {
    return {
      invalidatedKeysCount: this.invalidatedKeys.size,
      invalidatedKeys: Array.from(this.invalidatedKeys),
    }
  }

  /**
   * 重置失效追蹤器
   */
  reset() {
    this.invalidatedKeys.clear()
  }
}

// 創建單例實例
const smartCacheInvalidator = new SmartCacheInvalidator()

export default smartCacheInvalidator
export { SmartCacheInvalidator }
