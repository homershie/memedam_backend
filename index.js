import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import userRoutes from './routes/userRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
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
app.use('/products', productRoutes)
app.use('/orders', orderRoutes)

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
