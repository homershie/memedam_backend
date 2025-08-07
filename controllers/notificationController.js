import Notification from '../models/Notification.js'

// 建立通知
export const createNotification = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Notification.startSession()
  session.startTransaction()

  try {
    const notification = new Notification(req.body)
    await notification.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json({ success: true, data: notification, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '通知記錄重複，請檢查是否已存在相同通知',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(400).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得所有通知（僅查詢自己的通知，可加分頁、條件查詢、已讀/未讀過濾）
export const getNotifications = async (req, res) => {
  try {
    const filter = { user_id: req.user._id } // 強制只查自己的
    if (req.query.status) filter.status = req.query.status
    if (req.query.type) filter.type = req.query.type
    if (req.query.read !== undefined) filter.is_read = req.query.read === 'true' // 已讀/未讀過濾
    // 分頁支援
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    const total = await Notification.countDocuments(filter)

    // 取得未讀計數
    const unreadCount = await Notification.countDocuments({
      user_id: req.user._id,
      is_read: false,
      status: { $ne: 'deleted' },
    })

    res.json({
      success: true,
      data: notifications,
      error: null,
      unreadCount, // 加入未讀計數
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
  // 使用 session 來確保原子性操作
  const session = await Notification.startSession()
  session.startTransaction()

  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!notification) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: notification, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '通知記錄重複，請檢查是否已存在相同通知',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(400).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除通知
export const deleteNotification = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Notification.startSession()
  session.startTransaction()

  try {
    const notification = await Notification.findByIdAndDelete(req.params.id).session(session)
    if (!notification) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: { message: '通知已刪除' }, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 標記單一通知為已讀
export const markNotificationRead = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Notification.startSession()
  session.startTransaction()

  try {
    const notification = await Notification.findById(req.params.id).session(session)
    if (!notification) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到通知' })
    }

    if (notification.user_id.toString() !== req.user._id.toString()) {
      await session.abortTransaction()
      return res.status(403).json({ success: false, data: null, error: '無權限操作此通知' })
    }

    notification.is_read = true
    await notification.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: notification, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 批次標記全部通知為已讀
export const markAllNotificationsRead = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Notification.startSession()
  session.startTransaction()

  try {
    const result = await Notification.updateMany(
      { user_id: req.user._id, is_read: false },
      { $set: { is_read: true } },
      { session },
    )

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: { modifiedCount: result.modifiedCount }, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 批次刪除通知
export const deleteNotifications = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Notification.startSession()
  session.startTransaction()

  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction()
      return res.status(400).json({ success: false, data: null, error: '請提供要刪除的通知ID陣列' })
    }

    // 僅允許刪除自己的通知
    const result = await Notification.deleteMany(
      { _id: { $in: ids }, user_id: req.user._id },
      { session },
    )

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: { deletedCount: result.deletedCount }, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得未讀通知計數
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user_id: req.user._id,
      is_read: false,
      status: { $ne: 'deleted' },
    })
    res.json({ success: true, data: { count }, error: null })
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: error.message })
  }
}
