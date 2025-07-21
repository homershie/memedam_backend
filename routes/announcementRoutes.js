import express from 'express'
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js'

const router = express.Router()

// 建立公告
router.post('/', createAnnouncement)
// 取得所有公告
router.get('/', getAnnouncements)
// 取得單一公告
router.get('/:id', getAnnouncementById)
// 更新公告
router.put('/:id', updateAnnouncement)
// 刪除公告
router.delete('/:id', deleteAnnouncement)

export default router
