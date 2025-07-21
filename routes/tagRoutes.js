import express from 'express'
import {
  createTag,
  getTags,
  getTagById,
  updateTag,
  deleteTag,
} from '../controllers/tagController.js'

const router = express.Router()

// 建立標籤
router.post('/', createTag)
// 取得所有標籤
router.get('/', getTags)
// 取得單一標籤
router.get('/:id', getTagById)
// 更新標籤
router.put('/:id', updateTag)
// 刪除標籤
router.delete('/:id', deleteTag)

export default router
