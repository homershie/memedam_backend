import Notification from '../models/Notification.js'
import NotificationReceipt from '../models/NotificationReceipt.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'

// 輔助函數：在測試環境中禁用事務
const createSession = async (Model) => {
  if (process.env.NODE_ENV === 'test') {
    return null
  }
  try {
    return await Model.startSession()
  } catch (error) {
    console.warn('無法創建 MongoDB 事務會話，將使用非事務模式:', error.message)
    return null
  }
}

const withTransaction = async (session, operation) => {
  if (process.env.NODE_ENV === 'test') {
    return await operation()
  }

  if (!session) {
    return await operation()
  }

  session.startTransaction()
  try {
    const result = await operation()
    await session.commitTransaction()
    return result
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// 通知類型常數
export const NOTIFICATION_TYPES = {
  NEW_FOLLOWER: 'new_follower',
  NEW_COMMENT: 'new_comment',
  NEW_LIKE: 'new_like',
  NEW_MENTION: 'new_mention',
  HOT_CONTENT: 'hot_content',
  WEEKLY_SUMMARY: 'weekly_summary',
  REPORT_SUBMITTED: 'report_submitted',
  REPORT_PROCESSED: 'report_processed',
  REPORT_REJECTED: 'report_rejected',
  AUTHOR_WARNED: 'author_warned',
  AUTHOR_STRUCK: 'author_struck',
  CONTENT_REMOVED: 'content_removed',
  CONTENT_HIDDEN: 'content_hidden',
  COMMENTS_LOCKED: 'comments_locked',
}

// 動作類型映射
export const VERB_MAPPING = {
  [NOTIFICATION_TYPES.NEW_FOLLOWER]: 'follow',
  [NOTIFICATION_TYPES.NEW_COMMENT]: 'comment',
  [NOTIFICATION_TYPES.NEW_LIKE]: 'like',
  [NOTIFICATION_TYPES.NEW_MENTION]: 'mention',
  [NOTIFICATION_TYPES.HOT_CONTENT]: 'system',
  [NOTIFICATION_TYPES.WEEKLY_SUMMARY]: 'system',
  [NOTIFICATION_TYPES.REPORT_SUBMITTED]: 'report',
  [NOTIFICATION_TYPES.REPORT_PROCESSED]: 'report',
  [NOTIFICATION_TYPES.REPORT_REJECTED]: 'report',
  [NOTIFICATION_TYPES.AUTHOR_WARNED]: 'report',
  [NOTIFICATION_TYPES.AUTHOR_STRUCK]: 'report',
  [NOTIFICATION_TYPES.CONTENT_REMOVED]: 'report',
  [NOTIFICATION_TYPES.CONTENT_HIDDEN]: 'report',
  [NOTIFICATION_TYPES.COMMENTS_LOCKED]: 'report',
}

/**
 * 取得前端URL，支援環境變數
 * @returns {String} 前端URL
 */
const getFrontendUrl = () => {
  // 優先使用環境變數
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL
  }

  // 環境判斷
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:5173'
  }

  // 生產環境預設使用 memedam.com
  return 'https://memedam.com'
}

/**
 * 檢查用戶是否允許接收此類型的通知
 * @param {String} userId - 用戶ID
 * @param {String} notificationType - 通知類型
 * @returns {Boolean} - 是否允許接收通知
 */
const checkNotificationPermission = async (userId, notificationType) => {
  try {
    const user = await User.findById(userId, 'notificationSettings')
    if (!user) {
      console.log(`用戶 ${userId} 不存在，跳過通知發送`)
      return false
    }

    const settings = user.notificationSettings || {}

    switch (notificationType) {
      case NOTIFICATION_TYPES.NEW_FOLLOWER:
        return settings.newFollower !== false // 預設允許，除非明確設為false
      case NOTIFICATION_TYPES.NEW_COMMENT:
        return settings.newComment !== false
      case NOTIFICATION_TYPES.NEW_LIKE:
        return settings.newLike !== false
      case NOTIFICATION_TYPES.NEW_MENTION:
        return settings.newMention !== false
      case NOTIFICATION_TYPES.HOT_CONTENT:
        return settings.trendingContent === true // 需要明確設為 true 才發送
      case NOTIFICATION_TYPES.WEEKLY_SUMMARY:
        return settings.weeklyDigest !== false
      default:
        return true // 預設允許
    }
  } catch (error) {
    console.error('檢查通知權限失敗:', error)
    // 錯誤時預設允許發送通知，避免因權限檢查失敗而失去重要通知
    return true
  }
}

/**
 * 建立通知事件並為指定用戶建立收件項
 * @param {Object} eventData - 通知事件資料
 * @param {string[]} userIds - 收件者ID陣列
 * @param {Object} options - 選項
 * @param {boolean} options.checkPermission - 是否檢查權限（預設true）
 * @param {string} options.notificationType - 通知類型（用於權限檢查）
 * @returns {Promise<Object>} 建立結果
 */
export const createNotificationEvent = async (eventData, userIds, options = {}) => {
  const { checkPermission = true, notificationType } = options

  // 如果指定了通知類型且需要檢查權限，則過濾用戶
  let filteredUserIds = userIds
  if (checkPermission && notificationType) {
    const permissionPromises = userIds.map(async (userId) => {
      const hasPermission = await checkNotificationPermission(userId, notificationType)
      return hasPermission ? userId : null
    })

    const results = await Promise.all(permissionPromises)
    filteredUserIds = results.filter((id) => id !== null)
  }

  if (filteredUserIds.length === 0) {
    return {
      success: true,
      notification: null,
      receiptCount: 0,
      skippedCount: userIds.length - filteredUserIds.length,
    }
  }

  const session = await createSession(Notification)

  return await withTransaction(session, async () => {
    // 建立通知事件
    const notification = new Notification(eventData)
    await notification.save(session ? { session } : {})

    // 為所有收件者建立收件項
    const receiptPromises = filteredUserIds.map((userId) => {
      const receipt = new NotificationReceipt({
        notification_id: notification._id,
        user_id: userId,
      })
      return receipt.save(session ? { session } : {})
    })

    await Promise.all(receiptPromises)

    return {
      success: true,
      notification,
      receiptCount: filteredUserIds.length,
      skippedCount: userIds.length - filteredUserIds.length,
    }
  })
}

/**
 * 為現有通知事件添加新的收件項
 * @param {string} notificationId - 通知事件ID
 * @param {string[]} userIds - 新的收件者ID陣列
 * @returns {Promise<Object>} 添加結果
 */
export const addReceiptsToNotification = async (notificationId, userIds) => {
  const session = await createSession(NotificationReceipt)

  return await withTransaction(session, async () => {
    // 檢查通知事件是否存在
    const notification = await Notification.findById(notificationId).session(session || {})
    if (!notification) {
      throw new Error('通知事件不存在')
    }

    // 檢查哪些用戶已有收件項
    const existingReceipts = await NotificationReceipt.find({
      notification_id: notificationId,
      user_id: { $in: userIds },
    }).session(session || {})

    const existingUserIds = existingReceipts.map((receipt) => receipt.user_id.toString())
    const newUserIds = userIds.filter((userId) => !existingUserIds.includes(userId.toString()))

    // 為新用戶建立收件項
    const receiptPromises = newUserIds.map((userId) => {
      const receipt = new NotificationReceipt({
        notification_id: notificationId,
        user_id: userId,
      })
      return receipt.save(session ? { session } : {})
    })

    await Promise.all(receiptPromises)

    return {
      success: true,
      addedCount: newUserIds.length,
      totalReceipts: existingReceipts.length + newUserIds.length,
    }
  })
}

/**
 * 批量建立通知事件（用於系統通知）
 * @param {Object} eventData - 通知事件資料
 * @param {Object} options - 選項
 * @param {boolean} options.allUsers - 是否發送給所有用戶
 * @param {string[]} options.userIds - 指定用戶ID陣列
 * @param {Object} options.userFilter - 用戶篩選條件
 * @param {boolean} options.checkPermission - 是否檢查權限
 * @param {string} options.notificationType - 通知類型（用於權限檢查）
 * @returns {Promise<Object>} 建立結果
 */
export const createBulkNotification = async (eventData, options = {}) => {
  const { allUsers, userIds, userFilter = {}, checkPermission = true, notificationType } = options

  const session = await createSession(Notification)

  return await withTransaction(session, async () => {
    // 建立通知事件
    const notification = new Notification(eventData)
    await notification.save(session ? { session } : {})

    let targetUserIds = []

    if (allUsers) {
      // 查詢所有活躍用戶
      const users = await User.find({
        isActive: true,
        ...userFilter,
      })
        .select('_id notificationSettings')
        .session(session || {})

      if (checkPermission && notificationType) {
        // 過濾有權限的用戶
        const permissionPromises = users.map(async (user) => {
          const hasPermission = await checkNotificationPermission(user._id, notificationType)
          return hasPermission ? user._id : null
        })

        const results = await Promise.all(permissionPromises)
        targetUserIds = results.filter((id) => id !== null)
      } else {
        targetUserIds = users.map((user) => user._id)
      }
    } else if (userIds && userIds.length > 0) {
      if (checkPermission && notificationType) {
        // 過濾有權限的用戶
        const permissionPromises = userIds.map(async (userId) => {
          const hasPermission = await checkNotificationPermission(userId, notificationType)
          return hasPermission ? userId : null
        })

        const results = await Promise.all(permissionPromises)
        targetUserIds = results.filter((id) => id !== null)
      } else {
        targetUserIds = userIds
      }
    } else {
      throw new Error('必須提供條件：allUsers 或 userIds')
    }

    // 批量建立收件項
    const receiptPromises = targetUserIds.map((userId) => {
      const receipt = new NotificationReceipt({
        notification_id: notification._id,
        user_id: userId,
      })
      return receipt.save(session ? { session } : {})
    })

    await Promise.all(receiptPromises)

    return {
      success: true,
      notification,
      receiptCount: targetUserIds.length,
    }
  })
}

/**
 * 建立用戶互動通知（如點讚、評論等）
 * @param {Object} interactionData - 互動資料
 * @param {string} interactionData.actorId - 觸發者ID
 * @param {string} interactionData.verb - 動作類型
 * @param {string} interactionData.objectType - 物件類型
 * @param {string} interactionData.objectId - 物件ID
 * @param {string} interactionData.recipientId - 收件者ID
 * @param {Object} interactionData.payload - 額外資料
 * @param {Object} interactionData.options - 選項
 * @returns {Promise<Object>} 建立結果
 */
export const createInteractionNotification = async (interactionData) => {
  const {
    actorId,
    verb,
    objectType,
    objectId,
    recipientId,
    payload = {},
    options = {},
  } = interactionData

  // 檢查是否已有相關的互動通知（24小時內）
  const now = new Date()
  const twentyFourHoursAgo = new Date(now)
  twentyFourHoursAgo.setHours(now.getHours() - 24)

  console.log('🔍 調試日期查詢:', {
    now: now.toISOString(),
    twentyFourHoursAgo: twentyFourHoursAgo.toISOString(),
    twentyFourHoursAgoType: typeof twentyFourHoursAgo,
    query: {
      actor_id: actorId,
      verb,
      object_type: objectType,
      object_id: objectId,
      createdAt: mongoose.trusted({ $gte: twentyFourHoursAgo }),
    },
  })

  // 檢查日期對象是否正確
  if (!(twentyFourHoursAgo instanceof Date) || isNaN(twentyFourHoursAgo)) {
    console.error('❌ 日期對象無效:', twentyFourHoursAgo)
    throw new Error('日期對象創建失敗')
  }

  const existingNotification = await Notification.findOne({
    actor_id: actorId,
    verb,
    object_type: objectType,
    object_id: objectId,
    createdAt: mongoose.trusted({ $gte: twentyFourHoursAgo }),
  })

  if (existingNotification) {
    // 檢查收件者是否已有收件項
    const existingReceipt = await NotificationReceipt.findOne({
      notification_id: existingNotification._id,
      user_id: recipientId,
      deleted_at: null,
    })

    if (existingReceipt) {
      logger.debug(`發現重複通知，跳過創建`, {
        actorId,
        verb,
        objectType,
        objectId,
        recipientId,
        existingNotificationId: existingNotification._id,
      })
      return {
        success: true,
        notification: existingNotification,
        receipt: existingReceipt,
        isDuplicate: true,
      }
    }

    // 為現有通知添加收件項
    const result = await addReceiptsToNotification(existingNotification._id, [recipientId])
    logger.debug(`為現有通知添加收件項`, {
      actorId,
      verb,
      objectType,
      objectId,
      recipientId,
      existingNotificationId: existingNotification._id,
      addedCount: result.addedCount,
    })
    return {
      success: true,
      notification: existingNotification,
      receiptCount: result.addedCount,
      isDuplicate: true,
    }
  }

  // 建立新的互動通知
  const eventData = {
    actor_id: actorId,
    verb,
    object_type: objectType,
    object_id: objectId,
    payload,
  }

  // 根據動作類型設置標題和內容
  if (verb === 'follow') {
    eventData.title = '新追蹤者'
    eventData.content = '開始追蹤您'
    eventData.url = `${getFrontendUrl()}/users/${payload.followed_username || recipientId}`
  } else if (verb === 'like') {
    eventData.title = '新讚'
    eventData.content = '喜歡了您的迷因'
    // 獲取meme的slug用於生成正確的連結
    if (objectType === 'meme' && objectId) {
      const meme = await Meme.findById(objectId, 'slug title')
      const memeSlug = meme?.slug || objectId
      eventData.url = `${getFrontendUrl()}/memes/detail/${memeSlug}`
    }
  } else if (verb === 'comment') {
    eventData.title = '新評論'
    eventData.content = '評論了您的迷因'
    // 獲取meme的slug用於生成正確的連結
    if (objectType === 'meme' && objectId) {
      const meme = await Meme.findById(objectId, 'slug title')
      const memeSlug = meme?.slug || objectId
      eventData.url = `${getFrontendUrl()}/memes/detail/${memeSlug}`
    }
  } else if (verb === 'mention') {
    eventData.title = '提及'
    eventData.content = '在內容中提及了您'
    // 獲取meme的slug用於生成正確的連結
    if (objectType === 'meme' && objectId) {
      const meme = await Meme.findById(objectId, 'slug title')
      const memeSlug = meme?.slug || objectId
      eventData.url = `${getFrontendUrl()}/memes/detail/${memeSlug}`
    }
  }

  return await createNotificationEvent(eventData, [recipientId], options)
}

// ========== 具體功能函數 ==========

/**
 * 新追蹤者通知
 * @param {String} followedUserId - 被追蹤的用戶ID
 * @param {String} followerUserId - 追蹤者ID
 */
export const createNewFollowerNotification = async (followedUserId, followerUserId) => {
  try {
    // 使用互動通知來實現去重
    return await createInteractionNotification({
      actorId: followerUserId,
      verb: VERB_MAPPING[NOTIFICATION_TYPES.NEW_FOLLOWER],
      objectType: 'user',
      objectId: followedUserId,
      recipientId: followedUserId,
      payload: {
        follower_id: followerUserId,
      },
      options: {
        notificationType: NOTIFICATION_TYPES.NEW_FOLLOWER,
      },
    })
  } catch (error) {
    console.error('建立新追蹤者通知失敗:', error)
  }
}

/**
 * 新評論通知
 * @param {String} memeId - 迷因ID
 * @param {String} commentUserId - 評論者ID
 * @param {String} commentContent - 評論內容
 */
export const createNewCommentNotification = async (memeId, commentUserId, commentContent) => {
  try {
    // 獲取迷因資訊和作者
    const meme = await Meme.findById(memeId, 'author_id title').populate(
      'author_id',
      'username display_name',
    )
    if (!meme || !meme.author_id) {
      console.log('找不到迷因或作者:', memeId)
      return null
    }

    // 不給自己發送通知
    if (meme.author_id._id.toString() === commentUserId.toString()) {
      console.log('跳過自己評論自己的迷因')
      return null
    }

    // 獲取評論者資訊
    const commenter = await User.findById(commentUserId, 'username display_name')
    if (!commenter) {
      console.log('找不到評論者:', commentUserId)
      return null
    }

    const commenterName = commenter.display_name || commenter.username
    const truncatedContent =
      commentContent.length > 50 ? commentContent.substring(0, 50) + '...' : commentContent
    const frontendUrl = getFrontendUrl()

    // 獲取meme的slug用於生成正確的連結
    const memeForUrl = await Meme.findById(memeId, 'slug title')
    const memeSlug = memeForUrl?.slug || memeId

    const eventData = {
      actor_id: commentUserId,
      verb: VERB_MAPPING[NOTIFICATION_TYPES.NEW_COMMENT],
      object_type: 'meme',
      object_id: memeId,
      title: '新評論',
      content: `${commenterName} 對您的迷因評論：「${truncatedContent}」`,
      url: `${frontendUrl}/memes/detail/${memeSlug}`,
      payload: {
        meme_id: memeId,
        comment_user_id: commentUserId,
        comment_content: commentContent,
        commenter_name: commenterName,
      },
    }

    const result = await createNotificationEvent(eventData, [meme.author_id._id], {
      notificationType: NOTIFICATION_TYPES.NEW_COMMENT,
    })

    return result
  } catch (error) {
    console.error('建立新評論通知失敗:', error)
    return null
  }
}

/**
 * 新讚通知
 * @param {String} memeId - 迷因ID
 * @param {String} likerUserId - 按讚者ID
 */
export const createNewLikeNotification = async (memeId, likerUserId) => {
  try {
    console.log('🚀 開始執行 createNewLikeNotification 函數 - 修復版本 2025-09-06')
    logger.info(`準備建立按讚通知`, {
      memeId,
      likerUserId,
      event: 'like_notification_start',
    })

    // 驗證參數
    if (!memeId || !likerUserId) {
      logger.warn(`建立按讚通知參數缺失`, {
        memeId,
        likerUserId,
        event: 'like_notification_invalid_params',
      })
      return { success: false, error: '參數缺失' }
    }

    // 獲取迷因資訊和作者
    const meme = await Meme.findById(memeId, 'author_id title').populate(
      'author_id',
      'username display_name notificationSettings',
    )
    if (!meme || !meme.author_id) {
      logger.warn(`迷因不存在或無作者`, {
        memeId,
        event: 'like_notification_meme_not_found',
      })
      return { success: false, error: '迷因不存在' }
    }

    // 不給自己發送通知
    if (meme.author_id._id.toString() === likerUserId.toString()) {
      logger.info(`跳過自己給自己的通知`, {
        memeId,
        authorId: meme.author_id._id,
        likerId: likerUserId,
        event: 'like_notification_self_like',
      })
      return { success: true, skipped: true, reason: 'self_like' }
    }

    // 檢查用戶的通知設定
    const hasPermission = await checkNotificationPermission(
      meme.author_id._id,
      NOTIFICATION_TYPES.NEW_LIKE,
    )

    if (!hasPermission) {
      logger.info(`用戶已關閉按讚通知`, {
        memeId,
        recipientId: meme.author_id._id,
        event: 'like_notification_disabled',
      })
      return { success: true, skipped: true, reason: 'notification_disabled' }
    }

    // 使用互動通知來實現去重
    const result = await createInteractionNotification({
      actorId: likerUserId,
      verb: VERB_MAPPING[NOTIFICATION_TYPES.NEW_LIKE],
      objectType: 'meme',
      objectId: memeId,
      recipientId: meme.author_id._id,
      payload: {
        meme_id: memeId,
        liker_user_id: likerUserId,
        meme_title: meme.title,
      },
      options: {
        notificationType: NOTIFICATION_TYPES.NEW_LIKE,
      },
    })

    logger.info(`按讚通知建立成功`, {
      memeId,
      likerUserId,
      recipientId: meme.author_id._id,
      notificationId: result?.notification?._id,
      isDuplicate: result?.isDuplicate,
      event: 'like_notification_success',
    })

    return { success: true, result }
  } catch (error) {
    logger.error(`建立新讚通知失敗`, {
      error: error.message,
      stack: error.stack,
      memeId,
      likerUserId,
      event: 'like_notification_error',
    })

    // 不拋出錯誤，避免影響按讚功能，但返回錯誤資訊
    return { success: false, error: error.message }
  }
}

/**
 * 提及通知
 * @param {String} content - 提及內容
 * @param {String} mentionerUserId - 提及者ID
 * @param {String} memeId - 迷因ID（可選）
 * @param {String} contextType - 上下文類型（comment, meme等）
 */
export const createMentionNotifications = async (
  content,
  mentionerUserId,
  memeId = null,
  contextType = 'comment',
) => {
  try {
    // 使用正則表達式找出所有提及的用戶
    const mentionRegex = /@(\w+)/g
    const mentions = content.match(mentionRegex)

    if (!mentions || mentions.length === 0) return

    // 獲取提及者資訊
    const mentioner = await User.findById(mentionerUserId, 'username display_name')
    if (!mentioner) return

    const mentionerName = mentioner.display_name || mentioner.username
    const frontendUrl = getFrontendUrl()

    // 如果有memeId，先獲取meme資訊
    let memeSlug = null
    if (memeId) {
      const meme = await Meme.findById(memeId, 'slug title')
      memeSlug = meme?.slug || memeId // 如果沒有slug，使用ID作為fallback
    }

    // 處理每個被提及的用戶
    for (const mention of mentions) {
      const username = mention.substring(1) // 移除 @ 符號

      // 查找被提及的用戶
      const mentionedUser = await User.findOne({ username }, '_id username display_name')
      if (!mentionedUser) continue

      // 不給自己發送通知
      if (mentionedUser._id.toString() === mentionerUserId.toString()) continue

      // 檢查通知權限
      const hasPermission = await checkNotificationPermission(
        mentionedUser._id,
        NOTIFICATION_TYPES.NEW_MENTION,
      )

      if (!hasPermission) continue

      let notificationContent = `${mentionerName} 在${contextType === 'comment' ? '評論' : '內容'}中提及了您`
      let url = memeSlug ? `${frontendUrl}/memes/detail/${memeSlug}` : `${frontendUrl}/`

      const eventData = {
        actor_id: mentionerUserId,
        verb: VERB_MAPPING[NOTIFICATION_TYPES.NEW_MENTION],
        object_type: memeId ? 'meme' : 'user',
        object_id: memeId || mentionedUser._id,
        title: '提及',
        content: notificationContent,
        url: url,
        payload: {
          mentioned_in_content: content,
          context_type: contextType,
          meme_id: memeId,
          mentioner_name: mentionerName,
        },
      }

      await createNotificationEvent(eventData, [mentionedUser._id], {
        notificationType: NOTIFICATION_TYPES.NEW_MENTION,
      })
    }

    return { success: true }
  } catch (error) {
    console.error('建立提及通知失敗:', error)
    return { success: false, error: error.message }
  }
}

// 向後相容的別名，舊程式仍可呼叫 notifyMentionedUsers
export const notifyMentionedUsers = (
  content,
  mentionerUserId,
  memeId = null,
  contextType = 'comment',
) => createMentionNotifications(content, mentionerUserId, memeId, contextType)

/**
 * 熱門內容通知（批量發送）
 * @param {Array} hotMemes - 熱門迷因陣列
 * @param {Array} targetUserIds - 目標用戶ID陣列（可選，不提供則發送給所有用戶）
 */
export const createHotContentNotifications = async (hotMemes, targetUserIds = null) => {
  try {
    if (!hotMemes || hotMemes.length === 0) return

    const memeTitle =
      hotMemes.length === 1 ? hotMemes[0].title || '您的迷因' : `${hotMemes.length} 個熱門迷因`

    const eventData = {
      actor_id: new mongoose.Types.ObjectId(), // 系統通知使用虛擬ID
      verb: VERB_MAPPING[NOTIFICATION_TYPES.HOT_CONTENT],
      object_type: 'meme',
      object_id: hotMemes[0]?._id || new mongoose.Types.ObjectId(),
      title: '熱門內容推薦',
      content: `發現新的熱門內容：${memeTitle}`,
      url:
        hotMemes.length === 1
          ? `${getFrontendUrl()}/meme/${hotMemes[0]._id}`
          : `${getFrontendUrl()}/hot`,
      payload: {
        hot_memes: hotMemes.map((meme) => ({
          id: meme._id,
          title: meme.title,
          like_count: meme.like_count,
        })),
      },
    }

    const options = {
      notificationType: NOTIFICATION_TYPES.HOT_CONTENT,
      checkPermission: true,
    }

    if (targetUserIds) {
      const result = await createNotificationEvent(eventData, targetUserIds, options)
      return {
        sent: result.receiptCount,
        success: result.success,
        notification: result.notification,
      }
    } else {
      const result = await createBulkNotification(eventData, {
        allUsers: true,
        ...options,
      })
      return {
        sent: result.receiptCount || 0,
        success: result.success,
        notification: result.notification,
      }
    }
  } catch (error) {
    console.error('建立熱門內容通知失敗:', error)
    throw error
  }
}

/**
 * 週報摘要通知
 * @param {String} userId - 用戶ID
 * @param {Object} weeklyStats - 週統計數據
 */
export const createWeeklySummaryNotification = async (userId, weeklyStats) => {
  try {
    const { new_followers = 0, total_likes = 0, total_comments = 0, memes_posted = 0 } = weeklyStats

    let content = `本週活動摘要`
    if (new_followers > 0) content += ` 新增 ${new_followers} 位追蹤者`
    if (total_likes > 0) content += ` 獲得 ${total_likes} 個讚`
    if (total_comments > 0) content += ` 收到 ${total_comments} 個評論`
    if (memes_posted > 0) content += ` 發布 ${memes_posted} 個迷因`

    if (content === `本週活動摘要`) {
      content = `本週活動摘要：無任何活動`
    }

    const eventData = {
      actor_id: new mongoose.Types.ObjectId(), // 系統通知
      verb: VERB_MAPPING[NOTIFICATION_TYPES.WEEKLY_SUMMARY],
      object_type: 'user',
      object_id: userId,
      title: '週報摘要',
      content: content,
      url: `${getFrontendUrl()}/profile`,
      payload: {
        week_start: (() => {
          const weekStart = new Date()
          weekStart.setDate(weekStart.getDate() - 7)
          return weekStart
        })(),
        week_end: new Date(),
        stats: weeklyStats,
      },
    }

    return await createNotificationEvent(eventData, [userId], {
      notificationType: NOTIFICATION_TYPES.WEEKLY_SUMMARY,
    })
  } catch (error) {
    console.error('建立週報摘要通知失敗:', error)
  }
}

// ========== 檢舉系統通知 ==========

/**
 * 建立通知（檢舉系統專用）
 * @param {Object} notificationData - 通知資料
 * @returns {Promise<Object>} 通知結果
 */
export const createReportNotification = async (notificationData) => {
  const {
    user_id,
    type,
    title,
    content,
    senderId = null,
    url = '',
    actionText = '查看',
    priority = 0,
    meta = {},
    expireAt = null,
  } = notificationData

  try {
    const eventData = {
      actor_id: senderId || new mongoose.Types.ObjectId(), // 系統通知使用虛擬ID
      verb: VERB_MAPPING[type] || 'report',
      object_type: 'user',
      object_id: user_id,
      title,
      content,
      url,
      actionText,
      payload: {
        ...meta,
        priority,
      },
      expireAt,
    }

    return await createNotificationEvent(eventData, [user_id])
  } catch (error) {
    console.error('建立通知失敗:', error)
    throw error
  }
}

/**
 * 檢舉提交成功通知
 * @param {string} reportId - 檢舉ID
 * @param {string} reporterId - 檢舉者ID
 */
export const notifyReportSubmitted = async (reportId, reporterId) => {
  try {
    return await createReportNotification({
      user_id: reporterId,
      type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
      title: '檢舉已提交',
      content: '您的檢舉已成功提交，我們會盡快處理。謝謝您協助維護平台品質',
      url: `${getFrontendUrl()}/reports`,
      actionText: '查看檢舉',
      priority: 1,
      meta: {
        reportId,
        action: 'submitted',
      },
    })
  } catch (error) {
    console.error('檢舉提交通知失敗:', error)
  }
}

/**
 * 檢舉處理結果通知
 * @param {string} reportId - 檢舉ID
 * @param {string} reporterId - 檢舉者ID
 * @param {string} status - 處理狀態
 * @param {string} action - 處理動作
 * @param {string} adminComment - 管理員註解
 */
export const notifyReportProcessed = async (reportId, reporterId, status, action, adminComment) => {
  try {
    let title, content, actionText

    if (status === 'processed') {
      title = '檢舉已處理'
      content = '您的檢舉已被處理'
      if (adminComment) {
        content += ` 管理員註解：${adminComment}`
      }
      actionText = '查看詳情'
    } else if (status === 'rejected') {
      title = '檢舉被駁回'
      content = '您的檢舉經審核後不成立'
      if (adminComment) {
        content += ` 原因：${adminComment}`
      }
      actionText = '查看詳情'
    }

    return await createReportNotification({
      user_id: reporterId,
      type:
        status === 'processed'
          ? NOTIFICATION_TYPES.REPORT_PROCESSED
          : NOTIFICATION_TYPES.REPORT_REJECTED,
      title,
      content,
      url: `${getFrontendUrl()}/reports`,
      actionText,
      priority: 2,
      meta: {
        reportId,
        status,
        action,
        adminComment,
      },
    })
  } catch (error) {
    console.error('檢舉處理通知失敗:', error)
  }
}

/**
 * 作者警告通知
 * @param {string} authorId - 作者ID
 * @param {string} reportId - 檢舉ID
 * @param {string} adminComment - 管理員註解
 */
export const notifyAuthorWarned = async (authorId, reportId, adminComment) => {
  try {
    return await createReportNotification({
      user_id: authorId,
      type: NOTIFICATION_TYPES.AUTHOR_WARNED,
      title: '內容警告',
      content: `您的內容被檢舉並收到警告${adminComment ? ` 原因：${adminComment}` : ''}`,
      url: `${getFrontendUrl()}/memes`,
      actionText: '查看內容',
      priority: 3,
      meta: {
        reportId,
        action: 'warned',
        adminComment,
      },
    })
  } catch (error) {
    console.error('作者警告通知失敗:', error)
  }
}

/**
 * 作者違規記點通知
 * @param {string} authorId - 作者ID
 * @param {string} reportId - 檢舉ID
 * @param {number} strikeCount - 記點數
 * @param {string} adminComment - 管理員註解
 */
export const notifyAuthorStruck = async (authorId, reportId, strikeCount, adminComment) => {
  try {
    return await createReportNotification({
      user_id: authorId,
      type: NOTIFICATION_TYPES.AUTHOR_STRUCK,
      title: '違規記點',
      content: `您的內容違反平台規範，已記違規點。當前違規點數：${strikeCount}${adminComment ? ` 原因：${adminComment}` : ''}`,
      url: `${getFrontendUrl()}/memes`,
      actionText: '查看內容',
      priority: 4,
      meta: {
        reportId,
        action: 'struck',
        strikeCount,
        adminComment,
      },
    })
  } catch (error) {
    console.error('作者違規記點通知失敗:', error)
  }
}

/**
 * 內容被刪除通知
 * @param {string} authorId - 作者ID
 * @param {string} reportId - 檢舉ID
 * @param {string} contentType - 內容類型
 * @param {string} adminComment - 管理員註解
 */
export const notifyContentRemoved = async (authorId, reportId, contentType, adminComment) => {
  try {
    return await createReportNotification({
      user_id: authorId,
      type: NOTIFICATION_TYPES.CONTENT_REMOVED,
      title: '內容已刪除',
      content: `您的${contentType}因違反平台規範已被刪除${adminComment ? ` 原因：${adminComment}` : ''}`,
      url: `${getFrontendUrl()}/memes`,
      actionText: '查看其他內容',
      priority: 5,
      meta: {
        reportId,
        action: 'removed',
        contentType,
        adminComment,
      },
    })
  } catch (error) {
    console.error('內容刪除通知失敗:', error)
  }
}

/**
 * 內容被隱藏通知
 * @param {string} authorId - 作者ID
 * @param {string} reportId - 檢舉ID
 * @param {string} contentType - 內容類型
 * @param {string} adminComment - 管理員註解
 */
export const notifyContentHidden = async (authorId, reportId, contentType, adminComment) => {
  try {
    return await createReportNotification({
      user_id: authorId,
      type: NOTIFICATION_TYPES.CONTENT_HIDDEN,
      title: '內容已隱藏',
      content: `您的${contentType}因違反平台規範已被隱藏${adminComment ? ` 原因：${adminComment}` : ''}`,
      url: `${getFrontendUrl()}/memes`,
      actionText: '查看其他內容',
      priority: 3,
      meta: {
        reportId,
        action: 'hidden',
        contentType,
        adminComment,
      },
    })
  } catch (error) {
    console.error('內容隱藏通知失敗:', error)
  }
}

/**
 * 評論被鎖定通知
 * @param {string} authorId - 作者ID
 * @param {string} reportId - 檢舉ID
 * @param {string} adminComment - 管理員註解
 */
export const notifyCommentsLocked = async (authorId, reportId, adminComment) => {
  try {
    return await createReportNotification({
      user_id: authorId,
      type: NOTIFICATION_TYPES.COMMENTS_LOCKED,
      title: '評論功能已鎖定',
      content: `您的內容評論功能已被鎖定${adminComment ? ` 原因：${adminComment}` : ''}`,
      url: `${getFrontendUrl()}/memes`,
      actionText: '查看內容',
      priority: 3,
      meta: {
        reportId,
        action: 'comments_locked',
        adminComment,
      },
    })
  } catch (error) {
    console.error('評論鎖定通知失敗:', error)
  }
}

/**
 * 批量發送通知
 * @param {string[]} userIds - 用戶ID陣列
 * @param {Object} notificationData - 通知資料
 * @returns {Promise<Object[]>} 通知結果陣列
 */
export const batchNotify = async (userIds, notificationData) => {
  try {
    const notifications = []

    for (const userId of userIds) {
      const notification = await createReportNotification({
        user_id: userId,
        ...notificationData,
      })
      notifications.push(notification)
    }

    return notifications
  } catch (error) {
    console.error('批量發送通知失敗:', error)
    throw error
  }
}

/**
 * 批量建立通知事件（優化版本，使用 MongoDB bulkWrite）
 * @param {Object} eventData - 通知事件資料
 * @param {string[]} userIds - 收件者ID陣列
 * @param {Object} options - 選項
 * @param {boolean} options.checkPermission - 是否檢查權限（預設true）
 * @param {string} options.notificationType - 通知類型（用於權限檢查）
 * @returns {Promise<Object>} 建立結果
 */
export const createBulkNotificationEvent = async (eventData, userIds, options = {}) => {
  const { checkPermission = true, notificationType } = options

  logger.info(`開始批量建立通知事件`, {
    userCount: userIds.length,
    notificationType,
    event: 'bulk_notification_start',
  })

  // 如果指定了通知類型且需要檢查權限，則過濾用戶
  let filteredUserIds = userIds
  if (checkPermission && notificationType) {
    const permissionPromises = userIds.map(async (userId) => {
      const hasPermission = await checkNotificationPermission(userId, notificationType)
      return hasPermission ? userId : null
    })

    const results = await Promise.all(permissionPromises)
    filteredUserIds = results.filter((id) => id !== null)

    const skippedCount = userIds.length - filteredUserIds.length
    if (skippedCount > 0) {
      logger.info(`批量通知權限檢查完成`, {
        originalCount: userIds.length,
        filteredCount: filteredUserIds.length,
        skippedCount,
        event: 'bulk_notification_permission_filtered',
      })
    }
  }

  if (filteredUserIds.length === 0) {
    return {
      success: true,
      notification: null,
      receiptCount: 0,
      skippedCount: userIds.length - filteredUserIds.length,
    }
  }

  const session = await createSession(Notification)

  return await withTransaction(session, async () => {
    // 建立通知事件
    const notification = new Notification(eventData)
    await notification.save(session ? { session } : {})

    // 使用 MongoDB bulkWrite 進行批量插入
    const bulkWriteOps = filteredUserIds.map((userId) => ({
      insertOne: {
        document: {
          notification_id: notification._id,
          user_id: userId,
          created_at: new Date(),
        },
      },
    }))

    // 分批處理，避免單次操作過大
    const batchSize = 1000
    let totalInserted = 0

    for (let i = 0; i < bulkWriteOps.length; i += batchSize) {
      const batch = bulkWriteOps.slice(i, i + batchSize)
      const result = await NotificationReceipt.bulkWrite(batch, { session })
      totalInserted += result.insertedCount

      logger.debug(`批量插入通知收件項`, {
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        insertedCount: result.insertedCount,
        event: 'bulk_notification_batch_inserted',
      })
    }

    logger.info(`批量通知事件建立完成`, {
      notificationId: notification._id,
      totalUsers: userIds.length,
      processedUsers: filteredUserIds.length,
      skippedUsers: userIds.length - filteredUserIds.length,
      totalReceipts: totalInserted,
      event: 'bulk_notification_completed',
    })

    return {
      success: true,
      notification,
      receiptCount: totalInserted,
      skippedCount: userIds.length - filteredUserIds.length,
    }
  })
}

/**
 * 高效批量通知處理（針對大量用戶）
 * @param {Object} eventData - 通知事件資料
 * @param {Object} options - 選項
 * @param {boolean} options.allUsers - 是否發送給所有用戶
 * @param {string[]} options.userIds - 指定用戶ID陣列
 * @param {Object} options.userFilter - 用戶篩選條件
 * @param {boolean} options.checkPermission - 是否檢查權限
 * @param {string} options.notificationType - 通知類型（用於權限檢查）
 * @param {number} options.batchSize - 批次處理大小
 * @returns {Promise<Object>} 建立結果
 */
export const createEfficientBulkNotification = async (eventData, options = {}) => {
  const {
    allUsers,
    userIds,
    userFilter = {},
    checkPermission = true,
    notificationType,
    batchSize = 5000,
  } = options

  logger.info(`開始高效批量通知處理`, {
    allUsers,
    userCount: userIds ? userIds.length : 'all',
    batchSize,
    notificationType,
    event: 'efficient_bulk_notification_start',
  })

  const session = await createSession(Notification)

  return await withTransaction(session, async () => {
    // 建立通知事件
    const notification = new Notification(eventData)
    await notification.save(session ? { session } : {})

    let totalProcessed = 0
    let totalSkipped = 0

    if (allUsers) {
      // 處理所有用戶，使用分頁查詢避免記憶體問題
      let skip = 0
      const pageSize = batchSize

      while (true) {
        // 查詢一批用戶
        const users = await User.find({
          isActive: true,
          ...userFilter,
        })
          .select('_id notificationSettings')
          .skip(skip)
          .limit(pageSize)
          .session(session || {})

        if (users.length === 0) break

        // 過濾用戶權限
        let targetUserIds = users.map((user) => user._id)
        if (checkPermission && notificationType) {
          const permissionPromises = users.map(async (user) => {
            const hasPermission = await checkNotificationPermission(user._id, notificationType)
            return hasPermission ? user._id : null
          })

          const results = await Promise.all(permissionPromises)
          targetUserIds = results.filter((id) => id !== null)
        }

        // 批量建立收件項
        if (targetUserIds.length > 0) {
          const bulkWriteOps = targetUserIds.map((userId) => ({
            insertOne: {
              document: {
                notification_id: notification._id,
                user_id: userId,
                created_at: new Date(),
              },
            },
          }))

          const result = await NotificationReceipt.bulkWrite(bulkWriteOps, { session })
          totalProcessed += result.insertedCount
        }

        totalSkipped += users.length - targetUserIds.length

        logger.debug(`處理批量通知分頁`, {
          skip,
          pageSize,
          usersFound: users.length,
          usersProcessed: targetUserIds.length,
          usersSkipped: users.length - targetUserIds.length,
          totalProcessed,
          event: 'efficient_bulk_notification_page_processed',
        })

        skip += pageSize
      }
    } else if (userIds && userIds.length > 0) {
      // 處理指定用戶列表
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)

        // 過濾用戶權限
        let targetUserIds = batch
        if (checkPermission && notificationType) {
          const permissionPromises = batch.map(async (userId) => {
            const hasPermission = await checkNotificationPermission(userId, notificationType)
            return hasPermission ? userId : null
          })

          const results = await Promise.all(permissionPromises)
          targetUserIds = results.filter((id) => id !== null)
        }

        // 批量建立收件項
        if (targetUserIds.length > 0) {
          const bulkWriteOps = targetUserIds.map((userId) => ({
            insertOne: {
              document: {
                notification_id: notification._id,
                user_id: userId,
                created_at: new Date(),
              },
            },
          }))

          const result = await NotificationReceipt.bulkWrite(bulkWriteOps, { session })
          totalProcessed += result.insertedCount
        }

        totalSkipped += batch.length - targetUserIds.length

        logger.debug(`處理指定用戶批量通知分頁`, {
          batchIndex: Math.floor(i / batchSize) + 1,
          batchSize: batch.length,
          processed: targetUserIds.length,
          skipped: batch.length - targetUserIds.length,
          totalProcessed,
          event: 'efficient_bulk_notification_batch_processed',
        })
      }
    } else {
      throw new Error('必須提供條件：allUsers 或 userIds')
    }

    logger.info(`高效批量通知處理完成`, {
      notificationId: notification._id,
      totalProcessed,
      totalSkipped,
      event: 'efficient_bulk_notification_completed',
    })

    return {
      success: true,
      notification,
      receiptCount: totalProcessed,
      skippedCount: totalSkipped,
    }
  })
}

// ========== 相容性功能 ==========

/**
 * 批量標記通知為已讀（向後相容）
 * @param {String} userId - 用戶ID
 * @param {Array} notificationIds - 通知ID陣列（可選，不提供則標記所有為已讀）
 */
export const markNotificationsAsRead = async (userId, notificationIds = null) => {
  try {
    const filter = { user_id: userId, read_at: null }
    if (notificationIds && notificationIds.length > 0) {
      filter.notification_id = { $in: notificationIds }
    }

    const result = await NotificationReceipt.updateMany(filter, {
      $set: { read_at: new Date() },
    })

    return result.modifiedCount
  } catch (error) {
    console.error('標記通知為已讀失敗:', error)
    throw error
  }
}

/**
 * 清理舊通知（向後相容）
 * @param {Number} daysOld - 刪除多少天前的通知（預設30天）
 */
export const cleanupOldNotifications = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await Notification.deleteMany({
      $or: [
        { expireAt: { $lt: new Date() } }, // 已過期的通知
        {
          createdAt: { $lt: cutoffDate },
          verb: { $in: ['like', 'comment'] },
        }, // 舊的互動通知
      ],
    })

    return result.deletedCount
  } catch (error) {
    console.error('清理舊通知失敗:', error)
    throw error
  }
}

/**
 * 取得用戶未讀通知數量（向後相容）
 * @param {string} userId - 用戶ID
 * @returns {Promise<number>} 未讀數量
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const count = await NotificationReceipt.countDocuments({
      user_id: userId,
      read_at: null,
      deleted_at: null,
    })
    return count
  } catch (error) {
    console.error('取得未讀通知數量失敗:', error)
    return 0
  }
}

/**
 * 標記通知為已讀（向後相容）
 * @param {string} notificationId - 通知ID
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 更新結果
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const receipt = await NotificationReceipt.findOneAndUpdate(
      {
        notification_id: notificationId,
        user_id: userId,
      },
      {
        read_at: new Date(),
      },
      { new: true },
    )
    return receipt
  } catch (error) {
    console.error('標記通知為已讀失敗:', error)
    throw error
  }
}

// ========== 清理和統計功能 ===========

/**
 * 清理過期的通知事件和收件項
 * @param {Object} options - 清理選項
 * @param {number} options.notificationDays - 通知事件保留天數（預設90天）
 * @param {number} options.receiptDays - 已刪除收件項保留天數（預設30天）
 * @returns {Promise<Object>} 清理結果
 */
export const cleanupExpiredNotifications = async (options = {}) => {
  const { notificationDays = 90, receiptDays = 30 } = options

  const session = await createSession(Notification)

  return await withTransaction(session, async () => {
    // 計算過期日期
    const notificationExpiryDate = new Date()
    notificationExpiryDate.setDate(notificationExpiryDate.getDate() - notificationDays)

    const receiptExpiryDate = new Date()
    receiptExpiryDate.setDate(receiptExpiryDate.getDate() - receiptDays)

    // 找出過期的通知事件
    const expiredNotifications = await Notification.find({
      createdAt: { $lt: notificationExpiryDate },
    })
      .select('_id')
      .session(session)

    const expiredNotificationIds = expiredNotifications.map((n) => n._id)

    // 刪除過期的通知事件
    const notificationResult = await Notification.deleteMany({
      _id: { $in: expiredNotificationIds },
    }).session(session || {})

    // 刪除過期的收件項
    const receiptResult = await NotificationReceipt.deleteMany({
      $or: [
        { notification_id: { $in: expiredNotificationIds } },
        { deleted_at: { $lt: receiptExpiryDate } },
      ],
    }).session(session || {})

    return {
      success: true,
      deletedNotifications: notificationResult.deletedCount,
      deletedReceipts: receiptResult.deletedCount,
    }
  })
}

/**
 * 取得通知統計資料
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 統計資料
 */
export const getNotificationStats = async (userId) => {
  const [totalCount, unreadCount, readCount, deletedCount, archivedCount] = await Promise.all([
    NotificationReceipt.countDocuments({ user_id: userId, deleted_at: null }),
    NotificationReceipt.countDocuments({ user_id: userId, deleted_at: null, read_at: null }),
    NotificationReceipt.countDocuments({
      user_id: userId,
      deleted_at: null,
      read_at: { $ne: null },
    }),
    NotificationReceipt.countDocuments({ user_id: userId, deleted_at: { $ne: null } }),
    NotificationReceipt.countDocuments({
      user_id: userId,
      deleted_at: null,
      archived_at: { $ne: null },
    }),
  ])

  return {
    total: totalCount,
    unread: unreadCount,
    read: readCount,
    deleted: deletedCount,
    archived: archivedCount,
  }
}

/**
 * 取得通知類型統計
 * @param {string} userId - 用戶ID
 * @returns {Promise<Object>} 類型統計
 */
export const getNotificationTypeStats = async (userId) => {
  const stats = await NotificationReceipt.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        deleted_at: null,
      },
    },
    {
      $lookup: {
        from: 'notifications',
        localField: 'notification_id',
        foreignField: '_id',
        as: 'notification',
      },
    },
    {
      $unwind: '$notification',
    },
    {
      $group: {
        _id: '$notification.verb',
        count: { $sum: 1 },
        unreadCount: {
          $sum: {
            $cond: [{ $eq: ['$read_at', null] }, 1, 0],
          },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
  ])

  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      total: stat.count,
      unread: stat.unreadCount,
    }
    return acc
  }, {})
}
