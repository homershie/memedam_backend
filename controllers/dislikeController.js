import Dislike from '../models/Dislike.js'

// 建立噓
export const createDislike = async (req, res) => {
  try {
    const dislike = new Dislike(req.body)
    await dislike.save()
    res.status(201).json(dislike)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有噓（可加分頁、條件查詢）
export const getDislikes = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const dislikes = await Dislike.find(filter).sort({ createdAt: -1 })
    res.json(dislikes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一噓
export const getDislikeById = async (req, res) => {
  try {
    const dislike = await Dislike.findById(req.params.id)
    if (!dislike) return res.status(404).json({ error: '找不到噓' })
    res.json(dislike)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新噓
export const updateDislike = async (req, res) => {
  try {
    const dislike = await Dislike.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!dislike) return res.status(404).json({ error: '找不到噓' })
    res.json(dislike)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除噓
export const deleteDislike = async (req, res) => {
  try {
    const dislike = await Dislike.findByIdAndDelete(req.params.id)
    if (!dislike) return res.status(404).json({ error: '找不到噓' })
    res.json({ message: '噓已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
