import rateLimit from 'express-rate-limit'

// 基本設定：每個 IP 每 15 分鐘最多 100 次請求
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制每個 IP 100 次
  message: {
    success: false,
    error: '請求太多次，請稍後再試。',
  },
  standardHeaders: true, // 回傳 RateLimit-* headers
  legacyHeaders: false, // 不回傳 X-RateLimit-* headers
})

// 登入特別限流：每個 IP 每 15 分鐘最多 5 次登入嘗試
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 限制每個 IP 5 次登入嘗試
  message: {
    success: false,
    error: '登入嘗試太多次，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// 註冊限流：每個 IP 每小時最多 3 次註冊
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 3, // 限制每個 IP 3 次註冊
  message: {
    success: false,
    error: '註冊嘗試太多次，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// 忘記密碼限流：每個 IP 每小時最多 3 次忘記密碼請求
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 3, // 限制每個 IP 3 次忘記密碼請求
  message: {
    success: false,
    error: '忘記密碼請求太多次，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export { apiLimiter, loginLimiter, registerLimiter, forgotPasswordLimiter }
export default apiLimiter
