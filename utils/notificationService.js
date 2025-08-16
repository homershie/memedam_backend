import Notification from '../models/Notification.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'

// 通知類型常量
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

/**
 * 獲取前端URL，支持環境配置
 * @returns {String} 前端URL
 */
const getFrontendUrl = () => {
  // 優先使用環境變數
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL
  }

  // 根據環境判斷
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:5173'
  }

  // 生產環境默認使用 memedam.com
  return 'https://memedam.com'
}

/**
 * 檢查用戶是否允許接收特定類型的通知
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
        return settings.newFollower !== false // 默認允許，除非明確設為 false
      case NOTIFICATION_TYPES.NEW_COMMENT:
        return settings.newComment !== false
      case NOTIFICATION_TYPES.NEW_LIKE:
        return settings.newLike !== false
      case NOTIFICATION_TYPES.NEW_MENTION:
        return settings.newMention !== false
      case NOTIFICATION_TYPES.HOT_CONTENT:
        return settings.trendingContent === true // 只有明確設為 true 才發送
      case NOTIFICATION_TYPES.WEEKLY_SUMMARY:
        return settings.weeklyDigest !== false
      default:
        return true // 默認允許
    }
  } catch (error) {
    console.error('檢查通知權限失敗:', error)
    // 出錯時預設允許發送通知，避免因為權限檢查失敗而丟失重要通知
    return true
  }
}

/**
 * 創建通知的通用函數
 * @param {Object} notificationData - 通知數據
 * @param {String} notificationData.user_id - 接收通知的用戶ID
 * @param {String} notificationData.sender_id - 發送者ID（可選）
 * @param {String} notificationData.type - 通知類型
 * @param {String} notificationData.title - 通知標題
 * @param {String} notificationData.content - 通知內容
 * @param {String} notificationData.url - 跳轉連結（可選）
 * @param {Object} notificationData.meta - 額外數據（可選）
 * @param {Number} notificationData.priority - 優先級（可選，默認0）
 */
export const createNotification = async (notificationData) => {
  try {
    // 檢查用戶是否允許接收此類型的通知
    const hasPermission = await checkNotificationPermission(
      notificationData.user_id,
      notificationData.type,
    )
    if (!hasPermission) {
      console.log(`用戶 ${notificationData.user_id} 不允許接收 ${notificationData.type} 類型的通知`)
      return null
    }

    const notification = new Notification({
      user_id: notificationData.user_id,
      sender_id: notificationData.sender_id,
      type: notificationData.type,
      title: notificationData.title,
      content: notificationData.content,
      url: notificationData.url || '',
      meta: notificationData.meta || {},
      priority: notificationData.priority || 0,
      status: 'unread',
      is_read: false,
    })

    await notification.save()
    return notification
  } catch (error) {
    console.error('創建通知失敗:', error)
    throw error
  }
}

/**
 * 新追蹤者通知
 * @param {String} followedUserId - 被追蹤的用戶ID
 * @param {String} followerUserId - 追蹤者ID
 */
export const createNewFollowerNotification = async (followedUserId, followerUserId) => {
  try {
    // 獲取追蹤者信息
    const follower = await User.findById(followerUserId, 'username display_name avatar')
    if (!follower) return

    const followerName = follower.display_name || follower.username
    const frontendUrl = getFrontendUrl()

    await createNotification({
      user_id: followedUserId,
      sender_id: followerUserId,
      type: NOTIFICATION_TYPES.NEW_FOLLOWER,
      title: '新追蹤者',
      content: `${followerName} 開始追蹤您了`,
      url: `${frontendUrl}/users/${follower.username}`,
      meta: {
        follower_id: followerUserId,
        follower_username: follower.username,
      },
      priority: 3,
    })
  } catch (error) {
    console.error('創建新追蹤者通知失敗:', error)
  }
}

/**
 * 新留言通知
 * @param {String} memeId - 迷因ID
 * @param {String} commentUserId - 留言者ID
 * @param {String} commentContent - 留言內容
 */
export const createNewCommentNotification = async (memeId, commentUserId, commentContent) => {
  try {
    // 獲取迷因信息和作者
    const meme = await Meme.findById(memeId, 'author_id title').populate(
      'author_id',
      'username display_name',
    )
    if (!meme || !meme.author_id) return

    // 不給自己發送通知
    if (meme.author_id._id.toString() === commentUserId.toString()) return

    // 獲取留言者信息
    const commenter = await User.findById(commentUserId, 'username display_name')
    if (!commenter) return

    const commenterName = commenter.display_name || commenter.username
    const truncatedContent =
      commentContent.length > 50 ? commentContent.substring(0, 50) + '...' : commentContent
    const frontendUrl = getFrontendUrl()

    await createNotification({
      user_id: meme.author_id._id,
      sender_id: commentUserId,
      type: NOTIFICATION_TYPES.NEW_COMMENT,
      title: '新留言',
      content: `${commenterName} 對您的迷因留言：${truncatedContent}`,
      url: `${frontendUrl}/meme/details/${memeId}`,
      meta: {
        meme_id: memeId,
        comment_user_id: commentUserId,
        comment_content: commentContent,
      },
      priority: 5,
    })
  } catch (error) {
    console.error('創建新留言通知失敗:', error)
  }
}

/**
 * 新按讚通知
 * @param {String} memeId - 迷因ID
 * @param {String} likerUserId - 按讚者ID
 */
export const createNewLikeNotification = async (memeId, likerUserId) => {
  try {
    console.log(`開始創建按讚通知: memeId=${memeId}, likerUserId=${likerUserId}`)

    // 獲取迷因信息和作者
    const meme = await Meme.findById(memeId, 'author_id title').populate(
      'author_id',
      'username display_name',
    )
    if (!meme || !meme.author_id) {
      console.log(`迷因不存在或無作者: memeId=${memeId}`)
      return
    }

    // 不給自己發送通知
    if (meme.author_id._id.toString() === likerUserId.toString()) {
      console.log(`跳過自己給自己的通知: authorId=${meme.author_id._id}, likerId=${likerUserId}`)
      return
    }

    // 獲取按讚者信息
    const liker = await User.findById(likerUserId, 'username display_name')
    if (!liker) {
      console.log(`按讚者不存在: likerUserId=${likerUserId}`)
      return
    }

    const likerName = liker.display_name || liker.username
    const memeTitle = meme.title || '您的迷因'
    const frontendUrl = getFrontendUrl()

    console.log(
      `準備發送通知給用戶: ${meme.author_id._id}, 內容: ${likerName} 按讚了您的迷因「${memeTitle}」`,
    )

    const notification = await createNotification({
      user_id: meme.author_id._id,
      sender_id: likerUserId,
      type: NOTIFICATION_TYPES.NEW_LIKE,
      title: '新按讚',
      content: `${likerName} 按讚了您的迷因「${memeTitle}」`,
      url: `${frontendUrl}/meme/details/${memeId}`,
      meta: {
        meme_id: memeId,
        liker_user_id: likerUserId,
      },
      priority: 2,
    })

    if (notification) {
      console.log(`按讚通知創建成功: notificationId=${notification._id}`)
    } else {
      console.log(`按讚通知創建失敗: 可能是權限問題`)
    }
  } catch (error) {
    console.error('創建新按讚通知失敗:', error)
    // 不要拋出錯誤，避免影響按讚操作
  }
}

/**
 * 新提及通知
 * @param {String} content - 留言內容
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
    // 使用正則表達式找出所有提及的用戶名
    const mentionRegex = /@(\w+)/g
    const mentions = content.match(mentionRegex)

    if (!mentions || mentions.length === 0) return

    // 獲取提及者信息
    const mentioner = await User.findById(mentionerUserId, 'username display_name')
    if (!mentioner) return

    const mentionerName = mentioner.display_name || mentioner.username
    const frontendUrl = getFrontendUrl()

    // 處理每個提及的用戶
    for (const mention of mentions) {
      const username = mention.substring(1) // 移除 @ 符號

      // 查找被提及的用戶
      const mentionedUser = await User.findOne({ username }, '_id username display_name')
      if (!mentionedUser) continue

      // 不給自己發送通知
      if (mentionedUser._id.toString() === mentionerUserId.toString()) continue

      let notificationContent = `${mentionerName} 在${contextType === 'comment' ? '留言' : '內容'}中提及了您`
      let url = memeId ? `${frontendUrl}/meme/details/${memeId}` : `${frontendUrl}/`

      await createNotification({
        user_id: mentionedUser._id,
        sender_id: mentionerUserId,
        type: NOTIFICATION_TYPES.NEW_MENTION,
        title: '新提及',
        content: notificationContent,
        url: url,
        meta: {
          mentioned_in_content: content,
          context_type: contextType,
          meme_id: memeId,
        },
        priority: 4,
      })
    }
  } catch (error) {
    console.error('創建提及通知失敗:', error)
  }
}

/**
 * 熱門內容通知（批量發送）
 * @param {Array} hotMemes - 熱門迷因數組
 * @param {Array} targetUserIds - 目標用戶ID數組（可選，不提供則發送給所有用戶）
 */
export const createHotContentNotifications = async (hotMemes, targetUserIds = null) => {
  try {
    if (!hotMemes || hotMemes.length === 0) return

    // 如果沒有指定目標用戶，則獲取所有活躍用戶
    let users = []
    if (targetUserIds) {
      users = await User.find({ _id: { $in: targetUserIds } }, '_id username notificationSettings')
    } else {
      // 這裡可以添加邏輯來選擇活躍用戶，例如最近30天有活動的用戶
      users = await User.find(
        {
          $or: [
            { last_login_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
        '_id username notificationSettings',
      ).limit(1000) // 限制數量避免過載
    }

    const memeTitle =
      hotMemes.length === 1 ? hotMemes[0].title || '熱門迷因' : `${hotMemes.length} 個熱門迷因`

    // 過濾出允許接收熱門內容通知的用戶
    const allowedUsers = users.filter((user) => {
      const settings = user.notificationSettings || {}
      return settings.trendingContent === true // 只有明確設為 true 才發送
    })

    // 批量創建通知
    const notifications = allowedUsers.map((user) => ({
      user_id: user._id,
      type: NOTIFICATION_TYPES.HOT_CONTENT,
      title: '熱門內容推薦',
      content: `發現新的熱門內容：${memeTitle}`,
      url: hotMemes.length === 1 ? `/meme/${hotMemes[0]._id}` : '/hot',
      meta: {
        hot_memes: hotMemes.map((meme) => ({
          id: meme._id,
          title: meme.title,
          like_count: meme.like_count,
        })),
      },
      priority: 1,
      status: 'unread',
      is_read: false,
    }))

    if (notifications.length > 0) {
      await Notification.insertMany(notifications)
    }

    return { sent: notifications.length }
  } catch (error) {
    console.error('創建熱門內容通知失敗:', error)
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

    let content = `本週活動摘要：`
    if (new_followers > 0) content += ` 新增 ${new_followers} 位追蹤者`
    if (total_likes > 0) content += ` 獲得 ${total_likes} 個讚`
    if (total_comments > 0) content += ` 收到 ${total_comments} 則留言`
    if (memes_posted > 0) content += ` 發布 ${memes_posted} 個迷因`

    if (content === `本週活動摘要：`) {
      content = `本週活動摘要：暫無新活動`
    }

    await createNotification({
      user_id: userId,
      type: NOTIFICATION_TYPES.WEEKLY_SUMMARY,
      title: '週報摘要',
      content: content,
      url: '/profile',
      meta: {
        week_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        week_end: new Date(),
        stats: weeklyStats,
      },
      priority: 1,
    })
  } catch (error) {
    console.error('創建週報摘要通知失敗:', error)
  }
}

/**
 * 批量標記通知為已讀
 * @param {String} userId - 用戶ID
 * @param {Array} notificationIds - 通知ID數組（可選，不提供則標記所有為已讀）
 */
export const markNotificationsAsRead = async (userId, notificationIds = null) => {
  try {
    const filter = { user_id: userId, is_read: false }
    if (notificationIds && notificationIds.length > 0) {
      filter._id = { $in: notificationIds }
    }

    const result = await Notification.updateMany(filter, {
      $set: { is_read: true, status: 'read' },
    })

    return result.modifiedCount
  } catch (error) {
    console.error('標記通知為已讀失敗:', error)
    throw error
  }
}

/**
 * 清理過期通知
 * @param {Number} daysOld - 刪除多少天前的通知（默認30天）
 */
export const cleanupOldNotifications = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

    const result = await Notification.deleteMany({
      $or: [
        { expire_at: { $lt: new Date() } }, // 已過期的通知
        {
          createdAt: { $lt: cutoffDate },
          is_read: true,
          type: { $in: [NOTIFICATION_TYPES.NEW_LIKE, NOTIFICATION_TYPES.NEW_COMMENT] },
        }, // 舊的已讀互動通知
      ],
    })

    return result.deletedCount
  } catch (error) {
    console.error('清理舊通知失敗:', error)
    throw error
  }
}

// 建立通知（檢舉系統專用）
export const createReportNotification = async ({
  userId,
  type,
  title,
  content,
  senderId = null,
  url = '',
  actionText = '查看',
  priority = 0,
  meta = {},
  expireAt = null,
}) => {
  try {
    const notification = new Notification({
      user_id: userId,
      type,
      title,
      content,
      sender_id: senderId,
      url,
      action_text: actionText,
      priority,
      meta,
      expire_at: expireAt,
    })

    await notification.save()
    return notification
  } catch (error) {
    console.error('建立通知失敗:', error)
    throw error
  }
}

// 檢舉提交成功通知
export const notifyReportSubmitted = async (reportId, reporterId) => {
  try {
    const notification = await createReportNotification({
      userId: reporterId,
      type: NOTIFICATION_TYPES.REPORT_SUBMITTED,
      title: '檢舉已提交',
      content: '您的檢舉已成功提交，我們會盡快處理。感謝您協助維護平台品質。',
      url: `/reports`,
      actionText: '查看檢舉',
      priority: 1,
      meta: {
        reportId,
        action: 'submitted',
      },
    })

    return notification
  } catch (error) {
    console.error('檢舉提交通知失敗:', error)
  }
}

// 檢舉處理結果通知
export const notifyReportProcessed = async (reportId, reporterId, status, action, adminComment) => {
  try {
    let title, content, actionText

    if (status === 'processed') {
      title = '檢舉已處理'
      content = '您的檢舉已被處理。'
      if (adminComment) {
        content += ` 管理員備註：${adminComment}`
      }
      actionText = '查看詳情'
    } else if (status === 'rejected') {
      title = '檢舉未成立'
      content = '您的檢舉經審查後未成立。'
      if (adminComment) {
        content += ` 原因：${adminComment}`
      }
      actionText = '查看詳情'
    }

    const notification = await createReportNotification({
      userId: reporterId,
      type:
        status === 'processed'
          ? NOTIFICATION_TYPES.REPORT_PROCESSED
          : NOTIFICATION_TYPES.REPORT_REJECTED,
      title,
      content,
      url: `/reports`,
      actionText,
      priority: 2,
      meta: {
        reportId,
        status,
        action,
        adminComment,
      },
    })

    return notification
  } catch (error) {
    console.error('檢舉處理通知失敗:', error)
  }
}

// 作者警告通知
export const notifyAuthorWarned = async (authorId, reportId, adminComment) => {
  try {
    const notification = await createReportNotification({
      userId: authorId,
      type: NOTIFICATION_TYPES.AUTHOR_WARNED,
      title: '內容警告',
      content: `您的內容被檢舉並收到警告。${adminComment ? `原因：${adminComment}` : ''}`,
      url: `/memes`,
      actionText: '查看內容',
      priority: 3,
      meta: {
        reportId,
        action: 'warned',
        adminComment,
      },
    })

    return notification
  } catch (error) {
    console.error('作者警告通知失敗:', error)
  }
}

// 作者記違規點數通知
export const notifyAuthorStruck = async (authorId, reportId, strikeCount, adminComment) => {
  try {
    const notification = await createReportNotification({
      userId: authorId,
      type: NOTIFICATION_TYPES.AUTHOR_STRUCK,
      title: '違規記錄',
      content: `您的內容違反平台規範，已記違規點數。當前違規點數：${strikeCount}。${adminComment ? `原因：${adminComment}` : ''}`,
      url: `/memes`,
      actionText: '查看內容',
      priority: 4,
      meta: {
        reportId,
        action: 'struck',
        strikeCount,
        adminComment,
      },
    })

    return notification
  } catch (error) {
    console.error('作者記違規通知失敗:', error)
  }
}

// 內容被刪除通知
export const notifyContentRemoved = async (authorId, reportId, contentType, adminComment) => {
  try {
    const notification = await createReportNotification({
      userId: authorId,
      type: NOTIFICATION_TYPES.CONTENT_REMOVED,
      title: '內容已刪除',
      content: `您的${contentType}因違反平台規範已被刪除。${adminComment ? `原因：${adminComment}` : ''}`,
      url: `/memes`,
      actionText: '查看其他內容',
      priority: 5,
      meta: {
        reportId,
        action: 'removed',
        contentType,
        adminComment,
      },
    })

    return notification
  } catch (error) {
    console.error('內容刪除通知失敗:', error)
  }
}

// 內容被隱藏通知
export const notifyContentHidden = async (authorId, reportId, contentType, adminComment) => {
  try {
    const notification = await createReportNotification({
      userId: authorId,
      type: NOTIFICATION_TYPES.CONTENT_HIDDEN,
      title: '內容已隱藏',
      content: `您的${contentType}因違反平台規範已被隱藏。${adminComment ? `原因：${adminComment}` : ''}`,
      url: `/memes`,
      actionText: '查看其他內容',
      priority: 3,
      meta: {
        reportId,
        action: 'hidden',
        contentType,
        adminComment,
      },
    })

    return notification
  } catch (error) {
    console.error('內容隱藏通知失敗:', error)
  }
}

// 留言被鎖定通知
export const notifyCommentsLocked = async (authorId, reportId, adminComment) => {
  try {
    const notification = await createReportNotification({
      userId: authorId,
      type: NOTIFICATION_TYPES.COMMENTS_LOCKED,
      title: '留言功能已鎖定',
      content: `您的內容留言功能已被鎖定。${adminComment ? `原因：${adminComment}` : ''}`,
      url: `/memes`,
      actionText: '查看內容',
      priority: 3,
      meta: {
        reportId,
        action: 'comments_locked',
        adminComment,
      },
    })

    return notification
  } catch (error) {
    console.error('留言鎖定通知失敗:', error)
  }
}

// 批次發送通知
export const batchNotify = async (userIds, notificationData) => {
  try {
    const notifications = []

    for (const userId of userIds) {
      const notification = await createReportNotification({
        userId,
        ...notificationData,
      })
      notifications.push(notification)
    }

    return notifications
  } catch (error) {
    console.error('批次發送通知失敗:', error)
    throw error
  }
}

// 取得用戶未讀通知數量
export const getUnreadNotificationCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      user_id: userId,
      status: 'unread',
    })
    return count
  } catch (error) {
    console.error('取得未讀通知數量失敗:', error)
    return 0
  }
}

// 標記通知為已讀
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user_id: userId,
      },
      {
        status: 'read',
        is_read: true,
      },
      { new: true },
    )
    return notification
  } catch (error) {
    console.error('標記通知為已讀失敗:', error)
    throw error
  }
}
