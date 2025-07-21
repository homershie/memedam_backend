import Share from '../models/Share.js'

// 建立分享
export const createShare = async (req, res) => {
  try {
    const share = new Share(req.body)
    await share.save()
    res.status(201).json(share)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有分享（可加分頁、條件查詢）
export const getShares = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const shares = await Share.find(filter).sort({ createdAt: -1 })
    res.json(shares)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一分享
export const getShareById = async (req, res) => {
  try {
    const share = await Share.findById(req.params.id)
    if (!share) return res.status(404).json({ error: '找不到分享' })
    res.json(share)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新分享
export const updateShare = async (req, res) => {
  try {
    const share = await Share.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!share) return res.status(404).json({ error: '找不到分享' })
    res.json(share)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除分享
export const deleteShare = async (req, res) => {
  try {
    const share = await Share.findByIdAndDelete(req.params.id)
    if (!share) return res.status(404).json({ error: '找不到分享' })
    res.json({ message: '分享已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
