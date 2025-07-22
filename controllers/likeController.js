import Like from '../models/Like.js'
import Dislike from '../models/Dislike.js'
import { StatusCodes } from 'http-status-codes'

// 建立讚
export const createLike = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(400).json({ success: false, data: null, error: '缺少 meme_id' })
    }
    const like = new Like({ meme_id, user_id: req.user?._id })
    await like.save()
    res.status(201).json({ success: true, data: like, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有讚（可加分頁、條件查詢）
export const getLikes = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const likes = await Like.find(filter).sort({ createdAt: -1 })
    res.json(likes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 刪除讚
export const deleteLike = async (req, res) => {
  try {
    const like = await Like.findByIdAndDelete(req.params.id)
    if (!like) return res.status(404).json({ error: '找不到讚' })
    res.json({ message: '讚已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 切換讚/取消讚
export const toggleLike = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 meme_id' })
    }
    const user_id = req.user._id

    // 先檢查有沒有噓，有的話先刪除
    await Dislike.deleteOne({ meme_id, user_id })

    const existing = await Like.findOne({ meme_id, user_id })
    if (existing) {
      // 已經按讚過，則取消讚
      await existing.deleteOne()
      return res.json({ success: true, action: 'removed' })
    } else {
      // 尚未按讚過，則新增
      await Like.create({ meme_id, user_id })
      return res.json({ success: true, action: 'added' })
    }
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
