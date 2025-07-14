import passport from 'passport'
import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'

export const login = (req, res, next) => {
  // 使用 passport 的 login 驗證方法
  // passport.authenticate(驗證方法, 設定, 處理function)
  // session: false = 停用 cookie
  passport.authenticate('login', { session: false }, (err, user, info) => {
    if (!user || err) {
      if (info?.message === 'Missing credentials') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '帳號或密碼未填寫',
        })
      } else if (!err && info) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: info.message,
        })
      } else {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: '伺服器內部錯誤',
        })
      }
    }
    // 如果驗證成功
    // 將查詢到的使用者資料放入 req 給後續的 middleware 或 controller 使用
    req.user = user
    // 繼續下一步
    next()
  })(req, res, next)
}

export const token = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, data, info) => {
    if (!data || err) {
      // 是不是 JWT 錯誤，可能是過期、格式錯誤、SECRET 錯誤等
      if (info instanceof jwt.JsonWebTokenError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效的 token',
        })
      } else if (info) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: info.message,
        })
      } else {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: '伺服器內部錯誤',
        })
      }
    }
    // 如果驗證成功
    // 將查詢到的使用者資料放入 req 給後續的 middleware 或 controller 使用
    req.user = data.user
    req.token = data.token
    // 繼續下一步
    next()
  })(req, res, next)
}

export const admin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: '沒有權限存取此資源',
    })
  }
  next()
}
