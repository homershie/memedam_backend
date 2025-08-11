import User from '../models/User.js'
import { logger } from '../utils/logger.js';
import { StatusCodes } from 'http-status-codes'
import bcrypt from 'bcrypt'
import { signToken } from '../utils/jwt.js'

// 本地帳密登入
export const login = async (req, res) => {
  const { login, password } = req.body

  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    // 支援帳號或信箱登入
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }],
    }).session(session)

    if (!user) {
      await session.abortTransaction()
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號、信箱或密碼錯誤' })
    }

    // 密碼比對
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      await session.abortTransaction()
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
    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

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
    // 回滾事務
    await session.abortTransaction()

    logger.error('登入錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 登出
export const logout = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    // 前端需帶 token，這裡假設已經有 middleware 驗證 req.user, req.token
    req.user.tokens = req.user.tokens.filter((token) => token !== req.token)
    await req.user.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, message: '登出成功' })
  } catch {
    // 回滾事務
    await session.abortTransaction()
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刷新 token
export const refresh = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    // 假設已經有 middleware 驗證 req.user, req.token
    const i = req.user.tokens.indexOf(req.token)
    const token = signToken({ _id: req.user._id })
    req.user.tokens[i] = token
    await req.user.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, token })
  } catch {
    // 回滾事務
    await session.abortTransaction()
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}
