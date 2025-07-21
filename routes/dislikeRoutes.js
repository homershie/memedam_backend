import express from 'express'
import {
  createDislike,
  getDislikes,
  getDislikeById,
  updateDislike,
  deleteDislike,
} from '../controllers/dislikeController.js'

const router = express.Router()

// 建立噓
router.post('/', createDislike)
// 取得所有噓
router.get('/', getDislikes)
// 取得單一噓
router.get('/:id', getDislikeById)
// 更新噓
router.put('/:id', updateDislike)
// 刪除噓
router.delete('/:id', deleteDislike)

export default router
