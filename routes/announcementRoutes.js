import express from 'express'
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  validateCreateAnnouncement,
} from '../controllers/announcementController.js'
import { token, isAdmin, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立公告
router.post('/', token, isUser, validateCreateAnnouncement, createAnnouncement)
// 取得所有公告
router.get('/', getAnnouncements)
// 取得單一公告
router.get('/:id', getAnnouncementById)
// 更新公告
router.put('/:id', token, isAdmin, updateAnnouncement)
// 刪除公告
router.delete('/:id', token, isAdmin, deleteAnnouncement)

export default router
