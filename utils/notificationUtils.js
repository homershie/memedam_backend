import NotificationReceipt from '../models/NotificationReceipt.js'
import Notification from '../models/Notification.js'

/**
 * 建立使用者收件查詢條件
 * @param {string} userId - 使用者ID
 * @param {Object} extra - 額外條件
 * @returns {Object} 查詢條件物件
 */
export const getUserReceiptQuery = (userId, extra = {}) => {
  const baseQuery = {
    user_id: userId,
    deleted_at: null, // 預設排除已刪除的收件項
  }

  return { ...baseQuery, ...extra }
}

/**
 * 建立批次刪除查詢條件
 * @param {string} userId - 使用者ID
 * @param {Object} options - 選項
 * @param {string[]} options.ids - 收件項ID陣列
 * @param {Date} options.olderThan - 早於此時間
 * @param {boolean} options.unreadOnly - 只未讀
 * @returns {Object} 查詢條件物件
 */
export const getBatchDeleteQuery = (userId, options = {}) => {
  const { ids, olderThan, unreadOnly } = options
  const query = getUserReceiptQuery(userId)

  if (ids && ids.length > 0) {
    query._id = { $in: ids }
  }

  if (olderThan) {
    query.createdAt = { $lt: new Date(olderThan) }
  }

  if (unreadOnly) {
    query.read_at = null
  }

  return query
}

/**
 * 檢查收件項是否確實屬於指定使用者
 * @param {string} receiptId - 收件項ID
 * @param {string} userId - 使用者ID
 * @returns {Promise<Object|null>} 收件項物件或null
 */
export const ensureReceiptOwner = async (receiptId, userId) => {
  try {
    const receipt = await NotificationReceipt.findOne({
      _id: receiptId,
      user_id: userId,
    }).populate('notification_id')

    return receipt
  } catch {
    return null
  }
}

/**
 * 軟刪除收件項（標記為已刪除）
 * @param {string} receiptId - 收件項ID
 * @param {string} userId - 使用者ID
 * @returns {Promise<Object>} 更新結果
 */
export const softDeleteReceipt = async (receiptId, userId) => {
  const now = new Date()

  return await NotificationReceipt.updateOne(
    { _id: receiptId, user_id: userId },
    {
      $set: {
        deleted_at: now,
        updatedAt: now,
      },
    },
  )
}

/**
 * 標記收件項為已讀/未讀
 * @param {string} receiptId - 收件項ID
 * @param {string} userId - 使用者ID
 * @param {boolean} isRead - 是否已讀
 * @returns {Promise<Object>} 更新結果
 */
export const markReceiptRead = async (receiptId, userId, isRead) => {
  const updateData = {
    read_at: isRead ? new Date() : null,
    updatedAt: new Date(),
  }

  return await NotificationReceipt.updateOne(
    { _id: receiptId, user_id: userId },
    { $set: updateData },
  )
}

/**
 * 標記收件項為封存/取消封存
 * @param {string} receiptId - 收件項ID
 * @param {string} userId - 使用者ID
 * @param {boolean} isArchived - 是否封存
 * @returns {Promise<Object>} 更新結果
 */
export const markReceiptArchived = async (receiptId, userId, isArchived) => {
  const updateData = {
    archived_at: isArchived ? new Date() : null,
    updatedAt: new Date(),
  }

  return await NotificationReceipt.updateOne(
    { _id: receiptId, user_id: userId },
    { $set: updateData },
  )
}

/**
 * 批次軟刪除收件項
 * @param {string} userId - 使用者ID
 * @param {Object} options - 刪除選項
 * @returns {Promise<number>} 刪除數量
 */
export const batchSoftDeleteReceipts = async (userId, options = {}) => {
  const query = getBatchDeleteQuery(userId, options)
  const now = new Date()

  const result = await NotificationReceipt.updateMany(query, {
    $set: {
      deleted_at: now,
      updatedAt: now,
    },
  })

  return result.modifiedCount
}

/**
 * 取得未讀通知數量
 * @param {string} userId - 使用者ID
 * @returns {Promise<number>} 未讀數量
 */
export const getUnreadCount = async (userId) => {
  const count = await NotificationReceipt.countDocuments({
    user_id: userId,
    deleted_at: null,
    read_at: null,
  })
  return count
}

/**
 * 清理孤兒收件項（沒有對應通知事件的收件項）
 * @returns {Promise<number>} 清理數量
 */
export const cleanupOrphanReceipts = async () => {
  // 找出所有通知事件ID
  const notificationIds = await Notification.distinct('_id')

  // 刪除沒有對應通知事件的收件項
  const result = await NotificationReceipt.deleteMany({
    notification_id: { $nin: notificationIds },
  })

  return result.deletedCount
}

/**
 * 清理過期的已刪除收件項（90天前）
 * @returns {Promise<number>} 清理數量
 */
export const cleanupExpiredDeletedReceipts = async () => {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const result = await NotificationReceipt.deleteMany({
    deleted_at: { $lt: cutoffDate },
  })

  return result.deletedCount
}
