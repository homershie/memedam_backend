import express from 'express'
import { createLike, getLikes, deleteLike, toggleLike } from '../controllers/likeController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立讚
router.post('/', token, isUser, createLike)
// 取消讚
router.delete('/', token, isUser, deleteLike) // 用 query string 傳 meme_id
// 查詢某迷因讚數（可選）
router.get('/', getLikes)
// 切換讚/取消讚
router.post('/toggle', token, isUser, toggleLike)

export default router
