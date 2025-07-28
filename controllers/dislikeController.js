import Dislike from '../models/Dislike.js'
import Like from '../models/Like.js'
import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import { executeTransaction } from '../utils/transaction.js'

// 建立噓
export const createDislike = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(400).json({ success: false, data: null, error: '缺少 meme_id' })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      const dislike = new Dislike({ meme_id, user_id: req.user?._id })
      await dislike.save({ session })

      // 更新迷因的按噓數
      await Meme.findByIdAndUpdate(meme_id, { $inc: { dislike_count: 1 } }, { session })

      return dislike
    })

    res.status(201).json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有噓（可加分頁、條件查詢）
export const getDislikes = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const dislikes = await Dislike.find(filter).sort({ createdAt: -1 })
    res.json(dislikes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 刪除噓
export const deleteDislike = async (req, res) => {
  try {
    const dislike = await Dislike.findByIdAndDelete(req.params.id)
    if (!dislike) return res.status(404).json({ error: '找不到噓' })
    res.json({ message: '噓已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 切換噓/取消噓
export const toggleDislike = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 meme_id' })
    }
    const user_id = req.user._id

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 先檢查有沒有讚，有的話先刪除並更新計數
      const existingLike = await Like.findOne({ meme_id, user_id }).session(session)
      if (existingLike) {
        await existingLike.deleteOne({ session })
        // 更新迷因的按讚數（減少）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { like_count: -1 } }, { session })
      }

      const existing = await Dislike.findOne({ meme_id, user_id }).session(session)
      if (existing) {
        // 已經噓過，則取消噓
        await existing.deleteOne({ session })
        // 更新迷因的按噓數（減少）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { dislike_count: -1 } }, { session })
        return { action: 'removed' }
      } else {
        // 尚未噓過，則新增
        await Dislike.create([{ meme_id, user_id }], { session })
        // 更新迷因的按噓數（增加）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { dislike_count: 1 } }, { session })
        return { action: 'added' }
      }
    })

    return res.json({ success: true, ...result })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
