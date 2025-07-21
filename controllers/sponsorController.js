import Sponsor from '../models/Sponsor.js'

// 建立贊助
export const createSponsor = async (req, res) => {
  try {
    const sponsor = new Sponsor({
      ...req.body,
      created_ip: req.ip || req.headers['x-forwarded-for'] || '',
    })
    await sponsor.save()
    res.status(201).json({ success: true, data: sponsor, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有贊助（支援分頁、條件查詢、排序、populate user）
export const getSponsors = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.status) filter.status = req.query.status
    if (req.query.q) {
      const keyword = req.query.q.trim()
      filter.message = { $regex: keyword, $options: 'i' }
    }
    if (req.query.min_amount)
      filter.amount = { ...filter.amount, $gte: Number(req.query.min_amount) }
    if (req.query.max_amount)
      filter.amount = { ...filter.amount, $lte: Number(req.query.max_amount) }
    // 分頁
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    // 排序
    let sort = { createdAt: -1 }
    if (req.query.sort_by) {
      const dir = req.query.sort_dir === 'asc' ? 1 : -1
      sort = { [req.query.sort_by]: dir }
    }
    // 查詢
    const sponsors = await Sponsor.find(filter)
      .populate('user_id', 'nickname avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
    const total = await Sponsor.countDocuments(filter)
    res.json({
      success: true,
      data: sponsors,
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

// 取得單一贊助
export const getSponsorById = async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id).populate('user_id', 'nickname avatar')
    if (!sponsor) return res.status(404).json({ success: false, data: null, error: '找不到贊助' })
    // 僅本人或管理員可查
    if (
      sponsor.user_id._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      return res.status(403).json({ success: false, data: null, error: '無權限查詢此贊助' })
    }
    res.json({ success: true, data: sponsor, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 更新贊助
export const updateSponsor = async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id)
    if (!sponsor) return res.status(404).json({ success: false, data: null, error: '找不到贊助' })
    // 僅本人或管理員可改
    if (
      sponsor.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      return res.status(403).json({ success: false, data: null, error: '無權限修改此贊助' })
    }
    // 更新
    Object.assign(sponsor, req.body)
    await sponsor.save()
    res.json({ success: true, data: sponsor, error: null })
  } catch (err) {
    res.status(400).json({ success: false, data: null, error: err.message })
  }
}

// 刪除贊助
export const deleteSponsor = async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id)
    if (!sponsor) return res.status(404).json({ success: false, data: null, error: '找不到贊助' })
    // 僅本人或管理員可刪
    if (
      sponsor.user_id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'manager'
    ) {
      return res.status(403).json({ success: false, data: null, error: '無權限刪除此贊助' })
    }
    await sponsor.deleteOne()
    res.json({ success: true, data: null, error: null, message: '贊助已刪除' })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}
