import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import morgan from 'morgan'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import { StatusCodes } from 'http-status-codes'
import userRoutes from './routes/userRoutes.js'
import memeRoutes from './routes/memeRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import collectionRoutes from './routes/collectionRoutes.js'
import dislikeRoutes from './routes/dislikeRoutes.js'
import likeRoutes from './routes/likeRoutes.js'
import shareRoutes from './routes/shareRoutes.js'
import sponsorRoutes from './routes/sponsorRoutes.js'
import memeTagRoutes from './routes/memeTagRoutes.js'
import tagRoutes from './routes/tagRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import announcementRoutes from './routes/announcementRoutes.js'
import memeVersionRoutes from './routes/memeVersionRoutes.js'
import './config/passport.js'
import connectDB from './config/db.js'
import errorHandler from './middleware/errorHandler.js'
import apiLimiter from './middleware/rateLimit.js'

connectDB()
  .then(() => {
    console.log('資料庫連線成功')
    mongoose.set('sanitizeFilter', true)
  })
  .catch((error) => {
    console.log('資料庫連線失敗')
    console.error('資料庫連線失敗', error)
  })

const app = express()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 登入路徑每 15 分鐘最多 10 次
  message: {
    success: false,
    error: '登入太多次，請15分鐘後再試。',
  },
})

app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(passport.initialize())
app.use(apiLimiter)

app.use('/users', userRoutes)
app.use('/memes', memeRoutes)
app.use('/comments', commentRoutes)
app.use('/collections', collectionRoutes)
app.use('/dislikes', dislikeRoutes)
app.use('/likes', likeRoutes)
app.use('/shares', shareRoutes)
app.use('/sponsors', sponsorRoutes)
app.use('/meme-tags', memeTagRoutes)
app.use('/tags', tagRoutes)
app.use('/notifications', notificationRoutes)
app.use('/announcements', announcementRoutes)
app.use('/meme-versions', memeVersionRoutes)
app.use('/users/login', loginLimiter)

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
