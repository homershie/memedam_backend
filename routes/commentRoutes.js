import express from 'express'
import {
  createComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment,
  validateCreateComment,
} from '../controllers/commentController.js'
import { token, isUser, canEditComment } from '../middleware/auth.js'

const router = express.Router()

// 建立留言
router.post('/', token, isUser, validateCreateComment, createComment)
// 取得所有留言
router.get('/', getComments)
// 取得單一留言
router.get('/:id', getCommentById)
// 更新留言
router.put('/:id', token, canEditComment, updateComment)
// 刪除留言
router.delete('/:id', token, canEditComment, deleteComment)

export default router
