import express from 'express'
import {
  createNotification,
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
} from '../controllers/notificationController.js'

const router = express.Router()

// 建立通知
router.post('/', createNotification)
// 取得所有通知
router.get('/', getNotifications)
// 取得單一通知
router.get('/:id', getNotificationById)
// 更新通知
router.put('/:id', updateNotification)
// 刪除通知
router.delete('/:id', deleteNotification)

export default router
