import express from 'express'
import {
  createMemeTag,
  batchCreateMemeTags,
  getMemeTags,
  getMemeTagById,
  getTagsByMemeId,
  getMemesByTagId,
  updateMemeTag,
  deleteMemeTag,
  deleteMemeAllTags,
} from '../controllers/memeTagController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 建立迷因標籤關聯
router.post('/', token, isUser, createMemeTag)
// 批量為迷因添加標籤
router.post('/batch', token, isUser, batchCreateMemeTags)
// 取得所有迷因標籤關聯 - 公開API
router.get('/', getMemeTags)
// 取得單一迷因標籤關聯 - 公開API
router.get('/:id', getMemeTagById)
// 根據迷因ID獲取所有標籤 - 公開API
router.get('/meme/:memeId/tags', getTagsByMemeId)
// 根據標籤ID獲取所有迷因 - 公開API
router.get('/tag/:tagId/memes', getMemesByTagId)
// 更新迷因標籤關聯
router.put('/:id', token, isUser, updateMemeTag)
// 刪除迷因標籤關聯
router.delete('/:id', token, isUser, deleteMemeTag)
// 批量刪除迷因的所有標籤
router.delete('/meme/:memeId/tags', token, isUser, deleteMemeAllTags)

export default router
