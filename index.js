// 預先載入環境變數，確保後續模組可取得設定值
import './config/loadEnv.js'

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import hpp from 'hpp'
import mongoSanitize from './utils/mongoSanitize.js'
import compression from 'compression'
import morgan from 'morgan'
import pinoHttp from 'pino-http'
import passport from 'passport'
import mongoose from 'mongoose'
import session from 'express-session'
import RedisStore from 'connect-redis'
import promBundle from 'express-prom-bundle'
import connectDB, { getDBStats } from './config/db.js'
import redisCache from './config/redis.js'
import swaggerSpecs from './config/swagger.js'
import swaggerUi from 'swagger-ui-express'
import { performanceMonitor } from './utils/asyncProcessor.js'
import { logger } from './utils/logger.js'
import {
  apiLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  authLimiter,
  verificationEmailLimiter,
  resendVerificationLimiter,
} from './middleware/rateLimit.js'
import errorHandler, { notFound } from './middleware/errorHandler.js'
import maintenanceScheduler from './utils/maintenance.js'
import analyticsMonitor from './utils/analyticsMonitor.js'
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from './utils/notificationScheduler.js'
import {
  startUserCleanupScheduler,
  stopUserCleanupScheduler,
} from './utils/userCleanupScheduler.js'
import './config/passport.js'

const app = express()

// 在 Render 有反向代理，必加，否則 secure cookie 會失效
app.set('trust proxy', 1)

// 定義允許的來源
const allowedOrigins = [
  'https://memedam.com',
  'https://www.memedam.com',
  'https://api.memedam.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4000',
]

// 安全性中間件
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // 若有跨網域圖片/資源
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }),
)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true) // 允許非瀏覽器/工具
      return allowedOrigins.includes(origin)
        ? callback(null, true)
        : callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
)

app.use(hpp())
app.use(mongoSanitize())
app.use(compression())

// 其他中間件
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Prometheus 指標收集中間件
const metrics = promBundle({
  includeMethod: true, // 包括 HTTP 方法
  includePath: true, // 包括請求路徑
  includeStatusCode: true, // 包括狀態碼
  promClient: { collectDefaultMetrics: {} }, // 收集默認指標
  normalizePath: [
    // 規範化動態路徑，避免標籤過多
    ['^/api/memes/[0-9a-fA-F]{24}$', '/api/memes/:id'],
    ['^/api/users/[0-9a-fA-F]{24}$', '/api/users/:id'],
    ['^/api/comments/[0-9a-fA-F]{24}$', '/api/comments/:id'],
    ['^/api/collections/[0-9a-fA-F]{24}$', '/api/collections/:id'],
    ['^/api/tags/[0-9a-fA-F]{24}$', '/api/tags/:id'],
  ],
})
app.use(metrics)

// Session 配置和 Passport 初始化將在 startServer 中進行

// 結構化 HTTP 請求日誌中間件
app.use(pinoHttp({ logger }))

// 保留開發環境的 morgan（可選）
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// 效能監控中間件
app.use((req, res, next) => {
  const startTime = Date.now()
  const requestId = Date.now() + Math.random()

  performanceMonitor.start(`request_${requestId}`)

  res.on('finish', () => {
    const duration = Date.now() - startTime
    performanceMonitor.end(`request_${requestId}`)

    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`)
  })

  next()
})

// 速率限制中間件
// 全域 API 限流（基於 Redis 的分散式限流）
app.use('/api', apiLimiter) // 全域 API 限流

// 認證相關敏感路徑限流（更嚴格）
app.use(['/api/users/login', '/api/auth/login'], authLimiter) // 登入路徑
app.use(['/api/users/register', '/api/auth/register'], authLimiter) // 註冊路徑
app.use(['/api/users/forgot-password', '/api/auth/forgot-password'], authLimiter) // 忘記密碼路徑

// 特定路徑的詳細限流（保持原有的更嚴格限制）
app.use('/api/users/login', loginLimiter) // 登入特別限流
app.use('/api/users/register', registerLimiter) // 註冊限流
app.use('/api/users/forgot-password', forgotPasswordLimiter) // 忘記密碼限流

// email 驗證相關限流
app.use('/api/email/verify', verificationEmailLimiter) // 驗證 email 限流
app.use('/api/email/resend-verification', resendVerificationLimiter) // 重新發送驗證 email 限流
app.use('/api/verification/send-email', verificationEmailLimiter) // 發送驗證 email 限流
app.use('/api/verification/resend', resendVerificationLimiter) // 重新發送驗證限流

// 根路徑歡迎頁面
app.get('/', (req, res) => {
  res.json({
    message: '歡迎使用迷因典 API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      docs: '/api-docs',
      health: '/health',
      redis: '/healthz/redis',
    },
  })
})

// Swagger API 文檔
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: '迷因典 API 文檔',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      displayRequestDuration: true,
      displayOperationId: false,
      tryItOutEnabled: true,
    },
  }),
)

// API 文檔 JSON 端點
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpecs)
})

// 路由
import userRoutes from './routes/userRoutes.js'
import memeRoutes from './routes/memeRoutes.js'
import likeRoutes from './routes/likeRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import shareRoutes from './routes/shareRoutes.js'
import collectionRoutes from './routes/collectionRoutes.js'
import viewRoutes from './routes/viewRoutes.js'
import followRoutes from './routes/followRoutes.js'
import tagRoutes from './routes/tagRoutes.js'
import memeTagRoutes from './routes/memeTagRoutes.js'
import testRoutes from './routes/testRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import memeVersionRoutes from './routes/memeVersionRoutes.js'

import announcementRoutes from './routes/announcementRoutes.js'
import sponsorRoutes from './routes/sponsorRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'
import recommendationRoutes from './routes/recommendationRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import dislikeRoutes from './routes/dislikeRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import emailRoutes from './routes/emailRoutes.js'
import verificationRoutes from './routes/verificationRoutes.js'

app.use('/api/users', userRoutes)
app.use('/api/memes', memeRoutes)
app.use('/api/likes', likeRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/shares', shareRoutes)
app.use('/api/collections', collectionRoutes)
app.use('/api/views', viewRoutes)
app.use('/api/follows', followRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/meme-tags', memeTagRoutes)
app.use('/api/test', testRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/meme-versions', memeVersionRoutes)

app.use('/api/announcements', announcementRoutes)
app.use('/api/sponsors', sponsorRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/dislikes', dislikeRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/email', emailRoutes)
app.use('/api/verification', verificationRoutes)

// 健康檢查端點（簡化版，供 Render 等外部監控使用）
app.get('/healthz', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// 健康檢查端點
app.get('/health', async (req, res) => {
  try {
    const dbStats = await getDBStats()
    const dbStatus = {
      connected: dbStats !== null,
      collections: dbStats?.collections || 0,
    }

    const redisStatus = await redisCache.getStats()

    const performanceMetrics = performanceMonitor.getAllMetrics()
    const analyticsStatus = analyticsMonitor.getMonitoringStatus()

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
      performance: {
        activeRequests: Object.keys(performanceMetrics).filter(
          (key) => key.startsWith('request_') && !performanceMetrics[key].endTime,
        ).length,
        recentMetrics: Object.entries(performanceMetrics)
          .filter(([key, metric]) => key.startsWith('request_') && metric.duration)
          .slice(-10)
          .map(([key, metric]) => ({
            requestId: key.replace('request_', ''),
            duration: metric.duration,
          })),
      },
      analytics: analyticsStatus,
    })
  } catch (error) {
    logger.error('健康檢查失敗:', error)
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    })
  }
})

// Redis 健康檢查端點（ChatGPT 建議）
app.get('/healthz/redis', async (req, res) => {
  try {
    const pong = await redisCache.ping()
    if (pong === 'PONG') {
      res.json({ ok: true, ping: pong })
    } else {
      res.status(500).json({ ok: false, error: 'Redis 連線失敗' })
    }
  } catch (error) {
    logger.error('Redis 健康檢查失敗:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
})

// 效能監控端點
app.get('/api/performance', (req, res) => {
  try {
    const metrics = performanceMonitor.getAllMetrics()
    const summary = {
      totalRequests: Object.keys(metrics).filter((key) => key.startsWith('request_')).length,
      averageResponseTime: 0,
      slowestRequests: [],
      fastestRequests: [],
    }

    const requestMetrics = Object.entries(metrics)
      .filter(([key, metric]) => key.startsWith('request_') && metric.duration)
      .map(([key, metric]) => ({
        requestId: key.replace('request_', ''),
        duration: metric.duration,
        startTime: metric.startTime,
        endTime: metric.endTime,
      }))

    if (requestMetrics.length > 0) {
      const totalDuration = requestMetrics.reduce((sum, metric) => sum + metric.duration, 0)
      summary.averageResponseTime = totalDuration / requestMetrics.length

      // 最慢的請求
      summary.slowestRequests = requestMetrics.sort((a, b) => b.duration - a.duration).slice(0, 5)

      // 最快的請求
      summary.fastestRequests = requestMetrics.sort((a, b) => a.duration - b.duration).slice(0, 5)
    }

    res.json({
      metrics: summary,
      detailedMetrics: metrics,
    })
  } catch (error) {
    logger.error('取得效能監控數據失敗:', error)
    res.status(500).json({ error: error.message })
  }
})

// 快取管理端點
app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = await redisCache.getStats()
    res.json(stats)
  } catch (error) {
    logger.error('取得快取統計失敗:', error)
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/cache/clear', async (req, res) => {
  try {
    const { pattern } = req.query
    if (pattern) {
      await redisCache.delPattern(pattern)
      res.json({ message: `已清除快取模式: ${pattern}` })
    } else {
      res.status(400).json({ error: '需要提供 pattern 參數' })
    }
  } catch (error) {
    logger.error('清除快取失敗:', error)
    res.status(500).json({ error: error.message })
  }
})

// 404 處理
app.use(notFound)

// 錯誤處理中間件
app.use(errorHandler)

// 啟動伺服器
const PORT = process.env.PORT || 4000

// 調試函數：列印所有註冊的路徑
// const printAllRoutes = (app) => {
//   logger.info('=== 註冊的路徑列表 ===')

//   try {
//     const printRoutes = (stack, prefix = '') => {
//       if (!stack || !Array.isArray(stack)) {
//         return
//       }

//       stack.forEach((layer) => {
//         if (layer.route) {
//           // 這是一個路由層
//           const methods = Object.keys(layer.route.methods)
//           const path = prefix + layer.route.path
//           logger.info(`${methods.join(',').toUpperCase()} ${path}`)
//         } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
//           // 這是一個路由器層
//           const regexp = layer.regexp && layer.regexp.source ? layer.regexp.source : ''
//           const cleaned = regexp.replace('^\\/', '').replace('\\/?(?=\\/|$)', '')
//           const newPrefix = prefix + cleaned
//           printRoutes(layer.handle.stack, newPrefix)
//         }
//       })
//     }

//     const routerStack = (app._router && app._router.stack) || (app.router && app.router.stack)

//     if (routerStack) {
//       printRoutes(routerStack)
//     } else {
//       logger.info('無法取得路由資訊')
//     }
//   } catch (error) {
//     logger.error('列印路由時發生錯誤:', error)
//   }

//   logger.info('=== 路徑列表結束 ===')
// }

const startServer = async () => {
  try {
    // 連線資料庫（暫時跳過以便測試API）
    try {
      await connectDB()
      // 設定 Mongoose 配置
      mongoose.set('sanitizeFilter', true)
    } catch (dbError) {
      logger.warn('資料庫連線失敗，將繼續運行但資料庫功能將受限:', dbError.message)
    }

    // 連線 Redis（可選）
    try {
      await redisCache.connect()
    } catch (error) {
      logger.warn('Redis 連線失敗，將繼續運行但快取功能可能受限:', error.message)
    }

    // 配置 Session store（在 Redis 連接後）
    const isProd = process.env.NODE_ENV === 'production'

    // 創建 session store 函數
    const createSessionStore = () => {
      // 檢查 Redis 是否可用
      if (redisCache.isEnabled && redisCache.client && redisCache.isConnected) {
        logger.info('使用 Redis session store')
        return new RedisStore({
          client: redisCache.client,
          prefix: 'sess:',
          ttl: 60 * 60 * 24 * 7, // 7 天
        })
      } else {
        logger.warn('Redis 不可用，使用 MemoryStore 作為 session store')
        if (isProd) {
          logger.warn('生產環境使用 MemoryStore，建議檢查 Redis 配置')
        }
        return new session.MemoryStore()
      }
    }

    // 配置 session 中間件
    const sessionStore = createSessionStore()
    app.use(
      session({
        store: sessionStore,
        secret: process.env.SESSION_SECRET || 'your-session-secret',
        name: '__Host-memedam.sid', // 主域 cookie 名稱
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProd, // 只在 https 傳送
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7 天
        },
      }),
    )

    // Passport 初始化（在 session 配置之後）
    app.use(passport.initialize())
    app.use(passport.session())

    // 啟動定期維護任務
    if (process.env.NODE_ENV === 'production') {
      maintenanceScheduler.startAllTasks()
      logger.info('生產模式：已啟動定期維護任務')
    } else {
      logger.info('開發模式：跳過定期維護任務')
    }

    // 啟動分析監控（暫時跳過以便測試API）
    try {
      await analyticsMonitor.startMonitoring()
      logger.info('已啟動分析監控系統')
    } catch (monitorError) {
      logger.warn('分析監控啟動失敗，將繼續運行:', monitorError.message)
    }

    // 啟動通知調度器
    try {
      startNotificationScheduler()
      logger.info('已啟動通知調度器')
    } catch (schedulerError) {
      logger.warn('通知調度器啟動失敗，將繼續運行:', schedulerError.message)
    }

    // 啟動用戶清理調度器
    try {
      startUserCleanupScheduler()
      logger.info('已啟動用戶清理調度器')
    } catch (cleanupError) {
      logger.warn('用戶清理調度器啟動失敗，將繼續運行:', cleanupError.message)
    }

    // 列印所有註冊的路徑（調試用）
    // printAllRoutes(app) // 已停用路徑列表顯示

    app.listen(PORT, () => {
      logger.info(`伺服器運行在端口 ${PORT}`)
      logger.info(`環境: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    logger.error('啟動伺服器失敗:', error)
    process.exit(1)
  }
}

// 優雅關閉
process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信號，正在關閉伺服器...')

  try {
    stopNotificationScheduler()
    stopUserCleanupScheduler()
    await redisCache.disconnect()
    process.exit(0)
  } catch (error) {
    logger.error('關閉伺服器時發生錯誤:', error)
    process.exit(1)
  }
})

process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信號，正在關閉伺服器...')

  try {
    stopNotificationScheduler()
    stopUserCleanupScheduler()
    await redisCache.disconnect()
    process.exit(0)
  } catch (error) {
    logger.error('關閉伺服器時發生錯誤:', error)
    process.exit(1)
  }
})

startServer()

// 導出 app 實例供測試使用
export { app }
