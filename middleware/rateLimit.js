import rateLimit from 'express-rate-limit'
import { RedisStore as RateLimitRedisStore } from 'rate-limit-redis'
import redisCache from '../config/redis.js'

// 檢查 Redis 是否可用的函數
const getRedisStore = (prefix = 'rl:') => {
  if (redisCache.isEnabled && redisCache.client && redisCache.isConnected) {
    return new RateLimitRedisStore({
      sendCommand: (...args) => {
        const [command, ...commandArgs] = args
        // ioredis 使用動態方法調用，將命令名轉為小寫並直接調用
        return redisCache.client[command.toLowerCase()](...commandArgs)
      },
      prefix,
    })
  }
  return undefined // 使用預設的 MemoryStore
}

// 迷因相關 API 寬鬆限流：每 15 分鐘，已登入用戶 10000 次，未登入 2000 次
const memeApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: (req) => (req.user ? 10000 : 2000), // 迷因相關 API 更寬鬆的限制
  message: {
    success: false,
    error: '迷因相關請求太多次，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('rl:meme:'),
})

// 全域 API 限流：每 15 分鐘，已登入用戶 1000 次，未登入 200 次
// 但排除迷因相關路徑
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: (req) => (req.user ? 1000 : 200), // 根據登入狀態設定不同限制
  message: {
    success: false,
    error: '請求太多次，請稍後再試。',
  },
  standardHeaders: true, // 回傳 RateLimit-* headers
  legacyHeaders: false, // 不回傳 X-RateLimit-* headers
  store: getRedisStore('rl:api:'),
  skip: (req) => {
    // 跳過迷因相關路徑，讓它們使用更寬鬆的限制
    const memePaths = [
      '/api/memes',
      '/api/likes',
      '/api/dislikes',
      '/api/comments',
      '/api/tags',
      '/api/meme-tags',
      '/api/collections',
      '/api/views',
      '/api/shares',
      '/api/notifications',
      '/api/recommendations',
      '/api/analytics',
    ]

    // 跳過管理員的檢舉相關路徑
    if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
      if (req.path.startsWith('/api/reports')) {
        return true
      }
    }

    // 跳過用戶狀態檢查端點
    if (req.path === '/api/users/me') {
      return true
    }

    return memePaths.some((path) => req.path.startsWith(path))
  },
})

// 檢舉提交限流：24 小時內最多 5 次檢舉，7 日內最多 20 次檢舉
const reportSubmissionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 小時
  max: 5, // 24 小時內最多 5 次檢舉
  message: {
    success: false,
    error: '檢舉提交過於頻繁，24小時內最多可提交5次檢舉。',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('rl:report:24h:'),
  keyGenerator: (req) => {
    // 使用用戶ID作為key，確保每個用戶都有獨立的限制
    const key = req.user ? `user:${req.user._id}` : `ip:${req.ip}`
    console.log(`🔑 Rate Limit Key (24h): ${key} for user: ${req.user?.email || 'anonymous'}`)
    return key
  },
  skip: (req) => {
    // 跳過管理員的檢舉限制
    if (req.user && req.user.role === 'admin') {
      console.log(`🚀 跳過管理員 ${req.user.email} 的檢舉限制`)
      return true
    }
    return false
  },
})

// 檢舉提交週限流：7 日內最多 20 次檢舉
const reportWeeklyLimiter = rateLimit({
  windowMs: 7 * 24 * 60 * 60 * 1000, // 7 天
  max: 20, // 7 日內最多 20 次檢舉
  message: {
    success: false,
    error: '檢舉提交過於頻繁，7日內最多可提交20次檢舉。',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('rl:report:7d:'),
  keyGenerator: (req) => {
    // 使用用戶ID作為key，確保每個用戶都有獨立的限制
    const key = req.user ? `user:${req.user._id}` : `ip:${req.ip}`
    console.log(`🔑 Rate Limit Key (7d): ${key} for user: ${req.user?.email || 'anonymous'}`)
    return key
  },
  skip: (req) => {
    // 跳過管理員的檢舉限制
    if (req.user && req.user.role === 'admin') {
      console.log(`🚀 跳過管理員 ${req.user.email} 的檢舉限制`)
      return true
    }
    return false
  },
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
  store: getRedisStore('rl:login:'),
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
  store: getRedisStore('rl:register:'),
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
  store: getRedisStore('rl:forgot:'),
})

// 驗證 email 限流：每個 IP 每 5 分鐘最多 1 次
const verificationEmailLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  max: 1, // 限制每個 IP 1 次驗證 email 請求
  message: {
    success: false,
    error: '發送驗證 email 過於頻繁，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('rl:verify:'),
})

// 重新發送驗證 email 限流：每個 IP 每 60 秒最多 1 次
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 秒
  max: 1, // 限制每個 IP 1 次重新發送請求
  message: {
    success: false,
    error: '重新發送驗證 email 過於頻繁，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('rl:resend:'),
})

// 認證相關限流：針對敏感的認證路徑
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 分鐘
  max: 30, // 限制每個 IP 30 次認證請求
  message: {
    success: false,
    error: '認證請求太多次，請稍後再試。',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('rl:auth:'),
})

export {
  apiLimiter,
  memeApiLimiter,
  reportSubmissionLimiter,
  reportWeeklyLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  verificationEmailLimiter,
  resendVerificationLimiter,
  authLimiter,
}
export default apiLimiter
