import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import morgan from 'morgan'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import { StatusCodes } from 'http-status-codes'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import userRoutes from './routes/userRoutes.js'
import memeRoutes from './routes/memeRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import collectionRoutes from './routes/collectionRoutes.js'
import dislikeRoutes from './routes/dislikeRoutes.js'
import likeRoutes from './routes/likeRoutes.js'
import shareRoutes from './routes/shareRoutes.js'
import sponsorRoutes from './routes/sponsorRoutes.js'
import followRoutes from './routes/followRoutes.js'
import memeTagRoutes from './routes/memeTagRoutes.js'
import tagRoutes from './routes/tagRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import announcementRoutes from './routes/announcementRoutes.js'
import memeVersionRoutes from './routes/memeVersionRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import viewRoutes from './routes/viewRoutes.js'
import './config/passport.js'
import connectDB from './config/db.js'
import errorHandler from './middleware/errorHandler.js'
import apiLimiter from './middleware/rateLimit.js'
import maintenanceScheduler from './utils/maintenance.js'

// 資料庫連線
connectDB()
  .then(() => {
    console.log('資料庫連線成功')
    mongoose.set('sanitizeFilter', true)

    // 啟動定期維護任務
    if (process.env.NODE_ENV === 'production') {
      maintenanceScheduler.startAllTasks()
    } else {
      console.log('開發模式：跳過定期維護任務')
    }
  })
  .catch((error) => {
    console.log('資料庫連線失敗')
    console.error('資料庫連線失敗', error)
  })

// 建立 Express 應用程式
const app = express()

// 登入路徑限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 登入路徑每 15 分鐘最多 10 次
  message: {
    success: false,
    error: '登入太多次，請15分鐘後再試。',
  },
})

// 設定日誌
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

app.use(cors())
app.use(morgan('combined', { stream: accessLogStream }))
app.use(morgan('dev'))
app.use(express.json())
app.use(passport.initialize())
// 移除全域 apiLimiter，改成針對特定路由

app.use('/users', userRoutes)
app.use('/memes', memeRoutes) // 迷因相關不限流，允許頻繁排序、篩選
app.use('/comments', commentRoutes)
app.use('/collections', collectionRoutes)
app.use('/dislikes', dislikeRoutes)
app.use('/likes', likeRoutes)
app.use('/shares', shareRoutes)
app.use('/sponsors', sponsorRoutes)
app.use('/follows', followRoutes)
app.use('/meme-tags', memeTagRoutes)
app.use('/tags', tagRoutes)
app.use('/notifications', notificationRoutes)
app.use('/announcements', announcementRoutes)
app.use('/meme-versions', memeVersionRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/admin', adminRoutes) // 管理功能路由
app.use('/views', viewRoutes) // 瀏覽統計路由
app.use('/users/login', loginLimiter) // 登入特別限流
app.use('/users/register', apiLimiter) // 註冊限流
app.use('/users/forgot-password', apiLimiter) // 忘記密碼限流

app.all(/.*/, (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: '找不到路徑',
  })
})

app.use(errorHandler)

app.listen(4000, () => {
  console.log('伺服器啟動')
})
