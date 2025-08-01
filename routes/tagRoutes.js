import express from 'express'
import {
  createTag,
  getTags,
  getTagById,
  getPopularTags,
  getTagCategories,
  updateTag,
  deleteTag,
} from '../controllers/tagController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 基本 CRUD 操作
router.get('/', getTags)
router.post('/', token, isUser, createTag)

// 測試路由
router.get('/test', (req, res) => {
  res.json({ message: 'Test route works' })
})

// 特定路由（必須在參數路由之前）
router.get('/categories', getTagCategories)
router.get('/popular', getPopularTags)

// 參數路由（必須在最後）
router.get('/:id', getTagById)
router.put('/:id', token, isUser, updateTag)
router.delete('/:id', token, isUser, deleteTag)

export default router
