import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'

// 建立新使用者
export const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body)
    // 回傳完整用戶資料（包含 avatarUrl），但移除敏感資訊
    const userObj = user.toJSON()
    delete userObj.password
    delete userObj.tokens
    res.status(StatusCodes.CREATED).json({ success: true, user: userObj })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    }
    if (error.code === 11000) {
      // 11000 是 MongoDB duplicate key error
      const field = Object.keys(error.keyValue)[0]
      return res.status(409).json({
        success: false,
        message: `${field} 已被註冊，請更換`,
      })
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 取得單一使用者
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -tokens')
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, user })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 取得所有使用者（可加分頁）
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -tokens')
    res.json({ success: true, users })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 更新使用者
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, user })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 刪除使用者
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, message: '使用者已刪除' })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 綁定社群帳號
export const bindSocialAccount = async (req, res) => {
  try {
    const userId = req.user._id
    const { provider } = req.params
    const { socialId } = req.body // 前端應傳入社群平台的唯一 ID

    // 支援的 provider
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ success: false, message: '不支援的社群平台' })
    }

    // 檢查該社群 ID 是否已被其他帳號綁定
    const query = {}
    query[`${provider}_id`] = socialId
    const existing = await User.findOne(query)
    if (existing) {
      return res.status(409).json({ success: false, message: '此社群帳號已被其他用戶綁定' })
    }

    // 綁定到目前登入的帳號
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }

    user[`${provider}_id`] = socialId
    await user.save()

    res.json({ success: true, message: `成功綁定${provider}帳號` })
  } catch (error) {
    console.error('綁定社群帳號錯誤:', error)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 取得自己的使用者資料
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -tokens')
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, user })
  } catch {
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 更新自己的資料
export const updateMe = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, user })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(400).json({
        success: false,
        message: error.errors[key].message,
      })
    }
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 刪除自己的帳號
export const deleteMe = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, message: '使用者已刪除' })
  } catch {
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}
