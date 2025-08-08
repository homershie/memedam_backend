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
 * 刪除指定用戶
 */
const deleteUser = async () => {
  try {
    console.log('開始刪除用戶...')

    // 連接資料庫
    await mongoose.connect(process.env.MONGO_URI)
    console.log('資料庫連接成功')

    const targetEmail = 'homershie@gmail.com'
    console.log(`查找 email: ${targetEmail}`)

    // 查找用戶
    const user = await User.findOne({ email: targetEmail })

    if (user) {
      console.log('找到用戶:')
      console.log(`  - ID: ${user._id}`)
      console.log(`  - Username: ${user.username}`)
      console.log(`  - Email: ${user.email}`)
      console.log(`  - Status: ${user.status}`)
      console.log(`  - Created At: ${user.createdAt}`)

      // 確認刪除
      console.log('\n確認要刪除此用戶嗎？(y/N)')
      // 這裡需要手動確認，所以我們先標記為刪除狀態
      user.status = 'deleted'
      user.deactivate_at = new Date()
      await user.save()

      console.log('用戶已標記為刪除狀態')
    } else {
      console.log('沒有找到用戶')
    }
  } catch (error) {
    console.error('錯誤:', error.message)
  } finally {
    await mongoose.disconnect()
    console.log('操作完成')
  }
}

// 執行刪除
deleteUser()
