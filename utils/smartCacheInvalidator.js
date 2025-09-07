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
  // 原有的操作類型
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

  // 新增的快取操作類型
  SOCIAL_RELATIONSHIP: 'SOCIAL_RELATIONSHIP',
  COLLABORATIVE_UPDATE: 'COLLABORATIVE_UPDATE',
  SOCIAL_COLLABORATIVE_UPDATE: 'SOCIAL_COLLABORATIVE_UPDATE',
  CONTENT_INTERACTION: 'CONTENT_INTERACTION',
  HOT_SCORE_UPDATE: 'HOT_SCORE_UPDATE',
  POPULAR_CONTENT: 'POPULAR_CONTENT',
  USER_ACTIVITY: 'USER_ACTIVITY',

  // 用戶相關操作
  USER_NOTIFICATION_SETTINGS_UPDATE: 'USER_NOTIFICATION_SETTINGS_UPDATE',
  USER_PROFILE_UPDATE: 'USER_PROFILE_UPDATE',
  USER_PASSWORD_CHANGE: 'USER_PASSWORD_CHANGE',
  USER_EMAIL_CHANGE: 'USER_EMAIL_CHANGE',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_SOCIAL_BIND: 'USER_SOCIAL_BIND',
  USER_SOCIAL_UNBIND: 'USER_SOCIAL_UNBIND',

  // 偏好設定操作
  USER_THEME_UPDATE: 'USER_THEME_UPDATE',
  USER_LANGUAGE_UPDATE: 'USER_LANGUAGE_UPDATE',
  USER_PERSONALIZATION_UPDATE: 'USER_PERSONALIZATION_UPDATE',
  USER_SEARCH_PREFERENCES_UPDATE: 'USER_SEARCH_PREFERENCES_UPDATE',
  USER_PREFERENCES_CLEAR: 'USER_PREFERENCES_CLEAR',

  // 標籤操作
  TAG_CREATED: 'TAG_CREATED',
  TAG_UPDATED: 'TAG_UPDATED',
  TAG_DELETED: 'TAG_DELETED',
  TAG_MERGED: 'TAG_MERGED',
  TAG_BATCH_DELETED: 'TAG_BATCH_DELETED',
  TAG_STATUS_TOGGLED: 'TAG_STATUS_TOGGLED',

  // 迷因標籤關聯操作
  MEME_TAG_CREATED: 'MEME_TAG_CREATED',
  MEME_TAG_BATCH_CREATED: 'MEME_TAG_BATCH_CREATED',
  MEME_TAG_DELETED: 'MEME_TAG_DELETED',
  MEME_TAG_BATCH_DELETED: 'MEME_TAG_BATCH_DELETED',

  // 通知操作
  NOTIFICATION_MARK_READ: 'NOTIFICATION_MARK_READ',
  NOTIFICATION_MARK_ALL_READ: 'NOTIFICATION_MARK_ALL_READ',
  NOTIFICATION_DELETED: 'NOTIFICATION_DELETED',
  NOTIFICATION_BATCH_DELETED: 'NOTIFICATION_BATCH_DELETED',
  NOTIFICATION_STATUS_UPDATED: 'NOTIFICATION_STATUS_UPDATED',
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

        case CACHE_OPERATIONS.SOCIAL_RELATIONSHIP:
          await this.handleSocialRelationship(params)
          break

        case CACHE_OPERATIONS.COLLABORATIVE_UPDATE:
          await this.handleCollaborativeUpdate(params)
          break

        case CACHE_OPERATIONS.SOCIAL_COLLABORATIVE_UPDATE:
          await this.handleSocialCollaborativeUpdate(params)
          break

        case CACHE_OPERATIONS.CONTENT_INTERACTION:
          await this.handleContentInteraction(params)
          break

        case CACHE_OPERATIONS.HOT_SCORE_UPDATE:
          await this.handleHotScoreUpdate(params)
          break

        case CACHE_OPERATIONS.POPULAR_CONTENT:
          await this.handlePopularContent(params)
          break

        case CACHE_OPERATIONS.USER_ACTIVITY:
          await this.handleUserActivity(params)
          break

        // 用戶相關操作
        case CACHE_OPERATIONS.USER_NOTIFICATION_SETTINGS_UPDATE:
          await this.handleUserNotificationSettingsUpdate(params)
          break

        case CACHE_OPERATIONS.USER_PROFILE_UPDATE:
          await this.handleUserProfileUpdate(params)
          break

        case CACHE_OPERATIONS.USER_PASSWORD_CHANGE:
          await this.handleUserPasswordChange(params)
          break

        case CACHE_OPERATIONS.USER_EMAIL_CHANGE:
          await this.handleUserEmailChange(params)
          break

        case CACHE_OPERATIONS.USER_PASSWORD_RESET:
          await this.handleUserPasswordReset(params)
          break

        case CACHE_OPERATIONS.USER_SOCIAL_BIND:
          await this.handleUserSocialBind(params)
          break

        case CACHE_OPERATIONS.USER_SOCIAL_UNBIND:
          await this.handleUserSocialUnbind(params)
          break

        // 偏好設定操作
        case CACHE_OPERATIONS.USER_THEME_UPDATE:
          await this.handleUserThemeUpdate(params)
          break

        case CACHE_OPERATIONS.USER_LANGUAGE_UPDATE:
          await this.handleUserLanguageUpdate(params)
          break

        case CACHE_OPERATIONS.USER_PERSONALIZATION_UPDATE:
          await this.handleUserPersonalizationUpdate(params)
          break

        case CACHE_OPERATIONS.USER_SEARCH_PREFERENCES_UPDATE:
          await this.handleUserSearchPreferencesUpdate(params)
          break

        case CACHE_OPERATIONS.USER_PREFERENCES_CLEAR:
          await this.handleUserPreferencesClear(params)
          break

        // 標籤操作
        case CACHE_OPERATIONS.TAG_CREATED:
          await this.handleTagCreated(params)
          break

        case CACHE_OPERATIONS.TAG_UPDATED:
          await this.handleTagUpdated(params)
          break

        case CACHE_OPERATIONS.TAG_DELETED:
          await this.handleTagDeleted(params)
          break

        case CACHE_OPERATIONS.TAG_MERGED:
          await this.handleTagMerged(params)
          break

        case CACHE_OPERATIONS.TAG_BATCH_DELETED:
          await this.handleTagBatchDeleted(params)
          break

        case CACHE_OPERATIONS.TAG_STATUS_TOGGLED:
          await this.handleTagStatusToggled(params)
          break

        // 迷因標籤關聯操作
        case CACHE_OPERATIONS.MEME_TAG_CREATED:
          await this.handleMemeTagCreated(params)
          break

        case CACHE_OPERATIONS.MEME_TAG_BATCH_CREATED:
          await this.handleMemeTagBatchCreated(params)
          break

        case CACHE_OPERATIONS.MEME_TAG_DELETED:
          await this.handleMemeTagDeleted(params)
          break

        case CACHE_OPERATIONS.MEME_TAG_BATCH_DELETED:
          await this.handleMemeTagBatchDeleted(params)
          break

        // 通知操作
        case CACHE_OPERATIONS.NOTIFICATION_MARK_READ:
          await this.handleNotificationMarkRead(params)
          break

        case CACHE_OPERATIONS.NOTIFICATION_MARK_ALL_READ:
          await this.handleNotificationMarkAllRead(params)
          break

        case CACHE_OPERATIONS.NOTIFICATION_DELETED:
          await this.handleNotificationDeleted(params)
          break

        case CACHE_OPERATIONS.NOTIFICATION_BATCH_DELETED:
          await this.handleNotificationBatchDeleted(params)
          break

        case CACHE_OPERATIONS.NOTIFICATION_STATUS_UPDATED:
          await this.handleNotificationStatusUpdated(params)
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
   * 處理社交關係變化
   * @param {Object} params - 參數
   */
  async handleSocialRelationship(params) {
    const { userId, targetUserId, reason } = params

    if (!userId || !targetUserId) {
      logger.warn('SOCIAL_RELATIONSHIP 操作缺少必要參數', params)
      return
    }

    logger.info('處理社交關係變化快取失效', { userId, targetUserId, reason })

    // 1. 清除雙方用戶的個人化推薦快取
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    await this.invalidatePattern(`mixed_recommendations:${targetUserId}:*`)

    // 2. 清除社交協同過濾快取
    await this.invalidatePattern(`social_collaborative_filtering:${userId}:*`)
    await this.invalidatePattern(`social_collaborative_filtering:${targetUserId}:*`)

    // 3. 清除協同過濾快取（因為社交圖譜發生變化）
    await this.invalidatePattern(`collaborative_filtering:${userId}:*`)
    await this.invalidatePattern(`collaborative_filtering:${targetUserId}:*`)
  }

  /**
   * 處理協同過濾更新
   * @param {Object} params - 參數
   */
  async handleCollaborativeUpdate(params) {
    const { userId, memeId, reason } = params

    logger.info('處理協同過濾更新快取失效', { userId, memeId, reason })

    if (userId) {
      // 清除特定用戶的協同過濾快取
      await this.invalidatePattern(`collaborative_filtering:${userId}:*`)
      await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    } else {
      // 廣泛清除協同過濾快取（用於重大更新）
      await this.invalidatePattern('collaborative_filtering:*')
      await this.invalidatePattern('mixed_recommendations:*')
    }
  }

  /**
   * 處理社交協同過濾更新
   * @param {Object} params - 參數
   */
  async handleSocialCollaborativeUpdate(params) {
    const { userId, reason } = params

    if (!userId) {
      logger.warn('SOCIAL_COLLABORATIVE_UPDATE 操作缺少必要參數', params)
      return
    }

    logger.info('處理社交協同過濾更新快取失效', { userId, reason })

    // 1. 清除用戶的社交協同過濾快取
    await this.invalidatePattern(`social_collaborative_filtering:${userId}:*`)

    // 2. 清除用戶的混合推薦快取
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)

    // 3. 清除協同過濾快取
    await this.invalidatePattern(`collaborative_filtering:${userId}:*`)
  }

  /**
   * 處理內容互動
   * @param {Object} params - 參數
   */
  async handleContentInteraction(params) {
    const { userId, memeId, reason } = params

    logger.info('處理內容互動快取失效', { userId, memeId, reason })

    if (userId) {
      // 1. 清除用戶的內容基礎推薦快取
      await this.invalidatePattern(`content_based:${userId}:*`)
      await this.invalidatePattern(`mixed_recommendations:${userId}:*`)

      // 2. 清除用戶活躍度快取
      await this.invalidatePattern(`user_activity:${userId}`)
      await this.invalidatePattern(`cold_start:${userId}`)
    }

    if (memeId) {
      // 3. 清除包含特定迷因的推薦快取
      await this.invalidatePattern(`*:*${memeId}*`)
    }
  }

  /**
   * 處理熱門分數更新
   * @param {Object} params - 參數
   */
  async handleHotScoreUpdate(params) {
    const { memeId, reason } = params

    logger.info('處理熱門分數更新快取失效', { memeId, reason })

    // 1. 清除熱門推薦快取
    await this.invalidatePattern('hot_recommendations:*')
    await this.invalidatePattern('updated_recommendations:*')

    // 2. 清除熱門內容快取
    await this.invalidatePattern('popular_content:*')

    if (memeId) {
      // 3. 清除包含特定迷因的快取
      await this.invalidatePattern(`*:*${memeId}*`)
    }
  }

  /**
   * 處理熱門內容更新
   * @param {Object} params - 參數
   */
  async handlePopularContent(params) {
    const { memeId, reason } = params

    logger.info('處理熱門內容更新快取失效', { memeId, reason })

    // 1. 清除熱門內容快取
    await this.invalidatePattern('popular_content:*')
    await this.invalidatePattern('hot_recommendations:*')
    await this.invalidatePattern('latest_recommendations:*')

    if (memeId) {
      // 2. 清除包含特定迷因的快取
      await this.invalidatePattern(`*:*${memeId}*`)
    }
  }

  /**
   * 處理用戶活動
   * @param {Object} params - 參數
   */
  async handleUserActivity(params) {
    const { userId, reason } = params

    if (!userId) {
      logger.warn('USER_ACTIVITY 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶活動快取失效', { userId, reason })

    // 1. 清除用戶的個人化推薦快取
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
    await this.invalidatePattern(`content_based:${userId}:*`)
    await this.invalidatePattern(`collaborative_filtering:${userId}:*`)

    // 2. 清除用戶活躍度快取
    await this.invalidatePattern(`user_activity:${userId}`)
    await this.invalidatePattern(`cold_start:${userId}`)

    // 3. 清除用戶的瀏覽歷史快取
    await this.invalidatePattern(`user_view_history:${userId}`)
  }

  /**
   * 處理用戶通知設定更新
   * @param {Object} params - 參數
   */
  async handleUserNotificationSettingsUpdate(params) {
    const { userId } = params

    if (!userId) {
      logger.warn('USER_NOTIFICATION_SETTINGS_UPDATE 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶通知設定更新快取失效', { userId })

    // 1. 清除用戶的通知快取
    await this.invalidatePattern(`user_notifications:${userId}`)
    await this.invalidatePattern(`notification_stats:${userId}`)

    // 2. 清除用戶的快取（因為設定變更可能影響其他快取）
    await this.invalidatePattern(`user_cache:${userId}`)
    await this.invalidatePattern(`user_profile:${userId}`)
  }

  /**
   * 處理用戶個人資料更新
   * @param {Object} params - 參數
   */
  async handleUserProfileUpdate(params) {
    const { userId, changes } = params

    if (!userId) {
      logger.warn('USER_PROFILE_UPDATE 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶個人資料更新快取失效', { userId, changes })

    // 1. 清除用戶相關快取
    await this.invalidatePattern(`user_cache:${userId}`)
    await this.invalidatePattern(`user_profile:${userId}`)
    await this.invalidatePattern(`user_stats:${userId}`)

    // 2. 如果更新了顯示名稱或頭像，清除相關的搜尋快取
    if (changes && (changes.display_name || changes.avatar)) {
      await this.invalidatePattern('user_search:*')
      await this.invalidatePattern('active_users:*')
    }

    // 3. 清除用戶的個人化推薦快取（因為個人資料變化可能影響推薦）
    await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
  }

  /**
   * 處理用戶密碼變更
   * @param {Object} params - 參數
   */
  async handleUserPasswordChange(params) {
    const { userId } = params

    if (!userId) {
      logger.warn('USER_PASSWORD_CHANGE 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶密碼變更快取失效', { userId })

    // 1. 清除用戶的所有會話相關快取
    await this.invalidatePattern(`user_session:${userId}`)
    await this.invalidatePattern(`auth_tokens:${userId}`)

    // 2. 清除用戶的安全相關快取
    await this.invalidatePattern(`user_security:${userId}`)

    // 3. 清除用戶的認證快取
    await this.invalidatePattern(`user_auth:${userId}`)
  }

  /**
   * 處理用戶電子信箱變更
   * @param {Object} params - 參數
   */
  async handleUserEmailChange(params) {
    const { userId, oldEmail, newEmail } = params

    if (!userId) {
      logger.warn('USER_EMAIL_CHANGE 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶電子信箱變更快取失效', { userId, oldEmail, newEmail })

    // 1. 清除用戶相關快取
    await this.invalidatePattern(`user_cache:${userId}`)
    await this.invalidatePattern(`user_profile:${userId}`)

    // 2. 清除舊電子信箱相關快取
    if (oldEmail) {
      await this.invalidatePattern(`email_verification:${oldEmail}`)
      await this.invalidatePattern(`password_reset:${oldEmail}`)
    }

    // 3. 清除新電子信箱相關快取
    if (newEmail) {
      await this.invalidatePattern(`email_verification:${newEmail}`)
      await this.invalidatePattern(`password_reset:${newEmail}`)
    }

    // 4. 清除用戶的認證快取
    await this.invalidatePattern(`user_auth:${userId}`)
  }

  /**
   * 處理用戶密碼重設
   * @param {Object} params - 參數
   */
  async handleUserPasswordReset(params) {
    const { userId, email } = params

    if (!userId && !email) {
      logger.warn('USER_PASSWORD_RESET 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶密碼重設快取失效', { userId, email })

    // 1. 清除用戶的所有會話相關快取
    if (userId) {
      await this.invalidatePattern(`user_session:${userId}`)
      await this.invalidatePattern(`auth_tokens:${userId}`)
      await this.invalidatePattern(`user_auth:${userId}`)
    }

    // 2. 清除電子信箱相關的密碼重設快取
    if (email) {
      await this.invalidatePattern(`password_reset:${email}`)
      await this.invalidatePattern(`password_reset_token:*${email}*`)
    }

    // 3. 清除用戶的安全相關快取
    if (userId) {
      await this.invalidatePattern(`user_security:${userId}`)
    }
  }

  /**
   * 處理用戶社群帳號綁定
   * @param {Object} params - 參數
   */
  async handleUserSocialBind(params) {
    const { userId, provider } = params

    if (!userId || !provider) {
      logger.warn('USER_SOCIAL_BIND 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶社群帳號綁定快取失效', { userId, provider })

    // 1. 清除用戶相關快取
    await this.invalidatePattern(`user_cache:${userId}`)
    await this.invalidatePattern(`user_profile:${userId}`)

    // 2. 清除社群帳號相關快取
    await this.invalidatePattern(`social_bind:${userId}`)
    await this.invalidatePattern(`oauth_${provider}:${userId}`)

    // 3. 清除用戶的認證快取
    await this.invalidatePattern(`user_auth:${userId}`)
  }

  /**
   * 處理用戶社群帳號解除綁定
   * @param {Object} params - 參數
   */
  async handleUserSocialUnbind(params) {
    const { userId, provider } = params

    if (!userId || !provider) {
      logger.warn('USER_SOCIAL_UNBIND 操作缺少必要參數', params)
      return
    }

    logger.info('處理用戶社群帳號解除綁定快取失效', { userId, provider })

    // 1. 清除用戶相關快取
    await this.invalidatePattern(`user_cache:${userId}`)
    await this.invalidatePattern(`user_profile:${userId}`)

    // 2. 清除社群帳號相關快取
    await this.invalidatePattern(`social_bind:${userId}`)
    await this.invalidatePattern(`oauth_${provider}:${userId}`)

    // 3. 清除用戶的認證快取
    await this.invalidatePattern(`user_auth:${userId}`)
  }

  /**
   * 處理用戶主題偏好更新
   * @param {Object} params - 參數
   */
  async handleUserThemeUpdate(params) {
    const { userId, theme } = params

    logger.info('處理用戶主題偏好更新快取失效', { userId, theme })

    // 偏好設定通常不影響主要快取，但可以清除用戶偏好快取
    if (userId) {
      await this.invalidatePattern(`user_preferences:${userId}`)
    }
  }

  /**
   * 處理用戶語言偏好更新
   * @param {Object} params - 參數
   */
  async handleUserLanguageUpdate(params) {
    const { userId, language } = params

    logger.info('處理用戶語言偏好更新快取失效', { userId, language })

    // 語言設定通常不影響主要快取，但可以清除用戶偏好快取
    if (userId) {
      await this.invalidatePattern(`user_preferences:${userId}`)
    }
  }

  /**
   * 處理用戶個人化設定更新
   * @param {Object} params - 參數
   */
  async handleUserPersonalizationUpdate(params) {
    const { userId, personalization } = params

    logger.info('處理用戶個人化設定更新快取失效', { userId, personalization })

    // 個人化設定可能影響推薦系統，清除相關快取
    if (userId) {
      await this.invalidatePattern(`user_preferences:${userId}`)
      await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
      await this.invalidatePattern(`content_based:${userId}:*`)
    }
  }

  /**
   * 處理用戶搜尋偏好更新
   * @param {Object} params - 參數
   */
  async handleUserSearchPreferencesUpdate(params) {
    const { userId, searchPreferences } = params

    logger.info('處理用戶搜尋偏好更新快取失效', { userId, searchPreferences })

    // 搜尋偏好設定可能影響搜尋結果快取
    if (userId) {
      await this.invalidatePattern(`user_preferences:${userId}`)
      await this.invalidatePattern(`user_search:${userId}:*`)
    }
  }

  /**
   * 處理用戶偏好設定清除
   * @param {Object} params - 參數
   */
  async handleUserPreferencesClear(params) {
    const { userId } = params

    logger.info('處理用戶偏好設定清除快取失效', { userId })

    // 清除所有用戶偏好相關快取
    if (userId) {
      await this.invalidatePattern(`user_preferences:${userId}`)
      await this.invalidatePattern(`user_search:${userId}:*`)
      await this.invalidatePattern(`mixed_recommendations:${userId}:*`)
      await this.invalidatePattern(`content_based:${userId}:*`)
    }
  }

  /**
   * 處理標籤創建
   * @param {Object} params - 參數
   */
  async handleTagCreated(params) {
    const { tagId, tagName, lang } = params

    logger.info('處理標籤創建快取失效', { tagId, tagName, lang })

    // 1. 清除標籤列表快取
    await this.invalidatePattern('tags:*')
    await this.invalidatePattern(`tags:lang:${lang}*`)

    // 2. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)

    // 3. 清除標籤分類快取
    await this.invalidatePattern('tag_categories:*')
    await this.invalidatePattern(`tag_categories:lang:${lang}*`)

    // 4. 如果標籤名稱有特定格式，可能影響搜尋快取
    if (tagName) {
      await this.invalidatePattern(`tag_search:*${tagName}*`)
    }
  }

  /**
   * 處理標籤更新
   * @param {Object} params - 參數
   */
  async handleTagUpdated(params) {
    const { tagId, oldName, newName, lang, oldLang } = params

    logger.info('處理標籤更新快取失效', { tagId, oldName, newName, lang, oldLang })

    // 1. 清除標籤相關快取
    await this.invalidatePattern(`tag:${tagId}`)
    await this.invalidatePattern('tags:*')

    // 2. 如果語言改變，清除雙語快取
    if (oldLang !== lang) {
      await this.invalidatePattern(`tags:lang:${oldLang}*`)
    }
    await this.invalidatePattern(`tags:lang:${lang}*`)

    // 3. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)
    if (oldLang !== lang) {
      await this.invalidatePattern(`popular_tags:lang:${oldLang}*`)
    }

    // 4. 清除標籤分類快取
    await this.invalidatePattern('tag_categories:*')

    // 5. 如果名稱改變，清除相關搜尋快取
    if (oldName !== newName) {
      if (oldName) await this.invalidatePattern(`tag_search:*${oldName}*`)
      if (newName) await this.invalidatePattern(`tag_search:*${newName}*`)
    }
  }

  /**
   * 處理標籤刪除
   * @param {Object} params - 參數
   */
  async handleTagDeleted(params) {
    const { tagId, tagName, lang } = params

    logger.info('處理標籤刪除快取失效', { tagId, tagName, lang })

    // 1. 清除標籤相關快取
    await this.invalidatePattern(`tag:${tagId}`)
    await this.invalidatePattern('tags:*')
    await this.invalidatePattern(`tags:lang:${lang}*`)

    // 2. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)

    // 3. 清除標籤分類快取
    await this.invalidatePattern('tag_categories:*')
    await this.invalidatePattern(`tag_categories:lang:${lang}*`)

    // 4. 清除標籤搜尋快取
    if (tagName) {
      await this.invalidatePattern(`tag_search:*${tagName}*`)
    }

    // 5. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
  }

  /**
   * 處理標籤合併
   * @param {Object} params - 參數
   */
  async handleTagMerged(params) {
    const { primaryTagId, secondaryTagIds, primaryTagName, lang } = params

    logger.info('處理標籤合併快取失效', { primaryTagId, secondaryTagIds, primaryTagName, lang })

    // 1. 清除主要標籤快取
    await this.invalidatePattern(`tag:${primaryTagId}`)

    // 2. 清除次要標籤快取
    if (Array.isArray(secondaryTagIds)) {
      for (const tagId of secondaryTagIds) {
        await this.invalidatePattern(`tag:${tagId}`)
      }
    }

    // 3. 清除標籤列表快取
    await this.invalidatePattern('tags:*')
    await this.invalidatePattern(`tags:lang:${lang}*`)

    // 4. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)

    // 5. 清除標籤分類快取
    await this.invalidatePattern('tag_categories:*')
    await this.invalidatePattern(`tag_categories:lang:${lang}*`)

    // 6. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
  }

  /**
   * 處理標籤批量刪除
   * @param {Object} params - 參數
   */
  async handleTagBatchDeleted(params) {
    const { tagIds, lang } = params

    logger.info('處理標籤批量刪除快取失效', { tagIds, lang })

    // 1. 清除個別標籤快取
    if (Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        await this.invalidatePattern(`tag:${tagId}`)
      }
    }

    // 2. 清除標籤列表快取
    await this.invalidatePattern('tags:*')
    await this.invalidatePattern(`tags:lang:${lang}*`)

    // 3. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)

    // 4. 清除標籤分類快取
    await this.invalidatePattern('tag_categories:*')
    await this.invalidatePattern(`tag_categories:lang:${lang}*`)

    // 5. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
  }

  /**
   * 處理標籤狀態切換
   * @param {Object} params - 參數
   */
  async handleTagStatusToggled(params) {
    const { tagId, newStatus, oldStatus, tagName, lang } = params

    logger.info('處理標籤狀態切換快取失效', { tagId, newStatus, oldStatus, tagName, lang })

    // 1. 清除標籤快取
    await this.invalidatePattern(`tag:${tagId}`)

    // 2. 清除標籤列表快取
    await this.invalidatePattern('tags:*')
    await this.invalidatePattern(`tags:lang:${lang}*`)

    // 3. 清除熱門標籤快取（狀態改變可能影響熱門排序）
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)

    // 4. 清除標籤分類快取
    await this.invalidatePattern('tag_categories:*')
    await this.invalidatePattern(`tag_categories:lang:${lang}*`)

    // 5. 如果標籤被停用，清除相關搜尋快取
    if (newStatus === 'archived' && tagName) {
      await this.invalidatePattern(`tag_search:*${tagName}*`)
    }
  }

  /**
   * 處理迷因標籤關聯創建
   * @param {Object} params - 參數
   */
  async handleMemeTagCreated(params) {
    const { memeId, tagId, tagIds, lang } = params

    logger.info('處理迷因標籤關聯創建快取失效', { memeId, tagId, tagIds, lang })

    // 1. 清除迷因相關快取
    await this.invalidatePattern(`meme:${memeId}`)
    await this.invalidatePattern(`meme_tags:${memeId}*`)

    // 2. 清除標籤相關快取
    if (tagId) {
      await this.invalidatePattern(`tag:${tagId}`)
      await this.invalidatePattern(`tag_usage:${tagId}*`)
      await this.invalidatePattern(`memes_by_tag:${tagId}*`)
    }

    // 3. 如果是批量操作，清除所有相關標籤快取
    if (Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        await this.invalidatePattern(`tag:${tagId}`)
        await this.invalidatePattern(`tag_usage:${tagId}*`)
        await this.invalidatePattern(`memes_by_tag:${tagId}*`)
      }
    }

    // 4. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
    await this.invalidatePattern(`tag_stats:lang:${lang}*`)

    // 5. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)
  }

  /**
   * 處理迷因標籤關聯批量創建
   * @param {Object} params - 參數
   */
  async handleMemeTagBatchCreated(params) {
    const { memeId, tagIds, lang } = params

    logger.info('處理迷因標籤關聯批量創建快取失效', { memeId, tagIds, lang })

    // 1. 清除迷因相關快取
    await this.invalidatePattern(`meme:${memeId}`)
    await this.invalidatePattern(`meme_tags:${memeId}*`)

    // 2. 清除所有標籤相關快取
    if (Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        await this.invalidatePattern(`tag:${tagId}`)
        await this.invalidatePattern(`tag_usage:${tagId}*`)
        await this.invalidatePattern(`memes_by_tag:${tagId}*`)
      }
    }

    // 3. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
    await this.invalidatePattern(`tag_stats:lang:${lang}*`)

    // 4. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)
  }

  /**
   * 處理迷因標籤關聯刪除
   * @param {Object} params - 參數
   */
  async handleMemeTagDeleted(params) {
    const { memeId, tagId, lang } = params

    logger.info('處理迷因標籤關聯刪除快取失效', { memeId, tagId, lang })

    // 1. 清除迷因相關快取
    await this.invalidatePattern(`meme:${memeId}`)
    await this.invalidatePattern(`meme_tags:${memeId}*`)

    // 2. 清除標籤相關快取
    if (tagId) {
      await this.invalidatePattern(`tag:${tagId}`)
      await this.invalidatePattern(`tag_usage:${tagId}*`)
      await this.invalidatePattern(`memes_by_tag:${tagId}*`)
    }

    // 3. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
    await this.invalidatePattern(`tag_stats:lang:${lang}*`)

    // 4. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)
  }

  /**
   * 處理迷因標籤關聯批量刪除
   * @param {Object} params - 參數
   */
  async handleMemeTagBatchDeleted(params) {
    const { memeId, lang } = params

    logger.info('處理迷因標籤關聯批量刪除快取失效', { memeId, lang })

    // 1. 清除迷因相關快取
    await this.invalidatePattern(`meme:${memeId}`)
    await this.invalidatePattern(`meme_tags:${memeId}*`)

    // 2. 清除標籤統計快取
    await this.invalidatePattern('tag_stats:*')
    await this.invalidatePattern(`tag_stats:lang:${lang}*`)

    // 3. 清除熱門標籤快取
    await this.invalidatePattern('popular_tags:*')
    await this.invalidatePattern(`popular_tags:lang:${lang}*`)

    // 4. 清除與該迷因相關的所有標籤快取
    await this.invalidatePattern(`tag_usage:*`)
    await this.invalidatePattern(`memes_by_tag:*`)
  }

  /**
   * 處理通知標記為已讀
   * @param {Object} params - 參數
   */
  async handleNotificationMarkRead(params) {
    const { userId, notificationId, receiptId } = params

    logger.info('處理通知標記為已讀快取失效', { userId, notificationId, receiptId })

    if (!userId) {
      logger.warn('NOTIFICATION_MARK_READ 操作缺少必要參數', params)
      return
    }

    // 1. 清除用戶通知快取
    await this.invalidatePattern(`user_notifications:${userId}`)
    await this.invalidatePattern(`notification_receipts:${userId}*`)

    // 2. 清除通知統計快取
    await this.invalidatePattern(`notification_stats:${userId}`)
    await this.invalidatePattern(`unread_count:${userId}`)

    // 3. 清除特定通知快取
    if (receiptId) {
      await this.invalidatePattern(`notification_receipt:${receiptId}`)
    }
    if (notificationId) {
      await this.invalidatePattern(`notification:${notificationId}`)
    }
  }

  /**
   * 處理全部通知標記為已讀
   * @param {Object} params - 參數
   */
  async handleNotificationMarkAllRead(params) {
    const { userId } = params

    if (!userId) {
      logger.warn('NOTIFICATION_MARK_ALL_READ 操作缺少必要參數', params)
      return
    }

    logger.info('處理全部通知標記為已讀快取失效', { userId })

    // 1. 清除用戶所有通知快取
    await this.invalidatePattern(`user_notifications:${userId}`)
    await this.invalidatePattern(`notification_receipts:${userId}*`)

    // 2. 清除通知統計快取
    await this.invalidatePattern(`notification_stats:${userId}`)
    await this.invalidatePattern(`unread_count:${userId}`)
  }

  /**
   * 處理通知刪除
   * @param {Object} params - 參數
   */
  async handleNotificationDeleted(params) {
    const { userId, notificationId, receiptId } = params

    logger.info('處理通知刪除快取失效', { userId, notificationId, receiptId })

    if (!userId) {
      logger.warn('NOTIFICATION_DELETED 操作缺少必要參數', params)
      return
    }

    // 1. 清除用戶通知快取
    await this.invalidatePattern(`user_notifications:${userId}`)
    await this.invalidatePattern(`notification_receipts:${userId}*`)

    // 2. 清除通知統計快取
    await this.invalidatePattern(`notification_stats:${userId}`)
    await this.invalidatePattern(`unread_count:${userId}`)

    // 3. 清除特定通知快取
    if (receiptId) {
      await this.invalidatePattern(`notification_receipt:${receiptId}`)
    }
    if (notificationId) {
      await this.invalidatePattern(`notification:${notificationId}`)
    }
  }

  /**
   * 處理通知批量刪除
   * @param {Object} params - 參數
   */
  async handleNotificationBatchDeleted(params) {
    const { userId, notificationIds, receiptIds } = params

    logger.info('處理通知批量刪除快取失效', { userId, notificationIds, receiptIds })

    if (!userId) {
      logger.warn('NOTIFICATION_BATCH_DELETED 操作缺少必要參數', params)
      return
    }

    // 1. 清除用戶通知快取
    await this.invalidatePattern(`user_notifications:${userId}`)
    await this.invalidatePattern(`notification_receipts:${userId}*`)

    // 2. 清除通知統計快取
    await this.invalidatePattern(`notification_stats:${userId}`)
    await this.invalidatePattern(`unread_count:${userId}`)

    // 3. 清除特定通知快取
    if (Array.isArray(receiptIds)) {
      for (const receiptId of receiptIds) {
        await this.invalidatePattern(`notification_receipt:${receiptId}`)
      }
    }
    if (Array.isArray(notificationIds)) {
      for (const notificationId of notificationIds) {
        await this.invalidatePattern(`notification:${notificationId}`)
      }
    }
  }

  /**
   * 處理通知狀態更新
   * @param {Object} params - 參數
   */
  async handleNotificationStatusUpdated(params) {
    const { userId, notificationId, receiptId, status } = params

    logger.info('處理通知狀態更新快取失效', { userId, notificationId, receiptId, status })

    if (!userId) {
      logger.warn('NOTIFICATION_STATUS_UPDATED 操作缺少必要參數', params)
      return
    }

    // 1. 清除用戶通知快取
    await this.invalidatePattern(`user_notifications:${userId}`)
    await this.invalidatePattern(`notification_receipts:${userId}*`)

    // 2. 清除通知統計快取
    await this.invalidatePattern(`notification_stats:${userId}`)
    await this.invalidatePattern(`unread_count:${userId}`)

    // 3. 清除特定通知快取
    if (receiptId) {
      await this.invalidatePattern(`notification_receipt:${receiptId}`)
    }
    if (notificationId) {
      await this.invalidatePattern(`notification:${notificationId}`)
    }
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
