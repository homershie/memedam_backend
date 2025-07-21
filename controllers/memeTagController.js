import MemeTag from '../models/MemeTag.js'

// 建立迷因標籤關聯
export const createMemeTag = async (req, res) => {
  try {
    const memeTag = new MemeTag(req.body)
    await memeTag.save()
    res.status(201).json(memeTag)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有迷因標籤關聯（可加分頁、條件查詢）
export const getMemeTags = async (req, res) => {
  try {
    const filter = {}
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    if (req.query.tag_id) filter.tag_id = req.query.tag_id
    if (req.query.lang) filter.lang = req.query.lang
    const memeTags = await MemeTag.find(filter).sort({ createdAt: -1 })
    res.json(memeTags)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一迷因標籤關聯
export const getMemeTagById = async (req, res) => {
  try {
    const memeTag = await MemeTag.findById(req.params.id)
    if (!memeTag) return res.status(404).json({ error: '找不到迷因標籤關聯' })
    res.json(memeTag)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新迷因標籤關聯
export const updateMemeTag = async (req, res) => {
  try {
    const memeTag = await MemeTag.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!memeTag) return res.status(404).json({ error: '找不到迷因標籤關聯' })
    res.json(memeTag)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除迷因標籤關聯
export const deleteMemeTag = async (req, res) => {
  try {
    const memeTag = await MemeTag.findByIdAndDelete(req.params.id)
    if (!memeTag) return res.status(404).json({ error: '找不到迷因標籤關聯' })
    res.json({ message: '迷因標籤關聯已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
