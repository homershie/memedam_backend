import passport from 'passport'
import { StatusCodes } from 'http-status-codes'
import jwt from 'jsonwebtoken'
import Report from '../models/Report.js'
import Meme from '../models/Meme.js'
import Comment from '../models/Comment.js'

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

// 會員（user、vip、manager、admin）皆可
export const isUser = (req, res, next) => {
  if (!req.user || !['user', 'vip', 'manager', 'admin'].includes(req.user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: '需要會員權限',
    })
  }
  next()
}

// 付費會員（vip、manager、admin）
export const isVip = (req, res, next) => {
  if (!req.user || !['vip', 'manager', 'admin'].includes(req.user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: '需要付費會員權限',
    })
  }
  next()
}

// 管理員助理（manager、admin）
export const isManager = (req, res, next) => {
  if (!req.user || !['manager', 'admin'].includes(req.user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: '需要管理員助理權限',
    })
  }
  next()
}

// 管理員（admin）
export const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: '需要管理員權限',
    })
  }
  next()
}

// 可以編輯舉報
export const canEditReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
    if (!report) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到舉報' })
    }
    // manager/admin 可編輯
    if (['manager', 'admin'].includes(req.user.role)) return next()
    // 檢舉者本人可編輯（建議僅限 pending 狀態）
    if (report.reporter_id.toString() === req.user._id.toString() && report.status === 'pending')
      return next()
    // 其他人禁止
    return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: '沒有權限編輯此舉報' })
  } catch {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: '伺服器錯誤' })
  }
}

// 檢查是否有權限查詢舉報
export const canViewReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
    if (!report) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到舉報' })
    }
    // manager/admin 可查詢
    if (['manager', 'admin'].includes(req.user.role)) return next()
    // 檢舉者本人可查詢
    if (report.reporter_id.toString() === req.user._id.toString()) return next()
    // 其他人禁止
    return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: '沒有權限查詢此舉報' })
  } catch {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: '伺服器錯誤' })
  }
}

export const canEditMeme = async (req, res, next) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    }
    // 管理員/助理可編輯
    if (['manager', 'admin'].includes(req.user.role)) return next()
    // 作者本人可編輯
    if (meme.author_id.toString() === req.user._id.toString()) return next()
    // 被授權編輯者可編輯
    if (meme.editors && meme.editors.map((id) => id.toString()).includes(req.user._id.toString()))
      return next()
    // 其他人禁止
    return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: '沒有權限編輯此迷因' })
  } catch {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: '伺服器錯誤' })
  }
}

// 檢查是否有權限編輯/刪除留言
export const canEditComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id)
    if (!comment) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到留言' })
    }
    // manager/admin 可編輯
    if (['manager', 'admin'].includes(req.user.role)) return next()
    // 留言者本人可編輯
    if (comment.user_id.toString() === req.user._id.toString()) return next()
    // 其他人禁止
    return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: '沒有權限編輯此留言' })
  } catch {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: '伺服器錯誤' })
  }
}
