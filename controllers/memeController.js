import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import { body, validationResult } from 'express-validator'

// 建立迷因
export const validateCreateMeme = [
  body('title').isLength({ min: 1, max: 100 }).withMessage('標題必填，且長度需在 1~100 字'),
  body('content').optional().isLength({ max: 1000 }).withMessage('內容長度最多 1000 字'),
]

export const createMeme = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }
  try {
    const { title, content, images } = req.body
    const meme = new Meme({ title, content, images, user_id: req.user?._id })
    await meme.save()
    res.status(201).json({ success: true, data: meme, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
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
