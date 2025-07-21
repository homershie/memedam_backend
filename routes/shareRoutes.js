import express from 'express'
import {
  createShare,
  getShares,
  getShareById,
  updateShare,
  deleteShare,
} from '../controllers/shareController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立分享
router.post('/', token, isUser, createShare)
// 取得所有分享
router.get('/', token, isUser, getShares)
// 取得單一分享
router.get('/:id', token, isUser, getShareById)
// 更新分享
router.put('/:id', token, isUser, updateShare)
// 刪除分享
router.delete('/:id', token, isUser, deleteShare)

export default router
