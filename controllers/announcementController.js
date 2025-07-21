import Announcement from '../models/Announcement.js'

// 建立公告
export const createAnnouncement = async (req, res) => {
  try {
    const announcement = new Announcement(req.body)
    await announcement.save()
    res.status(201).json({ success: true, data: announcement, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
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
      filter.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
      ]
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
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!announcement)
      return res.status(404).json({ success: false, data: null, error: '找不到公告' })
    res.json({ success: true, data: announcement, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 刪除公告
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id)
    if (!announcement)
      return res.status(404).json({ success: false, data: null, error: '找不到公告' })
    res.json({ success: true, data: { message: '公告已刪除' }, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
