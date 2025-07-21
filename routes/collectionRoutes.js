import express from 'express'
import {
  createCollection,
  getCollections,
  deleteCollection,
  toggleCollection,
  validateCreateCollection,
} from '../controllers/collectionController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

// 收藏
router.post('/', token, isUser, validateCreateCollection, createCollection)
// 取消收藏
router.delete('/', token, isUser, deleteCollection) // 用 query string 或 body 傳 meme_id
// 查詢收藏
router.get('/', getCollections)
// 切換收藏/取消收藏
router.post('/toggle', token, isUser, toggleCollection)

export default router
