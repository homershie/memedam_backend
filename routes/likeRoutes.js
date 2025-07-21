import express from 'express'
import {
  createLike,
  getLikes,
  getLikeById,
  updateLike,
  deleteLike,
} from '../controllers/likeController.js'

const router = express.Router()

// 建立讚
router.post('/', createLike)
// 取得所有讚
router.get('/', getLikes)
// 取得單一讚
router.get('/:id', getLikeById)
// 更新讚
router.put('/:id', updateLike)
// 刪除讚
router.delete('/:id', deleteLike)

export default router
