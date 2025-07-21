import Comment from '../models/Comment.js'

// 建立留言
export const createComment = async (req, res) => {
  try {
    const comment = new Comment(req.body)
    await comment.save()
    res.status(201).json(comment)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有留言（可加分頁、條件查詢）
export const getComments = async (req, res) => {
  try {
    const filter = {}
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    if (req.query.parent_id) filter.parent_id = req.query.parent_id
    const comments = await Comment.find(filter).sort({ createdAt: 1 })
    res.json(comments)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一留言
export const getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
    if (!comment) return res.status(404).json({ error: '找不到留言' })
    res.json(comment)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新留言
export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!comment) return res.status(404).json({ error: '找不到留言' })
    res.json(comment)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除留言
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id)
    if (!comment) return res.status(404).json({ error: '找不到留言' })
    res.json({ message: '留言已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
