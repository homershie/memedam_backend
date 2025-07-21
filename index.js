import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
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
import cors from 'cors'
import { StatusCodes } from 'http-status-codes'

mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log('資料庫連線成功')
    mongoose.set('sanitizeFilter', true)
  })
  .catch((error) => {
    console.log('資料庫連線失敗')
    console.error('資料庫連線失敗', error)
  })

const app = express()

app.use(cors())

app.use(express.json())

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

app.all(/.*/, (req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    message: '找不到路徑',
  })
})

app.use((error, res) => {
  console.error('Global error:', error)

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'JSON 格式錯誤',
    })
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '伺服器內部錯誤',
  })
})

app.listen(4000, () => {
  console.log('伺服器啟動')
})
