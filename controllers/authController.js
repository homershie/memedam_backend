import User from '../models/User.js'
import { logger } from '../utils/logger.js'
import { StatusCodes } from 'http-status-codes'
import bcrypt from 'bcrypt'
import { signToken } from '../utils/jwt.js'

// 本地帳密登入
export const login = async (req, res) => {
  const { login, password } = req.body

  const enableSession = process.env.NODE_ENV !== 'test'
  let session = null
  if (enableSession) {
    session = await User.startSession()
    session.startTransaction()
  }

  try {
    // 支援帳號或信箱登入
    let query = User.findOne({
      $or: [{ username: login }, { email: login }],
    })
    if (session) query = query.session(session)
    const user = await query

    if (!user) {
      if (session) await session.abortTransaction()
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號、信箱或密碼錯誤' })
    }

    // 帳號狀態檢查
    if (user.status === 'banned') {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '帳號已被封禁，無法登入',
        reason: user.ban_reason || undefined,
      })
    }
    if (user.status === 'deleted') {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '帳號已刪除或停用，無法登入',
      })
    }
    if (user.status === 'suspended') {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '帳號已暫時停權，無法登入',
      })
    }

    // 密碼比對
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      if (session) await session.abortTransaction()
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號、信箱或密碼錯誤' })
    }

    // 產生 JWT token
    const token = signToken({ _id: user._id })
    user.tokens = user.tokens || []

    // 檢查是否已達到 token 數量限制
    if (user.tokens.length >= 3) {
      // 移除最舊的 token（陣列中的第一個）
      user.tokens.shift()
    }

    user.tokens.push(token)

    // 更新最後登入時間
    user.last_login_at = new Date()

    // 如果有提供 IP 地址，也更新 last_ip
    if (req.ip) {
      user.last_ip = req.ip
    }

    // 如果有提供 User-Agent，也更新 user_agent
    if (req.headers['user-agent']) {
      user.user_agent = req.headers['user-agent']
    }

    if (session) {
      await user.save({ session })
      await session.commitTransaction()
    } else {
      await user.save()
    }

    // 回傳完整用戶資料（包含 avatarUrl），但移除敏感資訊
    const userObj = user.toJSON()
    delete userObj.password
    delete userObj.tokens

    res.json({
      success: true,
      token,
      userId: userObj._id,
      role: userObj.role,
      user: userObj,
    })
  } catch (error) {
    if (session) await session.abortTransaction()

    logger.error('登入錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    if (session) session.endSession()
  }
}

// 登出
export const logout = async (req, res) => {
  const enableSession = process.env.NODE_ENV !== 'test'
  let session = null
  if (enableSession) {
    session = await User.startSession()
    session.startTransaction()
  }

  try {
    // 前端需帶 token，這裡假設已經有 middleware 驗證 req.user, req.token
    req.user.tokens = req.user.tokens.filter((token) => token !== req.token)
    if (session) {
      await req.user.save({ session })
      await session.commitTransaction()
    } else {
      await req.user.save()
    }

    res.json({ success: true, message: '登出成功' })
  } catch {
    if (session) await session.abortTransaction()
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    if (session) session.endSession()
  }
}

// 刷新 token
export const refresh = async (req, res) => {
  const enableSession = process.env.NODE_ENV !== 'test'
  let session = null
  if (enableSession) {
    session = await User.startSession()
    session.startTransaction()
  }

  try {
    // 假設已經有 middleware 驗證 req.user, req.token
    const i = req.user.tokens.indexOf(req.token)
    const token = signToken({ _id: req.user._id })
    if (i >= 0) {
      req.user.tokens[i] = token
    } else {
      req.user.tokens = req.user.tokens || []
      req.user.tokens.push(token)
    }

    if (session) {
      await req.user.save({ session })
      await session.commitTransaction()
    } else {
      await req.user.save()
    }

    res.json({ success: true, token })
  } catch {
    if (session) await session.abortTransaction()
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    if (session) session.endSession()
  }
}
