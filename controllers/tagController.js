import Tag from '../models/Tag.js'

// 建立標籤
export const createTag = async (req, res) => {
  try {
    const tag = new Tag(req.body)
    await tag.save()
    res.status(201).json(tag)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有標籤（可加分頁、條件查詢）
export const getTags = async (req, res) => {
  try {
    const filter = {}
    if (req.query.lang) filter.lang = req.query.lang
    if (req.query.name) filter.name = req.query.name
    const tags = await Tag.find(filter).sort({ name: 1 })
    res.json(tags)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一標籤
export const getTagById = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id)
    if (!tag) return res.status(404).json({ error: '找不到標籤' })
    res.json(tag)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新標籤
export const updateTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!tag) return res.status(404).json({ error: '找不到標籤' })
    res.json(tag)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除標籤
export const deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id)
    if (!tag) return res.status(404).json({ error: '找不到標籤' })
    res.json({ message: '標籤已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
