import Announcement from '../models/Announcement.js'

// 建立公告
export const createAnnouncement = async (req, res) => {
  try {
    const announcement = new Announcement(req.body)
    await announcement.save()
    res.status(201).json(announcement)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有公告（可加分頁、條件查詢）
export const getAnnouncements = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.category) filter.category = req.query.category
    const announcements = await Announcement.find(filter).sort({ createdAt: -1 })
    res.json(announcements)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一公告
export const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
    if (!announcement) return res.status(404).json({ error: '找不到公告' })
    res.json(announcement)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新公告
export const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!announcement) return res.status(404).json({ error: '找不到公告' })
    res.json(announcement)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除公告
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id)
    if (!announcement) return res.status(404).json({ error: '找不到公告' })
    res.json({ message: '公告已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
