import express from 'express'
import {
  createMemeVersion,
  getMemeVersions,
  getMemeVersionById,
  updateMemeVersion,
  deleteMemeVersion,
} from '../controllers/memeVersionController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立迷因版本
router.post('/', token, isUser, createMemeVersion)
// 取得所有迷因版本
router.get('/', token, isUser, getMemeVersions)
// 取得單一迷因版本
router.get('/:id', token, isUser, getMemeVersionById)
// 更新迷因版本
router.put('/:id', token, isUser, updateMemeVersion)
// 刪除迷因版本
router.delete('/:id', token, isUser, deleteMemeVersion)

export default router
