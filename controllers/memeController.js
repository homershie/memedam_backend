import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'

// 建立迷因
export const createMeme = async (req, res) => {
  try {
    const meme = new Meme(req.body)
    await meme.save()
    res.status(201).json(meme)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 取得所有迷因（可加分頁、條件查詢）
export const getMemes = async (req, res) => {
  try {
    const memes = await Meme.find().sort({ createdAt: -1 })
    res.json(memes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一迷因
export const getMemeById = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme) return res.status(404).json({ error: '找不到迷因' })
    res.json(meme)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新迷因
export const updateMeme = async (req, res) => {
  try {
    const meme = await Meme.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!meme) return res.status(404).json({ error: '找不到迷因' })
    res.json(meme)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除迷因
export const deleteMeme = async (req, res) => {
  try {
    const meme = await Meme.findByIdAndDelete(req.params.id)
    if (!meme) return res.status(404).json({ error: '找不到迷因' })
    res.json({ message: '迷因已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 新增協作者
export const addEditor = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    // 僅作者或管理員可操作
    if (
      !['admin', 'manager'].includes(req.user.role) &&
      meme.author_id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: '沒有權限授權協作者' })
    }
    const { userId } = req.body
    if (!userId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 userId' })
    if (meme.editors.map((id) => id.toString()).includes(userId)) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: '該用戶已是協作者' })
    }
    meme.editors.push(userId)
    await meme.save()
    res.json({ success: true, editors: meme.editors })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 移除協作者
export const removeEditor = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    // 僅作者或管理員可操作
    if (
      !['admin', 'manager'].includes(req.user.role) &&
      meme.author_id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ success: false, message: '沒有權限移除協作者' })
    }
    const { userId } = req.body
    if (!userId)
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 userId' })
    meme.editors = meme.editors.filter((id) => id.toString() !== userId)
    await meme.save()
    res.json({ success: true, editors: meme.editors })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
