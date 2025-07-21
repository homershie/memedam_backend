import express from 'express'
import {
  createMemeVersion,
  getMemeVersions,
  getMemeVersionById,
  updateMemeVersion,
  deleteMemeVersion,
} from '../controllers/memeVersionController.js'

const router = express.Router()

// 建立迷因版本
router.post('/', createMemeVersion)
// 取得所有迷因版本
router.get('/', getMemeVersions)
// 取得單一迷因版本
router.get('/:id', getMemeVersionById)
// 更新迷因版本
router.put('/:id', updateMemeVersion)
// 刪除迷因版本
router.delete('/:id', deleteMemeVersion)

export default router
