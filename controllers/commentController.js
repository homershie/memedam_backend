import Comment from '../models/Comment.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { body, validationResult } from 'express-validator'
import { executeTransaction } from '../utils/transaction.js'
import {
  createNewCommentNotification,
  createMentionNotifications,
} from '../services/notificationService.js'

// 從內容中提取被提及的用戶名
const extractMentionedUsers = (content) => {
  const mentionRegex = /@(\w+)/g
  const mentions = content.match(mentionRegex)

  if (!mentions || mentions.length === 0) return []

  // 移除 @ 符號並去重
  const usernames = mentions.map((mention) => mention.substring(1))
  return [...new Set(usernames)] // 去重
}

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

    // 提取被提及的用戶名
    const mentioned_users = extractMentionedUsers(content)

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      const comment = new Comment({
        content,
        meme_id,
        parent_id,
        user_id: req.user?._id,
        mentioned_users, // 保存提及的用戶名
      })
      await comment.save({ session })

      // 更新迷因的留言數
      await Meme.findByIdAndUpdate(meme_id, { $inc: { comment_count: 1 } }, { session })

      // 更新用戶的評論數
      await User.findByIdAndUpdate(req.user._id, { $inc: { comment_count: 1 } }, { session })

      return comment
    })

    // 創建留言通知（在事務外執行）
    createNewCommentNotification(meme_id, req.user._id, content).catch((error) => {
      console.error('發送留言通知失敗:', error)
    })

    // 檢查並創建提及通知（在事務外執行）
    createMentionNotifications(content, req.user._id, meme_id, 'comment').catch((error) => {
      console.error('發送提及通知失敗:', error)
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
    if (req.query.status) filter.status = req.query.status

    // 分頁參數
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    // 排序參數
    const sort = req.query.sort || 'createdAt'
    const order = req.query.order === 'asc' ? 1 : -1
    const sortObj = { [sort]: order }

    // 搜尋功能
    if (req.query.search) {
      filter.content = { $regex: req.query.search, $options: 'i' }
    }

    // 如果不是管理員且沒有指定狀態，只顯示 normal 狀態的評論
    const isAdmin = req.user && req.user.role === 'admin'
    if (!isAdmin && !req.query.status) {
      filter.status = 'normal'
    }

    // 查詢總數
    const total = await Comment.countDocuments(filter)

    // 查詢數據
    const comments = await Comment.find(filter)
      .populate('user_id', 'username display_name avatar')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)

    res.json({
      success: true,
      data: comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      error: null,
    })
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

      // 記錄迷因ID和用戶ID，用於更新計數
      const meme_id = comment.meme_id
      const user_id = comment.user_id

      await Comment.findByIdAndDelete(req.params.id, { session })

      // 更新迷因的留言數（減少）
      await Meme.findByIdAndUpdate(meme_id, { $inc: { comment_count: -1 } }, { session })

      // 更新用戶的評論數（減少）
      await User.findByIdAndUpdate(user_id, { $inc: { comment_count: -1 } }, { session })

      return { message: '留言已刪除' }
    })

    res.json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
