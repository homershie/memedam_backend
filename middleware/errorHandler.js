// middleware/errorHandler.js
import { StatusCodes } from 'http-status-codes'

// 處理 MongoDB 查詢錯誤
const handleMongoQueryError = (err) => {
  if (err.message.includes('Cast to date failed')) {
    return {
      status: StatusCodes.BAD_REQUEST,
      message: '日期格式錯誤：請確保傳遞的是有效的日期字串，而不是查詢物件',
      details: '前端不應直接傳遞 MongoDB 查詢物件（如 { $gte: "date" }），而應傳遞日期字串',
      suggestion: '請檢查前端是否正確傳遞日期參數，例如：start_date=2025-01-01T00:00:00.000Z',
    }
  }
  if (err.name === 'CastError') {
    return {
      status: StatusCodes.BAD_REQUEST,
      message: '查詢參數格式錯誤',
      details: err.message,
      suggestion: '請檢查傳遞的參數格式是否正確',
    }
  }
  return null
}

// 處理驗證錯誤
const handleValidationError = (err) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error) => error.message)
    return {
      status: StatusCodes.BAD_REQUEST,
      message: '資料驗證失敗',
      details: errors,
      suggestion: '請檢查輸入的資料格式是否正確',
    }
  }
  return null
}

// 處理 JWT 錯誤
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return {
      status: StatusCodes.UNAUTHORIZED,
      message: '無效的認證令牌',
      details: '請重新登入',
      suggestion: '請檢查登入狀態或重新登入',
    }
  }
  if (err.name === 'TokenExpiredError') {
    return {
      status: StatusCodes.UNAUTHORIZED,
      message: '認證令牌已過期',
      details: '請重新登入',
      suggestion: '請重新登入以取得新的認證令牌',
    }
  }
  return null
}

// 處理 MongoDB 重複鍵錯誤
const handleDuplicateKeyError = (err) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return {
      status: StatusCodes.CONFLICT,
      message: `${field} 已存在`,
      details: `重複的 ${field}: ${err.keyValue[field]}`,
      suggestion: '請使用不同的值或檢查是否已存在相同資料',
    }
  }
  return null
}

const errorHandler = (err, req, res, next) => {
  // 詳細記錄錯誤資訊
  console.error('錯誤處理詳細資訊:', {
    error: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    user: req.user?._id,
    timestamp: new Date().toISOString(),
  })

  // 處理 JSON 格式錯誤
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: 'JSON 格式錯誤',
      details: '請檢查請求體的 JSON 格式是否正確',
      suggestion: '請確保 JSON 格式正確，例如：{"key": "value"}',
    })
  }

  // 處理 MongoDB 查詢錯誤
  const mongoError = handleMongoQueryError(err)
  if (mongoError) {
    return res.status(mongoError.status).json({
      success: false,
      error: mongoError.message,
      details: mongoError.details,
      suggestion: mongoError.suggestion,
    })
  }

  // 處理驗證錯誤
  const validationError = handleValidationError(err)
  if (validationError) {
    return res.status(validationError.status).json({
      success: false,
      error: validationError.message,
      details: validationError.details,
      suggestion: validationError.suggestion,
    })
  }

  // 處理 JWT 錯誤
  const jwtError = handleJWTError(err)
  if (jwtError) {
    return res.status(jwtError.status).json({
      success: false,
      error: jwtError.message,
      details: jwtError.details,
      suggestion: jwtError.suggestion,
    })
  }

  // 處理重複鍵錯誤
  const duplicateError = handleDuplicateKeyError(err)
  if (duplicateError) {
    return res.status(duplicateError.status).json({
      success: false,
      error: duplicateError.message,
      details: duplicateError.details,
      suggestion: duplicateError.suggestion,
    })
  }

  // 處理其他錯誤
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
  const message = err.message || '伺服器發生錯誤'

  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })

  // 如果這不是最終錯誤處理器，可以傳遞給下一個
  if (next) {
    next(err)
  }
}

// 404 錯誤處理
export const notFound = (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    error: `找不到路徑: ${req.originalUrl}`,
    suggestion: '請檢查 API 路徑是否正確',
  })
}

export default errorHandler
