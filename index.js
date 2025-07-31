import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import passport from 'passport'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB, { getDBStats } from './config/db.js'
import redisCache from './config/redis.js'
import swaggerSpecs from './config/swagger.js'
import swaggerUi from 'swagger-ui-express'
import { performanceMonitor } from './utils/asyncProcessor.js'
import { logger } from './utils/logger.js'
import { loginLimiter, registerLimiter, forgotPasswordLimiter } from './middleware/rateLimit.js'
import errorHandler, { notFound } from './middleware/errorHandler.js'
import maintenanceScheduler from './utils/maintenance.js'
import analyticsMonitor from './utils/analyticsMonitor.js'

// 載入環境變數
dotenv.config()

// 設定日誌文件
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

const app = express()

// 中間件
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Passport 初始化
app.use(passport.initialize())

// 日誌中間件
app.use(morgan('combined', { stream: accessLogStream }))
app.use(morgan('dev'))
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }),
)

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
app.use('/api/users/login', loginLimiter) // 登入特別限流
app.use('/api/users/register', registerLimiter) // 註冊限流
app.use('/api/users/forgot-password', forgotPasswordLimiter) // 忘記密碼限流

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
const printAllRoutes = (app) => {
  logger.info('=== 註冊的路徑列表 ===')

  try {
    const printRoutes = (stack, prefix = '') => {
      if (!stack || !Array.isArray(stack)) {
        return
      }

      stack.forEach((layer) => {
        if (layer.route) {
          // 這是一個路由層
          const methods = Object.keys(layer.route.methods)
          const path = prefix + layer.route.path
          logger.info(`${methods.join(',').toUpperCase()} ${path}`)
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
          // 這是一個路由器層
          const regexp = layer.regexp && layer.regexp.source ? layer.regexp.source : ''
          const cleaned = regexp.replace('^\\/', '').replace('\\/?(?=\\/|$)', '')
          const newPrefix = prefix + cleaned
          printRoutes(layer.handle.stack, newPrefix)
        }
      })
    }

    const routerStack = (app._router && app._router.stack) || (app.router && app.router.stack)

    if (routerStack) {
      printRoutes(routerStack)
    } else {
      logger.info('無法取得路由資訊')
    }
  } catch (error) {
    logger.error('列印路由時發生錯誤:', error)
  }

  logger.info('=== 路徑列表結束 ===')
}

const startServer = async () => {
  try {
    // 連線資料庫
    await connectDB()

    // 設定 Mongoose 配置
    mongoose.set('sanitizeFilter', true)

    // 連線 Redis（可選）
    try {
      await redisCache.connect()
    } catch (error) {
      logger.warn('Redis 連線失敗，將繼續運行但快取功能可能受限:', error.message)
    }

    // 啟動定期維護任務
    if (process.env.NODE_ENV === 'production') {
      maintenanceScheduler.startAllTasks()
      logger.info('生產模式：已啟動定期維護任務')
    } else {
      logger.info('開發模式：跳過定期維護任務')
    }

    // 啟動分析監控
    await analyticsMonitor.startMonitoring()
    logger.info('已啟動分析監控系統')

    // 列印所有註冊的路徑（調試用）
    printAllRoutes(app)

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
    await redisCache.disconnect()
    process.exit(0)
  } catch (error) {
    logger.error('關閉伺服器時發生錯誤:', error)
    process.exit(1)
  }
})

startServer()
