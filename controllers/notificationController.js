import Notification from '../models/Notification.js'

// 建立通知
export const createNotification = async (req, res) => {
  try {
    const notification = new Notification(req.body)
    await notification.save()
    res.status(201).json({ success: true, data: notification, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有通知（僅查詢自己的通知，可加分頁、條件查詢、已讀/未讀過濾）
export const getNotifications = async (req, res) => {
  try {
    const filter = { user_id: req.user._id } // 強制只查自己的
    if (req.query.status) filter.status = req.query.status
    if (req.query.type) filter.type = req.query.type
    if (req.query.read !== undefined) filter.read = req.query.read === 'true' // 已讀/未讀過濾
    // 分頁支援
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    const total = await Notification.countDocuments(filter)
    res.json({
      success: true,
      data: notifications,
      error: null,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得單一通知（僅限本人）
export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
    if (!notification)
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    if (notification.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, data: null, error: '無權限查詢此通知' })
    }
    res.json({ success: true, data: notification, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 更新通知
export const updateNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!notification)
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    res.json({ success: true, data: notification, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 刪除通知
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id)
    if (!notification)
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    res.json({ success: true, data: { message: '通知已刪除' }, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 標記單一通知為已讀
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
    if (!notification)
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    if (notification.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, data: null, error: '無權限操作此通知' })
    }
    notification.read = true
    await notification.save()
    res.json({ success: true, data: notification, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 批次標記全部通知為已讀
export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user_id: req.user._id, read: false },
      { $set: { read: true } }
    )
    res.json({ success: true, data: { modifiedCount: result.modifiedCount }, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 批次刪除通知
export const deleteNotifications = async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, data: null, error: '請提供要刪除的通知ID陣列' })
    }
    // 僅允許刪除自己的通知
    const result = await Notification.deleteMany({ _id: { $in: ids }, user_id: req.user._id })
    res.json({ success: true, data: { deletedCount: result.deletedCount }, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
