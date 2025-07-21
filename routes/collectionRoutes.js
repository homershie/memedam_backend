import express from 'express'
import {
  createCollection,
  getCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
} from '../controllers/collectionController.js'

const router = express.Router()

// 建立收藏
router.post('/', createCollection)
// 取得所有收藏
router.get('/', getCollections)
// 取得單一收藏
router.get('/:id', getCollectionById)
// 更新收藏
router.put('/:id', updateCollection)
// 刪除收藏
router.delete('/:id', deleteCollection)

export default router
