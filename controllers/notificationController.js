import Notification from '../models/Notification.js'

// 建立通知
export const createNotification = async (req, res) => {
  try {
    const notification = new Notification(req.body)
    await notification.save()
    res.status(201).json(notification)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有通知（可加分頁、條件查詢）
export const getNotifications = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.status) filter.status = req.query.status
    if (req.query.type) filter.type = req.query.type
    const notifications = await Notification.find(filter).sort({ createdAt: -1 })
    res.json(notifications)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一通知
export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
    if (!notification) return res.status(404).json({ error: '找不到通知' })
    res.json(notification)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新通知
export const updateNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!notification) return res.status(404).json({ error: '找不到通知' })
    res.json(notification)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除通知
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id)
    if (!notification) return res.status(404).json({ error: '找不到通知' })
    res.json({ message: '通知已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
