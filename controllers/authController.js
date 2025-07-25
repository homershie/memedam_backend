import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import bcrypt from 'bcrypt'
import { signToken } from '../utils/jwt.js'

// 本地帳密登入
export const login = async (req, res) => {
  const { login, password } = req.body
  try {
    // 支援帳號或信箱登入
    const user = await User.findOne({
      $or: [{ username: login }, { email: login }],
    })
    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號、信箱或密碼錯誤' })
    }
    // 密碼比對
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號、信箱或密碼錯誤' })
    }
    // 產生 JWT token
    const token = signToken({ _id: user._id })
    user.tokens = user.tokens || []
    user.tokens.push(token)
    await user.save()

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
  } catch (e) {
    console.error(e)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 登出
export const logout = async (req, res) => {
  try {
    // 前端需帶 token，這裡假設已經有 middleware 驗證 req.user, req.token
    req.user.tokens = req.user.tokens.filter((token) => token !== req.token)
    await req.user.save()
    res.json({ success: true, message: '登出成功' })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 刷新 token
export const refresh = async (req, res) => {
  try {
    // 假設已經有 middleware 驗證 req.user, req.token
    const i = req.user.tokens.indexOf(req.token)
    const token = signToken({ _id: req.user._id })
    req.user.tokens[i] = token
    await req.user.save()
    res.json({ success: true, token })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
