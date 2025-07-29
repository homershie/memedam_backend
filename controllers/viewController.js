import View from '../models/View.js'
import Meme from '../models/Meme.js'
import { executeTransaction } from '../utils/transaction.js'

// 記錄瀏覽
export const recordView = async (req, res) => {
  try {
    const { meme_id } = req.params
    const { duration = 0, referrer = '' } = req.body

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      // 檢查是否為重複瀏覽（同一用戶短時間內）
      const user_id = req.user?._id || null
      const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || ''

      // 檢查最近 5 分鐘內是否有相同用戶/IP 的瀏覽記錄
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const recentView = await View.findOne({
        meme_id,
        $or: [{ user_id: user_id }, { ip: ip }],
        createdAt: { $gte: fiveMinutesAgo },
      }).session(session)

      const isDuplicate = !!recentView

      // 建立瀏覽記錄
      const view = new View({
        meme_id,
        user_id,
        ip,
        user_agent: req.headers['user-agent'] || '',
        platform_detail: req.headers['x-platform'] || 'web',
        referrer,
        duration,
        is_duplicate: isDuplicate,
      })

      await view.save({ session })

      // 只有非重複瀏覽才更新迷因的瀏覽數
      if (!isDuplicate) {
        await Meme.findByIdAndUpdate(meme_id, { $inc: { views: 1 } }, { session })
      }

      return {
        view,
        isDuplicate,
        message: isDuplicate ? '重複瀏覽，不計入統計' : '瀏覽記錄已保存',
      }
    })

    res.status(201).json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得迷因瀏覽統計
export const getViewStats = async (req, res) => {
  try {
    const { meme_id } = req.params
    const { period = 'all' } = req.query // all, day, week, month

    let dateFilter = {}
    const now = new Date()

    switch (period) {
      case 'day':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }
        break
      case 'week':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }
        break
      case 'month':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
        break
      default:
        // all - 不設時間限制
        break
    }

    const stats = await View.aggregate([
      { $match: { meme_id: meme_id, ...dateFilter } },
      {
        $group: {
          _id: null,
          total_views: { $sum: 1 },
          unique_users: { $addToSet: '$user_id' },
          avg_duration: { $avg: '$duration' },
          total_duration: { $sum: '$duration' },
          duplicate_views: { $sum: { $cond: ['$is_duplicate', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          total_views: 1,
          unique_users: { $size: '$unique_users' },
          avg_duration: { $round: ['$avg_duration', 2] },
          total_duration: 1,
          duplicate_views: 1,
          effective_views: { $subtract: ['$total_views', '$duplicate_views'] },
        },
      },
    ])

    const result = stats[0] || {
      total_views: 0,
      unique_users: 0,
      avg_duration: 0,
      total_duration: 0,
      duplicate_views: 0,
      effective_views: 0,
    }

    res.json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得用戶瀏覽歷史
export const getUserViewHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const user_id = req.user._id

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const limitNum = parseInt(limit)

    const views = await View.find({ user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('meme_id', 'title image_url type')

    const total = await View.countDocuments({ user_id })

    res.json({
      success: true,
      data: {
        views,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: parseInt(page) < Math.ceil(total / limitNum),
          hasPrev: parseInt(page) > 1,
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得熱門迷因（基於瀏覽數）
export const getPopularMemes = async (req, res) => {
  try {
    const { page = 1, limit = 20, period = 'all' } = req.query

    let dateFilter = {}
    const now = new Date()

    switch (period) {
      case 'day':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }
        break
      case 'week':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }
        break
      case 'month':
        dateFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }
        break
      default:
        // all - 不設時間限制
        break
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const limitNum = parseInt(limit)

    const popularMemes = await View.aggregate([
      { $match: { ...dateFilter, is_duplicate: false } },
      {
        $group: {
          _id: '$meme_id',
          view_count: { $sum: 1 },
          unique_viewers: { $addToSet: '$user_id' },
          avg_duration: { $avg: '$duration' },
        },
      },
      {
        $lookup: {
          from: 'memes',
          localField: '_id',
          foreignField: '_id',
          as: 'meme',
        },
      },
      { $unwind: '$meme' },
      { $match: { 'meme.status': 'public' } },
      {
        $lookup: {
          from: 'users',
          localField: 'meme.author_id',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: '$author' },
      {
        $project: {
          _id: '$meme._id',
          title: '$meme.title',
          content: '$meme.content',
          image_url: '$meme.image_url',
          type: '$meme.type',
          status: '$meme.status',
          view_count: 1,
          unique_viewers: { $size: '$unique_viewers' },
          avg_duration: { $round: ['$avg_duration', 2] },
          author: {
            _id: '$author._id',
            username: '$author.username',
            display_name: '$author.display_name',
            avatar: '$author.avatar',
          },
        },
      },
      { $sort: { view_count: -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ])

    // 計算總數
    const totalResult = await View.aggregate([
      { $match: { ...dateFilter, is_duplicate: false } },
      { $group: { _id: '$meme_id' } },
      { $count: 'total' },
    ])

    const total = totalResult.length > 0 ? totalResult[0].total : 0

    res.json({
      success: true,
      data: {
        memes: popularMemes,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: parseInt(page) < Math.ceil(total / limitNum),
          hasPrev: parseInt(page) > 1,
        },
        period,
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 清理過期的瀏覽記錄（管理員功能）
export const cleanupOldViews = async (req, res) => {
  try {
    const { days = 90 } = req.query // 預設保留 90 天
    const cutoffDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)

    const result = await View.deleteMany({ createdAt: { $lt: cutoffDate } })

    res.json({
      success: true,
      data: {
        deleted_count: result.deletedCount,
        cutoff_date: cutoffDate,
        message: `已清理 ${result.deletedCount} 條過期瀏覽記錄`,
      },
      error: null,
    })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
