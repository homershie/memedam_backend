import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import User from '../../models/User.js'

// 載入環境變數
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

/**
 * 簡單的 email 檢查測試
 */
const simpleEmailCheck = async () => {
  try {
    console.log('開始檢查...')
    console.log('MONGO_URI:', process.env.MONGO_URI ? '已設定' : '未設定')

    // 檢查資料庫連接
    if (mongoose.connection.readyState !== 1) {
      console.log('嘗試連接資料庫...')
      await mongoose.connect(process.env.MONGO_URI)
      console.log('資料庫連接成功')
    }

    const targetEmail = 'homershie@gmail.com'
    console.log(`檢查 email: ${targetEmail}`)

    // 簡單查詢
    const users = await User.find({ email: targetEmail }).lean()
    console.log(`找到 ${users.length} 個用戶記錄`)

    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`用戶 ${index + 1}:`)
        console.log(`  - ID: ${user._id}`)
        console.log(`  - Username: ${user.username}`)
        console.log(`  - Email: ${user.email}`)
        console.log(`  - Status: ${user.status}`)
        console.log(`  - Email Verified: ${user.email_verified}`)
        console.log(`  - Created At: ${user.createdAt}`)
        console.log('---')
      })
    } else {
      console.log('沒有找到任何用戶記錄')
    }

    // 檢查索引
    console.log('檢查索引...')
    const indexes = await User.collection.getIndexes()
    console.log('索引:', Object.keys(indexes))
  } catch (error) {
    console.error('錯誤:', error.message)
  } finally {
    await mongoose.disconnect()
    console.log('檢查完成')
  }
}

// 執行檢查
simpleEmailCheck()
