import Like from '../models/Like.js'

// 建立讚
export const createLike = async (req, res) => {
  try {
    const like = new Like(req.body)
    await like.save()
    res.status(201).json(like)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有讚（可加分頁、條件查詢）
export const getLikes = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const likes = await Like.find(filter).sort({ createdAt: -1 })
    res.json(likes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一讚
export const getLikeById = async (req, res) => {
  try {
    const like = await Like.findById(req.params.id)
    if (!like) return res.status(404).json({ error: '找不到讚' })
    res.json(like)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新讚
export const updateLike = async (req, res) => {
  try {
    const like = await Like.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!like) return res.status(404).json({ error: '找不到讚' })
    res.json(like)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除讚
export const deleteLike = async (req, res) => {
  try {
    const like = await Like.findByIdAndDelete(req.params.id)
    if (!like) return res.status(404).json({ error: '找不到讚' })
    res.json({ message: '讚已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
