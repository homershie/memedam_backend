import Collection from '../models/Collection.js'

// 建立收藏
export const createCollection = async (req, res) => {
  try {
    const collection = new Collection(req.body)
    await collection.save()
    res.status(201).json(collection)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有收藏（可加分頁、條件查詢）
export const getCollections = async (req, res) => {
  try {
    const filter = {}
    if (req.query.user_id) filter.user_id = req.query.user_id
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const collections = await Collection.find(filter).sort({ createdAt: -1 })
    res.json(collections)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一收藏
export const getCollectionById = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id)
    if (!collection) return res.status(404).json({ error: '找不到收藏' })
    res.json(collection)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新收藏
export const updateCollection = async (req, res) => {
  try {
    const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!collection) return res.status(404).json({ error: '找不到收藏' })
    res.json(collection)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除收藏
export const deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id)
    if (!collection) return res.status(404).json({ error: '找不到收藏' })
    res.json({ message: '收藏已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
