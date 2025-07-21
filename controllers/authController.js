import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import bcrypt from 'bcrypt'
import { signToken } from '../utils/jwt.js'

// 本地帳密登入
export const login = async (req, res) => {
  const { username, password } = req.body
  try {
    const user = await User.findOne({ username })
    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號或密碼錯誤' })
    }
    // 密碼比對
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ success: false, message: '帳號或密碼錯誤' })
    }
    // 產生 JWT token
    const token = signToken({ _id: user._id })
    user.tokens = user.tokens || []
    user.tokens.push(token)
    await user.save()
    res.json({
      success: true,
      token,
      user: { _id: user._id, username: user.username, email: user.email },
    })
  } catch {
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

// Google 登入（OAuth2 callback）
export const googleLogin = async (req, res) => {
  // 這裡應串接 Google OAuth2，取得 user profile 後查找或建立 User
  // req.user = Google 驗證後的 user profile
  // 實際應用請串接 passport-google-oauth20 或 Google API
  res.json({ success: true, message: 'Google 登入成功（請串接 OAuth2）' })
}

// Facebook 登入（OAuth2 callback）
export const facebookLogin = async (req, res) => {
  // 這裡應串接 Facebook OAuth2，取得 user profile 後查找或建立 User
  // req.user = Facebook 驗證後的 user profile
  res.json({ success: true, message: 'Facebook 登入成功（請串接 OAuth2）' })
}

// Discord 登入（OAuth2 callback）
export const discordLogin = async (req, res) => {
  // 這裡應串接 Discord OAuth2，取得 user profile 後查找或建立 User
  // req.user = Discord 驗證後的 user profile
  res.json({ success: true, message: 'Discord 登入成功（請串接 OAuth2）' })
}

// Twitter 登入（OAuth2 callback）
export const twitterLogin = async (req, res) => {
  // 這裡應串接 Twitter OAuth2，取得 user profile 後查找或建立 User
  // req.user = Twitter 驗證後的 user profile
  res.json({ success: true, message: 'Twitter 登入成功（請串接 OAuth2）' })
}
