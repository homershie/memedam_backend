import MemeVersion from '../models/MemeVersion.js'

// 建立迷因版本
export const createMemeVersion = async (req, res) => {
  try {
    const memeVersion = new MemeVersion(req.body)
    await memeVersion.save()
    res.status(201).json(memeVersion)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有迷因版本（可加分頁、條件查詢）
export const getMemeVersions = async (req, res) => {
  try {
    const filter = {}
    if (req.query.meme) filter.meme = req.query.meme
    if (req.query.created_by) filter.created_by = req.query.created_by
    if (req.query.status) filter.status = req.query.status
    const memeVersions = await MemeVersion.find(filter).sort({ version_number: -1 })
    res.json(memeVersions)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一迷因版本
export const getMemeVersionById = async (req, res) => {
  try {
    const memeVersion = await MemeVersion.findById(req.params.id)
    if (!memeVersion) return res.status(404).json({ error: '找不到迷因版本' })
    res.json(memeVersion)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新迷因版本
export const updateMemeVersion = async (req, res) => {
  try {
    const memeVersion = await MemeVersion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!memeVersion) return res.status(404).json({ error: '找不到迷因版本' })
    res.json(memeVersion)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除迷因版本
export const deleteMemeVersion = async (req, res) => {
  try {
    const memeVersion = await MemeVersion.findByIdAndDelete(req.params.id)
    if (!memeVersion) return res.status(404).json({ error: '找不到迷因版本' })
    res.json({ message: '迷因版本已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
