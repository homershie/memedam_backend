import express from 'express'
import {
  createNotification,
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
} from '../controllers/notificationController.js'
import { token, isUser, isManager } from '../middleware/auth.js'

const router = express.Router()

// 建立通知
router.post('/', token, isManager, createNotification)
// 取得所有通知
router.get('/', token, isUser, getNotifications)
// 取得單一通知
router.get('/:id', token, isUser, getNotificationById)
// 更新通知
router.put('/:id', token, isManager, updateNotification)
// 刪除通知
router.delete('/:id', token, isManager, deleteNotification)
// 標記單一通知為已讀
router.patch('/:id/read', token, isUser, markNotificationRead)
// 批次標記全部通知為已讀
router.patch('/read/all', token, isUser, markAllNotificationsRead)
// 批次刪除通知
router.delete('/batch', token, isUser, deleteNotifications)

export default router
