import Dislike from '../models/Dislike.js'
import { StatusCodes } from 'http-status-codes'

// 建立噓
export const createDislike = async (req, res) => {
  try {
    const dislike = new Dislike(req.body)
    await dislike.save()
    res.status(201).json(dislike)
  } catch (err) {
    res.status(400).json({ error: err.message })
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
    const existing = await Dislike.findOne({ meme_id, user_id })
    if (existing) {
      // 已經噓過，則取消噓
      await existing.deleteOne()
      return res.json({ success: true, action: 'removed' })
    } else {
      // 尚未噓過，則新增
      await Dislike.create({ meme_id, user_id })
      return res.json({ success: true, action: 'added' })
    }
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
