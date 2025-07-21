import express from 'express'
import {
  createMemeTag,
  getMemeTags,
  getMemeTagById,
  updateMemeTag,
  deleteMemeTag,
} from '../controllers/memeTagController.js'

const router = express.Router()

// 建立迷因標籤關聯
router.post('/', createMemeTag)
// 取得所有迷因標籤關聯
router.get('/', getMemeTags)
// 取得單一迷因標籤關聯
router.get('/:id', getMemeTagById)
// 更新迷因標籤關聯
router.put('/:id', updateMemeTag)
// 刪除迷因標籤關聯
router.delete('/:id', deleteMemeTag)

export default router
