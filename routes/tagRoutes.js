import express from 'express'
import {
  createTag,
  getTags,
  getTagById,
  getPopularTags,
  updateTag,
  deleteTag,
} from '../controllers/tagController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立標籤
router.post('/', token, isUser, createTag)
// 取得所有標籤 - 公開API
router.get('/', getTags)
// 取得熱門標籤統計 - 公開API
router.get('/popular', getPopularTags)
// 取得單一標籤 - 公開API
router.get('/:id', getTagById)
// 更新標籤
router.put('/:id', token, isUser, updateTag)
// 刪除標籤
router.delete('/:id', token, isUser, deleteTag)

export default router
