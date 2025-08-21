// 強制設置 UTF-8 編碼和繁體中文語言環境
process.stdout.setEncoding('utf8')
process.stderr.setEncoding('utf8')
// 設置繁體中文語言環境確保正確的中文顯示
process.env.LANG = process.env.LANG || 'zh_TW.UTF-8'
process.env.LC_ALL = process.env.LC_ALL || 'zh_TW.UTF-8'
process.env.LC_CTYPE = process.env.LC_CTYPE || 'zh_TW.UTF-8'
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --trace-uncaught'

// 預先載入環境變數，確保後續模組可取得設定值
import './config/loadEnv.js'

// 預先載入所有模型，確保索引建立時模型已註冊
import './config/loadModels.js'

import express from 'express'
import crypto from 'crypto'
import cors from 'cors'
import helmet from 'helmet'
import hpp from 'hpp'
import mongoSanitize from './utils/mongoSanitize.js'
import compression from 'compression'
import cookieParser from 'cookie-parser'
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
import { performanceMonitor } from './services/asyncProcessor.js'
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
import { attachPrivacyConsent } from './middleware/privacyConsent.js'
import { optionalToken } from './middleware/auth.js'
import maintenanceScheduler from './services/maintenanceScheduler.js'
import analyticsMonitor from './services/analyticsMonitor.js'
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from './services/notificationScheduler.js'
import {
  startUserCleanupScheduler,
  stopUserCleanupScheduler,
} from './services/userCleanupScheduler.js'
import {
  startRecommendationScheduler,
  stopRecommendationScheduler,
} from './services/recommendationScheduler.js'

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
    crossOriginOpenerPolicy: { policy: 'unsafe-none' }, // 允許 OAuth 彈窗
    crossOriginEmbedderPolicy: false, // 暫時禁用以避免 ORB 問題
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // OAuth 可能需要 inline scripts
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'], // 支援更多圖片來源
        connectSrc: ["'self'", 'https:', 'wss:', '*.twitter.com', '*.x.com'], // 支援 Twitter API
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", '*.twitter.com', '*.x.com'], // 支援 Twitter OAuth 框架
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", '*.twitter.com', '*.x.com'], // 支援 Twitter OAuth 表單提交
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
    exposedHeaders: ['Set-Cookie'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
)

app.use(hpp())
app.use(mongoSanitize())
app.use(compression())
app.use(cookieParser())

// 開發環境立即配置 session 中間件（使用 MemoryStore）
if (process.env.NODE_ENV === 'development') {
  const sessionStore = new session.MemoryStore()
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'your-session-secret',
      name: 'memedam.sid',
      resave: true, // Twitter OAuth 1.0a 必須設為 true
      saveUninitialized: true, // Twitter OAuth 1.0a 必須設為 true
      cookie: {
        httpOnly: true,
        sameSite: 'lax', // 支援 OAuth 跨域流程
        secure: false, // 開發環境設為 false
        maxAge: 1000 * 60 * 60 * 2, // 2 小時
        path: '/',
      },
      rolling: false, // 避免 OAuth 流程中 session ID 變化
      unset: 'keep', // 保持 session 資料不被清除
      proxy: false,
      genid: () => {
        return crypto.randomBytes(32).toString('hex')
      },
      touchAfter: 0, // 每次請求都更新，確保 OAuth 流程中狀態同步
    }),
  )

  // Passport 初始化（在 session 配置之後）
  app.use(passport.initialize())
  app.use(passport.session())
}

// 其他中間件
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Prometheus 指標收集中間件（測試環境與顯式跳過時不註冊；確保單例）
if (process.env.NODE_ENV !== 'test' && !process.env.SKIP_METRICS) {
  if (!globalThis.__MEMEDAM_METRICS_INITIALIZED__) {
    const metrics = promBundle({
      includeMethod: true,
      includePath: true,
      includeStatusCode: true,
      promClient: { collectDefaultMetrics: {} },
      normalizePath: [
        ['^/api/memes/[0-9a-fA-F]{24}$', '/api/memes/:id'],
        ['^/api/users/[0-9a-fA-F]{24}$', '/api/users/:id'],
        ['^/api/comments/[0-9a-fA-F]{24}$', '/api/comments/:id'],
        ['^/api/collections/[0-9a-fA-F]{24}$', '/api/collections/:id'],
        ['^/api/tags/[0-9a-fA-F]{24}$', '/api/tags/:id'],
      ],
    })
    app.use(metrics)
    globalThis.__MEMEDAM_METRICS_INITIALIZED__ = true
  }
}

// Session 配置和 Passport 初始化將在 startServer 中進行

// 結構化 HTTP 請求日誌中間件
app.use(
  pinoHttp({
    logger,
    // 確保正確的編碼和格式
    autoLogging: true,
    quietReqLogger: false,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  }),
)

// 移除 morgan 以避免雙重日誌輸出和格式衝突
// 開發環境也使用 pino 統一日誌格式

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
// 迷因相關 API 暫時移除速率限制以解決 429 問題
// app.use('/api/memes', memeApiLimiter)
// app.use('/api/likes', memeApiLimiter)
// app.use('/api/dislikes', memeApiLimiter)
// app.use('/api/comments', memeApiLimiter)
// app.use('/api/tags', memeApiLimiter)
// app.use('/api/meme-tags', memeApiLimiter)
// app.use('/api/collections', memeApiLimiter)
// app.use('/api/views', memeApiLimiter)
// app.use('/api/shares', memeApiLimiter)
// app.use('/api/notifications', memeApiLimiter)
// app.use('/api/recommendations', memeApiLimiter)
// app.use('/api/analytics', memeApiLimiter)

// 其他 API 使用標準限制（排除迷因相關路徑）
app.use('/api/users', apiLimiter)
app.use('/api/admin', apiLimiter)
app.use('/api/email', apiLimiter)
app.use('/api/verification', apiLimiter)
app.use('/api/username', apiLimiter)
app.use('/api/upload', apiLimiter)
app.use('/api/announcements', apiLimiter)
app.use('/api/sponsors', apiLimiter)
app.use('/api/reports', apiLimiter)
app.use('/api/meme-versions', apiLimiter)
app.use('/api/follows', apiLimiter)
app.use('/api/test', apiLimiter)

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

// 先嘗試解析 JWT（不強制），再附加隱私同意資訊
app.use(optionalToken)
app.use(attachPrivacyConsent)

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
import usernameRoutes from './routes/usernameRoutes.js'
import sidebarRoutes from './routes/sidebarRoutes.js'
import logsRoutes from './routes/logsRoutes.js'
import feedbackRoutes from './routes/feedbackRoutes.js'
import privacyConsentRoutes from './routes/privacyConsentRoutes.js'

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
app.use('/api/username', usernameRoutes)
app.use('/api/sidebar', sidebarRoutes)
app.use('/api/logs', logsRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/privacy-consent', privacyConsentRoutes)

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
    // 連線資料庫（可以透過 SKIP_DB 跳過）
    if (!process.env.SKIP_DB) {
      try {
        await connectDB()
        // 設定 Mongoose 配置
        mongoose.set('sanitizeFilter', true)
      } catch (dbError) {
        logger.warn('資料庫連線失敗，將繼續運行但資料庫功能將受限:', dbError.message)
      }
    } else {
      logger.info('跳過資料庫連線 (SKIP_DB=true)')
    }

    // 連線 Redis（可以透過 SKIP_REDIS 跳過）
    if (!process.env.SKIP_REDIS) {
      try {
        await redisCache.connect()
      } catch (error) {
        logger.warn('Redis 連線失敗，將繼續運行但快取功能可能受限:', error.message)
      }
    } else {
      logger.info('跳過 Redis 連線 (SKIP_REDIS=true)')
    }

    // 生產環境配置 session 中間件（使用 RedisStore）
    if (process.env.NODE_ENV === 'production') {
      const isProd = process.env.NODE_ENV === 'production'
      let sessionStore

      // 確保 sessionStore 總是有一個有效的值
      if (isProd && redisCache.isEnabled && redisCache.client && redisCache.isConnected) {
        // 生產環境使用 Redis store
        sessionStore = new RedisStore({
          client: redisCache.client,
          prefix: 'sess:',
          ttl: 86400 * 7, // 7 天
        })
        logger.info('生產環境：Redis 可用，session 將使用 Redis store')
      } else {
        // Redis 不可用時使用 MemoryStore
        sessionStore = new session.MemoryStore()
        logger.warn('⚠️  生產環境使用 MemoryStore，建議檢查 Redis 配置')
      }

      // 確保 sessionStore 已正確初始化
      if (!sessionStore) {
        logger.error('❌ Session store 初始化失敗，使用預設 MemoryStore')
        sessionStore = new session.MemoryStore()
      }

      // 設定 session 中間件
      app.use(
        session({
          store: sessionStore,
          secret: process.env.SESSION_SECRET || 'your-session-secret',
          name: 'memedam.sid',
          resave: true, // Twitter OAuth 1.0a 必須設為 true
          saveUninitialized: true, // Twitter OAuth 1.0a 必須設為 true
          cookie: {
            httpOnly: true,
            sameSite: 'lax', // 支援 OAuth 跨域流程
            secure: true, // 生產環境使用 HTTPS
            maxAge: 1000 * 60 * 60 * 2, // 2 小時
            path: '/',
          },
          rolling: false, // 避免 OAuth 流程中 session ID 變化
          unset: 'keep', // 保持 session 資料不被清除
          proxy: true,
          genid: () => {
            return crypto.randomBytes(32).toString('hex')
          },
          touchAfter: 0, // 每次請求都更新，確保 OAuth 流程中狀態同步
        }),
      )

      // Passport 初始化（在 session 配置之後）
      app.use(passport.initialize())
      app.use(passport.session())
    }

    // 記錄 session 配置狀態
    logger.info('Session configured:', {
      NODE_ENV: process.env.NODE_ENV,
      store: process.env.NODE_ENV === 'production' ? 'RedisStore' : 'MemoryStore',
    })

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

    // 啟動推薦系統調度器
    try {
      startRecommendationScheduler()
      logger.info('已啟動推薦系統調度器')
    } catch (recommendationError) {
      logger.warn('推薦系統調度器啟動失敗，將繼續運行:', recommendationError.message)
    }

    // 列印所有註冊的路徑（調試用）
    // printAllRoutes(app) // 已停用路徑列表顯示

    // 測試環境不啟動伺服器，只初始化中間件
    if (process.env.NODE_ENV === 'test') {
      // 測試環境只初始化中間件，不啟動伺服器
    } else {
      app.listen(PORT, () => {
        logger.info(`伺服器運行在端口 ${PORT}`)
        logger.info(`環境: ${process.env.NODE_ENV || 'development'}`)
      })
    }
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
    stopRecommendationScheduler()
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
    stopRecommendationScheduler()
    await redisCache.disconnect()
    process.exit(0)
  } catch (error) {
    logger.error('關閉伺服器時發生錯誤:', error)
    process.exit(1)
  }
})

// 測試環境也需要初始化 session 中間件，但不啟動伺服器
if (process.env.NODE_ENV === 'test') {
  // 在測試環境中只初始化 session 中間件，跳過資料庫和 Redis 連接
  const initTestSession = async () => {
    try {
      // 配置 session store（測試環境使用 MemoryStore）
      const sessionStore = new session.MemoryStore()
      // 設定 session 中間件
      app.use(
        session({
          store: sessionStore,
          secret: process.env.SESSION_SECRET || 'test-session-secret',
          name: 'memedam.sid',
          resave: true,
          saveUninitialized: true,
          cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false, // 測試環境不使用 HTTPS
            maxAge: 1000 * 60 * 60 * 2,
            path: '/',
          },
          rolling: false,
          unset: 'keep',
          proxy: false,
          genid: () => {
            return crypto.randomBytes(32).toString('hex')
          },
          touchAfter: 0,
        }),
      )

      // Passport 初始化
      app.use(passport.initialize())
      app.use(passport.session())
    } catch (error) {
      logger.error('測試環境 session 初始化失敗:', error)
    }
  }

  initTestSession()
} else if (!process.env.SKIP_SERVER) {
  // 非測試環境正常啟動伺服器
  startServer()
}

// 導出 app 實例供測試使用
export { app }
