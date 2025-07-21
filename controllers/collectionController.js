import Collection from '../models/Collection.js'
import { StatusCodes } from 'http-status-codes'

// 建立收藏
export const createCollection = async (req, res) => {
  try {
    const collection = new Collection(req.body)
    await collection.save()
    res.status(201).json(collection)
  } catch (err) {
    res.status(400).json({ error: err.message })
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
      return res.json({ success: true, action: 'removed' })
    } else {
      await Collection.create({ meme_id, user_id })
      return res.json({ success: true, action: 'added' })
    }
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
