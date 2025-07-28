import Collection from '../models/Collection.js'
import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import { body, validationResult } from 'express-validator'

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
    const collection = new Collection({ name, meme_ids, user_id: req.user?._id })
    await collection.save()

    // 更新所有相關迷因的收藏數
    if (meme_ids && Array.isArray(meme_ids)) {
      for (const meme_id of meme_ids) {
        await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: 1 } })
      }
    }

    res.status(201).json({ success: true, data: collection, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有收藏（可加分頁、條件查詢）
export const getCollections = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
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
    const collection = await Collection.findOneAndDelete({ meme_id, user_id })
    if (!collection) return res.status(404).json({ error: '找不到收藏' })

    // 更新迷因的收藏數（減少）
    await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: -1 } })

    res.json({ message: '收藏已刪除' })
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
    const existing = await Collection.findOne({ meme_id, user_id })
    if (existing) {
      await existing.deleteOne()
      // 更新迷因的收藏數（減少）
      await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: -1 } })
      return res.json({ success: true, action: 'removed' })
    } else {
      await Collection.create({ meme_id, user_id })
      // 更新迷因的收藏數（增加）
      await Meme.findByIdAndUpdate(meme_id, { $inc: { collection_count: 1 } })
      return res.json({ success: true, action: 'added' })
    }
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
