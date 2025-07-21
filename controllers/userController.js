import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'

// 建立新使用者
export const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body)
    res.status(StatusCodes.CREATED).json({ success: true, user })
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
