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

export default apiLimiter
