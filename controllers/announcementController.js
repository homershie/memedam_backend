import Announcement from '../models/Announcement.js'
import { body, validationResult } from 'express-validator'

// 建立公告
export const validateCreateAnnouncement = [
  body('title').isLength({ min: 1, max: 100 }).withMessage('標題必填，且長度需在 1~100 字'),
  body('content').isLength({ min: 1, max: 2000 }).withMessage('內容必填，且長度需在 1~2000 字'),
]

export const createAnnouncement = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }

  // 使用 session 來確保原子性操作
  const session = await Announcement.startSession()
  session.startTransaction()

  try {
    const { title, content, status, category } = req.body
    const announcement = new Announcement({
      title,
      content,
      status,
      category,
      user_id: req.user?._id,
    })
    await announcement.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json({ success: true, data: announcement, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '公告標題重複，請使用不同的標題',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得所有公告（支援分頁、關鍵字搜尋、狀態過濾、預設只查 public）
export const getAnnouncements = async (req, res) => {
  try {
    const filter = {}
    // 狀態過濾，預設只查 public
    if (req.query.status) {
      filter.status = req.query.status
    } else {
      filter.status = 'public'
    }
    if (req.query.category) filter.category = req.query.category
    // 關鍵字搜尋（標題或內容）
    if (req.query.q) {
      const keyword = req.query.q.trim()
      const keywordRegex = new RegExp(keyword, 'i')
      filter.$or = [{ title: keywordRegex }, { content: keywordRegex }]
    }
    // 分頁
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    // 查詢
    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
    const total = await Announcement.countDocuments(filter)
    res.json({
      success: true,
      data: announcements,
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

// 取得單一公告
export const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
    if (!announcement)
      return res.status(404).json({ success: false, data: null, error: '找不到公告' })
    res.json({ success: true, data: announcement, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 更新公告
export const updateAnnouncement = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Announcement.startSession()
  session.startTransaction()

  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!announcement) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到公告' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: announcement, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '公告標題重複，請使用不同的標題',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(400).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除公告
export const deleteAnnouncement = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Announcement.startSession()
  session.startTransaction()

  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id).session(session)
    if (!announcement) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, data: null, error: '找不到公告' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, data: { message: '公告已刪除' }, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}
