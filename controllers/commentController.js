import Comment from '../models/Comment.js'
import Meme from '../models/Meme.js'
import { body, validationResult } from 'express-validator'
import { executeTransaction } from '../utils/transaction.js'

// 建立留言
export const validateCreateComment = [
  body('content').isLength({ min: 1, max: 500 }).withMessage('留言內容必填，且長度需在 1~500 字'),
]

export const createComment = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }
  try {
    const { content, meme_id, parent_id } = req.body // 僅允許這三個欄位

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      const comment = new Comment({ content, meme_id, parent_id, user_id: req.user?._id })
      await comment.save({ session })

      // 更新迷因的留言數
      await Meme.findByIdAndUpdate(meme_id, { $inc: { comment_count: 1 } }, { session })

      return comment
    })

    res.status(201).json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有留言（可加分頁、條件查詢）
export const getComments = async (req, res) => {
  try {
    const filter = {}
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    if (req.query.parent_id) filter.parent_id = req.query.parent_id

    const comments = await Comment.find(filter)
      .populate('user_id', 'username display_name avatar')
      .sort({ createdAt: 1 })

    res.json({ success: true, data: comments, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得單一留言
export const getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).populate(
      'user_id',
      'username display_name avatar',
    )

    if (!comment) {
      return res.status(404).json({ success: false, data: null, error: '找不到留言' })
    }

    res.json({ success: true, data: comment, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 更新留言
export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('user_id', 'username display_name avatar')

    if (!comment) {
      return res.status(404).json({ success: false, data: null, error: '找不到留言' })
    }

    res.json({ success: true, data: comment, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 刪除留言
export const deleteComment = async (req, res) => {
  try {
    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const comment = await Comment.findById(req.params.id).session(session)
      if (!comment) {
        throw new Error('找不到留言')
      }

      // 記錄迷因ID，用於更新計數
      const meme_id = comment.meme_id

      await Comment.findByIdAndDelete(req.params.id, { session })

      // 更新迷因的留言數（減少）
      await Meme.findByIdAndUpdate(meme_id, { $inc: { comment_count: -1 } }, { session })

      return { message: '留言已刪除' }
    })

    res.json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
