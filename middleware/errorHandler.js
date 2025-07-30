// middleware/errorHandler.js
import { StatusCodes } from 'http-status-codes'

const errorHandler = (err, req, res, next) => {
  // 處理 JSON 格式錯誤
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'JSON 格式錯誤',
    })
  }

  // 預設錯誤狀態碼
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
  // 預設錯誤訊息
  const message = err.message || '伺服器發生錯誤'

  // 可以在這裡加上 log 紀錄
  console.error('應用程式錯誤:', err)

  res.status(statusCode).json({
    success: false,
    message,
  })

  // 如果這不是最終錯誤處理器，可以傳遞給下一個
  if (next) {
    next(err)
  }
}

export default errorHandler
