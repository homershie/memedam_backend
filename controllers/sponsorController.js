import Sponsor from '../models/Sponsor.js'

// 建立贊助
export const createSponsor = async (req, res) => {
  try {
    const sponsor = new Sponsor(req.body)
    await sponsor.save()
    res.status(201).json(sponsor)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有贊助（可加分頁、條件查詢）
export const getSponsors = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.status) filter.status = req.query.status
    const sponsors = await Sponsor.find(filter).sort({ createdAt: -1 })
    res.json(sponsors)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一贊助
export const getSponsorById = async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id)
    if (!sponsor) return res.status(404).json({ error: '找不到贊助' })
    res.json(sponsor)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新贊助
export const updateSponsor = async (req, res) => {
  try {
    const sponsor = await Sponsor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!sponsor) return res.status(404).json({ error: '找不到贊助' })
    res.json(sponsor)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除贊助
export const deleteSponsor = async (req, res) => {
  try {
    const sponsor = await Sponsor.findByIdAndDelete(req.params.id)
    if (!sponsor) return res.status(404).json({ error: '找不到贊助' })
    res.json({ message: '贊助已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
