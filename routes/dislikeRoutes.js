import express from 'express'
import {
  createDislike,
  getDislikes,
  deleteDislike,
  toggleDislike,
} from '../controllers/dislikeController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立噓
router.post('/', token, isUser, createDislike)
// 取消噓
router.delete('/', token, isUser, deleteDislike) // 用 query string 傳 meme_id
// 查詢某迷因噓數（可選）
router.get('/', getDislikes)
// 切換噓/取消噓
router.post('/toggle', token, isUser, toggleDislike)

export default router
