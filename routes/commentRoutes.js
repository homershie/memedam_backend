import express from 'express'
import {
  createComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment,
} from '../controllers/commentController.js'

const router = express.Router()

// 建立留言
router.post('/', createComment)
// 取得所有留言
router.get('/', getComments)
// 取得單一留言
router.get('/:id', getCommentById)
// 更新留言
router.put('/:id', updateComment)
// 刪除留言
router.delete('/:id', deleteComment)

export default router
