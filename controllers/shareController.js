import Share from '../models/Share.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { executeTransaction } from '../utils/transaction.js'

// 建立分享
export const createShare = async (req, res) => {
  try {
    const { meme_id } = req.body

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      if (meme_id) {
        const meme = await Meme.findById(meme_id).session(session)
        if (!meme) {
          throw new Error('迷因不存在')
        }
      }

      const share = new Share({
        ...req.body,
        user_id: req.user._id,
        ip:
          req.ip ||
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.connection?.remoteAddress ||
          req.socket?.remoteAddress ||
          '',
        user_agent: req.headers['user-agent'] || '',
      })
      await share.save({ session })

      // 更新迷因的分享數
      if (meme_id) {
        await Meme.findByIdAndUpdate(meme_id, { $inc: { share_count: 1 } }, { session })
      }

      // 更新用戶的分享數
      await User.findByIdAndUpdate(req.user._id, { $inc: { share_count: 1 } }, { session })

      return share
    })

    res.status(201).json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有分享（僅查詢自己的，可加分頁、條件查詢）
export const getShares = async (req, res) => {
  try {
    const filter = { user_id: req.user._id }
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    if (req.query.platform_detail) filter.platform_detail = req.query.platform_detail
    // 分頁
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit
    const shares = await Share.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
    const total = await Share.countDocuments(filter)
    res.json({
      success: true,
      data: shares,
      error: null,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得單一分享（僅限本人）
export const getShareById = async (req, res) => {
  try {
    const share = await Share.findById(req.params.id)
    if (!share) return res.status(404).json({ success: false, data: null, error: '找不到分享' })
    if (share.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, data: null, error: '無權限查詢此分享' })
    }
    res.json({ success: true, data: share, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 更新分享（僅限本人）
export const updateShare = async (req, res) => {
  try {
    const share = await Share.findById(req.params.id)
    if (!share) return res.status(404).json({ success: false, data: null, error: '找不到分享' })
    if (share.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, data: null, error: '無權限操作此分享' })
    }
    Object.assign(share, req.body)
    await share.save()
    res.json({ success: true, data: share, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 刪除分享（僅限本人）
export const deleteShare = async (req, res) => {
  try {
    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const share = await Share.findById(req.params.id).session(session)
      if (!share) {
        throw new Error('找不到分享')
      }

      if (share.user_id.toString() !== req.user._id.toString()) {
        throw new Error('無權限刪除此分享')
      }

      // 記錄迷因ID和用戶ID，用於更新計數
      const meme_id = share.meme_id
      const user_id = share.user_id

      await Share.findByIdAndDelete(req.params.id, { session })

      // 更新迷因的分享數（減少）
      if (meme_id) {
        await Meme.findByIdAndUpdate(meme_id, { $inc: { share_count: -1 } }, { session })
      }

      // 更新用戶的分享數（減少）
      await User.findByIdAndUpdate(user_id, { $inc: { share_count: -1 } }, { session })

      return { message: '分享已刪除' }
    })

    res.json({ success: true, data: result, error: null })
  } catch (err) {
    if (err.message === '找不到分享') {
      return res.status(404).json({ success: false, data: null, error: err.message })
    } else if (err.message === '無權限刪除此分享') {
      return res.status(403).json({ success: false, data: null, error: err.message })
    }
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
