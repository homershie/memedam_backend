import Notification from '../models/Notification.js'
import NotificationReceipt from '../models/NotificationReceipt.js'
import {
  getUserReceiptQuery,
  ensureReceiptOwner,
  softDeleteReceipt,
  markReceiptRead,
  markReceiptArchived,
  batchSoftDeleteReceipts,
  getUnreadCount as getUnreadCountUtil,
  cleanupOrphanReceipts,
  cleanupExpiredDeletedReceipts,
} from '../utils/notificationUtils.js'

// ==================== 使用者端 API ====================

// 獲取使用者通知列表
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    // 建立查詢條件
    const query = getUserReceiptQuery(userId)

    // 支援篩選條件
    if (req.query.verb) {
      // 先查詢符合條件的通知事件ID
      const notificationIds = await Notification.find({ verb: req.query.verb }).select('_id')
      query.notification_id = { $in: notificationIds.map((n) => n._id) }
    }
    if (req.query.unread === 'true') {
      query.read_at = null
    }
    if (req.query.archived === 'true') {
      query.archived_at = { $ne: null }
    } else if (req.query.archived === 'false') {
      query.archived_at = null
    }

    // 查詢收件記錄並關聯通知事件
    const receipts = await NotificationReceipt.find(query)
      .populate({
        path: 'notification_id',
        select:
          'actor_id verb object_type object_id payload title content url action_text expire_at createdAt',
        populate: {
          path: 'actor_id',
          select: 'username avatar displayName',
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    // 計算總數
    const total = await NotificationReceipt.countDocuments(query)

    // 獲取未讀數量
    const unreadCount = await getUnreadCountUtil(userId)

    // 格式化回應資料
    const notifications = receipts.map((receipt) => ({
      _id: receipt._id,
      notificationId: receipt.notification_id._id,
      userId: receipt.user_id,
      readAt: receipt.read_at,
      deletedAt: receipt.deleted_at,
      archivedAt: receipt.archived_at,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
      is_read: receipt.isRead,
      isDeleted: receipt.isDeleted,
      isArchived: receipt.isArchived,
      // 通知事件資料
      actorId: receipt.notification_id.actor_id,
      verb: receipt.notification_id.verb,
      objectType: receipt.notification_id.object_type,
      objectId: receipt.notification_id.object_id,
      payload: receipt.notification_id.payload,
      title: receipt.notification_id.title,
      content: receipt.notification_id.content,
      url: receipt.notification_id.url,
      actionText: receipt.notification_id.action_text,
      expireAt: receipt.notification_id.expire_at,
      eventCreatedAt: receipt.notification_id.createdAt,
    }))

    res.json({
      success: true,
      data: notifications,
      error: null,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('獲取通知列表錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取通知列表失敗',
    })
  }
}

// 獲取單一通知事件詳情
export const getNotificationById = async (req, res) => {
  try {
    const receipt = await ensureReceiptOwner(req.params.id, req.user._id)

    if (!receipt) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '找不到通知事件',
      })
    }

    // 格式化回應資料
    const notification = {
      _id: receipt._id,
      notificationId: receipt.notification_id._id,
      userId: receipt.user_id,
      readAt: receipt.read_at,
      deletedAt: receipt.deleted_at,
      archivedAt: receipt.archived_at,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
      is_read: receipt.isRead,
      isDeleted: receipt.isDeleted,
      isArchived: receipt.isArchived,
      // 通知事件資料
      actorId: receipt.notification_id.actor_id,
      verb: receipt.notification_id.verb,
      objectType: receipt.notification_id.object_type,
      objectId: receipt.notification_id.object_id,
      payload: receipt.notification_id.payload,
      title: receipt.notification_id.title,
      content: receipt.notification_id.content,
      url: receipt.notification_id.url,
      actionText: receipt.notification_id.action_text,
      expireAt: receipt.notification_id.expire_at,
      eventCreatedAt: receipt.notification_id.createdAt,
    }

    res.json({ success: true, data: notification, error: null })
  } catch (error) {
    console.error('獲取通知錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取通知失敗',
    })
  }
}

// 更新通知事件狀態（已讀/未讀/封存）
export const updateNotification = async (req, res) => {
  try {
    const { read, archived } = req.body
    const receiptId = req.params.id
    const userId = req.user._id

    // 檢查收件記錄是否確實屬於使用者
    const receipt = await ensureReceiptOwner(receiptId, userId)
    if (!receipt) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '找不到通知',
      })
    }

    // 更新已讀狀態
    if (read !== undefined) {
      await markReceiptRead(receiptId, userId, read)
    }

    // 更新封存狀態
    if (archived !== undefined) {
      await markReceiptArchived(receiptId, userId, archived)
    }

    // 重新查詢更新後資料
    const updatedReceipt = await ensureReceiptOwner(receiptId, userId)

    res.json({
      success: true,
      data: updatedReceipt,
      error: null,
    })
  } catch (error) {
    console.error('更新通知錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '更新通知失敗',
    })
  }
}

// 軟刪除通知事件（使用者操作）
export const deleteNotification = async (req, res) => {
  try {
    const receiptId = req.params.id
    const userId = req.user._id

    // 檢查收件記錄是否確實屬於使用者
    const receipt = await ensureReceiptOwner(receiptId, userId)
    if (!receipt) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '找不到通知',
      })
    }

    // 軟刪除收件記錄（標記為已刪除）
    await softDeleteReceipt(receiptId, userId)

    res.status(204).send()
  } catch (error) {
    console.error('刪除通知錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '刪除通知失敗',
    })
  }
}

// 標記單一通知為已讀
export const markNotificationRead = async (req, res) => {
  try {
    const receiptId = req.params.id
    const userId = req.user._id

    // 檢查收件記錄是否確實屬於使用者
    const receipt = await ensureReceiptOwner(receiptId, userId)
    if (!receipt) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '找不到通知',
      })
    }

    // 標記為已讀
    await markReceiptRead(receiptId, userId, true)

    // 重新查詢更新後資料
    const updatedReceipt = await ensureReceiptOwner(receiptId, userId)

    res.json({
      success: true,
      data: updatedReceipt,
      error: null,
    })
  } catch (error) {
    console.error('標記已讀錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '標記已讀失敗',
    })
  }
}

// 標記全部通知為已讀
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id
    const query = getUserReceiptQuery(userId, { read_at: null })

    const result = await NotificationReceipt.updateMany(query, {
      $set: {
        read_at: new Date(),
        updatedAt: new Date(),
      },
    })

    res.json({
      success: true,
      data: { updatedCount: result.modifiedCount },
      error: null,
    })
  } catch (error) {
    console.error('標記全部已讀錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '標記全部已讀失敗',
    })
  }
}

// 批次刪除通知事件
export const deleteNotifications = async (req, res) => {
  try {
    const userId = req.user._id
    const { ids, olderThan, unreadOnly } = req.body

    // 驗證參數
    if (!ids && !olderThan && unreadOnly === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        error: '請提供刪除條件：ids、olderThan 或 unreadOnly',
      })
    }

    // 批次軟刪除
    const result = await batchSoftDeleteReceipts(userId, {
      ids,
      olderThan,
      unreadOnly,
    })

    res.json({
      success: true,
      data: { deletedCount: result.modifiedCount },
      error: null,
    })
  } catch (error) {
    console.error('批次刪除通知錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '批次刪除通知失敗',
    })
  }
}

// 獲取未讀通知數量
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id
    const count = await getUnreadCountUtil(userId)

    res.json({
      success: true,
      data: { unreadCount: count },
      error: null,
    })
  } catch (error) {
    console.error('獲取未讀數量錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取未讀數量失敗',
    })
  }
}

// ==================== 管理員端 API ====================

// 建立通知事件（管理員功能）
export const createNotification = async (req, res) => {
  try {
    const notification = new Notification(req.body)
    await notification.save()

    res.status(201).json({
      success: true,
      data: notification,
      error: null,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '通知事件重複，請檢查是否已存在相關記錄',
      })
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(400).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
}

// 硬刪除通知事件（管理員功能）
export const hardDeleteNotification = async (req, res) => {
  try {
    const notificationId = req.params.id
    const { hard = false } = req.query

    if (!hard) {
      return res.status(400).json({
        success: false,
        data: null,
        error: '請使用 hard=true 參數來確認硬刪除操作',
      })
    }

    // 刪除通知事件
    const notification = await Notification.findByIdAndDelete(notificationId)
    if (!notification) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '找不到通知事件',
      })
    }

    // 清理相關收件記錄
    const receiptResult = await NotificationReceipt.deleteMany({
      notification_id: notificationId,
    })

    res.json({
      success: true,
      data: {
        message: '通知事件已硬刪除',
        deletedReceipts: receiptResult.deletedCount,
      },
      error: null,
    })
  } catch (error) {
    console.error('硬刪除通知錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '硬刪除通知失敗',
    })
  }
}

// 清理孤兒收件記錄（管理員功能）
export const cleanupOrphanReceiptsController = async (req, res) => {
  try {
    const result = await cleanupOrphanReceipts()

    res.json({
      success: true,
      data: {
        message: '孤兒收件記錄清理完成',
        deletedCount: result.deletedCount,
      },
      error: null,
    })
  } catch (error) {
    console.error('清理孤兒收件記錄錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '清理孤兒收件記錄失敗',
    })
  }
}

// 清理過期已刪除收件記錄（管理員功能）
export const cleanupExpiredReceiptsController = async (req, res) => {
  try {
    const result = await cleanupExpiredDeletedReceipts()

    res.json({
      success: true,
      data: {
        message: '過期已刪除收件記錄清理完成',
        deletedCount: result.deletedCount,
      },
      error: null,
    })
  } catch (error) {
    console.error('清理過期收件記錄錯誤:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '清理過期收件記錄失敗',
    })
  }
}
