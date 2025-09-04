import Collection from '../models/Collection.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import { body, validationResult } from 'express-validator'
import { executeTransaction } from '../utils/transaction.js'

export const validateCreateCollection = [
  body('name').isLength({ min: 1, max: 100 }).withMessage('收藏名稱必填，且長度需在 1~100 字'),
]

// 建立收藏
export const createCollection = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }
  try {
    const { name, meme_ids } = req.body

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const collection = new Collection({ name, meme_ids, user_id: req.user?._id })
      await collection.save({ session })

      // 更新所有相關迷因的收藏數
      if (meme_ids && Array.isArray(meme_ids)) {
        for (const meme_id of meme_ids) {
          await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: 1 } }, { session })
        }
      }

      return collection
    })

    res.status(201).json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有收藏（可加分頁、條件查詢）
export const getCollections = async (req, res) => {
  try {
    const filter = {}
    // 如果沒有指定 user_id，使用當前用戶ID（如果已登入）
    const targetUserId = req.query.user_id || req.user?._id
    if (targetUserId) filter.user_id = targetUserId
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const collections = await Collection.find(filter).sort({ createdAt: -1 })
    res.json(collections)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 刪除收藏（只允許刪除自己對某迷因的收藏）
export const deleteCollection = async (req, res) => {
  try {
    const { meme_id } = req.query
    if (!meme_id) return res.status(StatusCodes.BAD_REQUEST).json({ error: '缺少 meme_id' })
    const user_id = req.user._id

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const collection = await Collection.findOneAndDelete({ meme_id, user_id }, { session })
      if (!collection) {
        throw new Error('找不到收藏')
      }

      // 更新迷因的收藏數（減少）
      await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: -1 } }, { session })

      return { message: '收藏已刪除' }
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 切換收藏/取消收藏
export const toggleCollection = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 meme_id' })
    }
    const user_id = req.user._id

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const existing = await Collection.findOne({ meme_id, user_id }).session(session)
      if (existing) {
        await existing.deleteOne({ session })
        // 更新迷因的收藏數（減少）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: -1 } }, { session })
        // 更新用戶的收藏數（減少）
        await User.findByIdAndUpdate(user_id, { $inc: { collection_count: -1 } }, { session })
        return { action: 'removed' }
      } else {
        await Collection.create([{ meme_id, user_id }], { session })
        // 更新迷因的收藏數（增加）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: 1 } }, { session })
        // 更新用戶的收藏數（增加）
        await User.findByIdAndUpdate(user_id, { $inc: { collection_count: 1 } }, { session })
        return { action: 'added' }
      }
    })

    return res.json({ success: true, ...result })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
