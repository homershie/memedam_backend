import express from 'express'
import {
  createTag,
  getTags,
  getTagById,
  getPopularTags,
  getTagCategories,
  updateTag,
  deleteTag,
  rebuildTagsMetadata,
  exportTags,
  toggleTagStatus,
  mergeTags,
  batchDeleteTags,
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
router.get('/export', token, isUser, exportTags)
router.post('/maintenance/rebuild', token, isUser, rebuildTagsMetadata)

// 批量操作路由
router.post('/merge', token, isUser, mergeTags)
router.delete('/batch-delete', token, isUser, batchDeleteTags)

// 參數路由（必須在最後）
router.get('/:id', getTagById)
router.put('/:id', token, isUser, updateTag)
router.put('/:id/toggle-status', token, isUser, toggleTagStatus)
router.delete('/:id', token, isUser, deleteTag)

export default router
