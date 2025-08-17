import mongoose from 'mongoose'
import User from '../models/User.js'
import { logger } from './logger.js'
import '../config/loadEnv.js'

// 更新現有用戶的 has_password 欄位
export const updateHasPasswordField = async () => {
  try {
    logger.info('開始更新用戶的 has_password 欄位...')

    // 找到所有有密碼的用戶
    const usersWithPassword = await User.find({
      password: { $exists: true, $ne: '' },
    })

    logger.info(`找到 ${usersWithPassword.length} 個有密碼的用戶`)

    // 更新這些用戶的 has_password 欄位
    const updatePromises = usersWithPassword.map((user) => {
      return User.updateOne({ _id: user._id }, { $set: { has_password: true } })
    })

    await Promise.all(updatePromises)

    // 找到所有沒有密碼的用戶（社群登入用戶）
    const usersWithoutPassword = await User.find({
      $or: [{ password: { $exists: false } }, { password: '' }, { password: null }],
    })

    logger.info(`找到 ${usersWithoutPassword.length} 個沒有密碼的用戶`)

    // 更新這些用戶的 has_password 欄位
    const updatePromises2 = usersWithoutPassword.map((user) => {
      return User.updateOne({ _id: user._id }, { $set: { has_password: false } })
    })

    await Promise.all(updatePromises2)

    logger.info('has_password 欄位更新完成')

    // 驗證更新結果
    const totalUsers = await User.countDocuments()
    const usersWithHasPassword = await User.countDocuments({ has_password: true })
    const usersWithoutHasPassword = await User.countDocuments({ has_password: false })

    logger.info(`總用戶數: ${totalUsers}`)
    logger.info(`有密碼的用戶: ${usersWithHasPassword}`)
    logger.info(`沒有密碼的用戶: ${usersWithoutHasPassword}`)
  } catch (error) {
    logger.error('更新 has_password 欄位時發生錯誤:', error)
    throw error
  }
}

// 主執行函數（測試環境不自動執行/exit）
const main = async () => {
  try {
    console.log('開始執行 has_password 更新腳本...')
    console.log('環境變數 MONGO_URI:', process.env.MONGO_URI ? '已設定' : '未設定')

    // 連接到資料庫
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/memedam'
    console.log('正在連接到資料庫:', mongoUri)

    await mongoose.connect(mongoUri)
    console.log('成功連接到資料庫')

    await updateHasPasswordField()
    console.log('腳本執行完成')
  } catch (error) {
    console.error('腳本執行失敗:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0)
    }
  }
}

// 直接執行
if (process.env.NODE_ENV !== 'test') {
  main()
}
