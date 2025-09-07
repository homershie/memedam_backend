import mongoose from 'mongoose'
import Report from '../models/Report.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Comment from '../models/Comment.js'
import '../config/loadEnv.js'

const createTestReports = async () => {
  try {
    // 直接連接資料庫
    const mongoUri = process.env.MONGO_DEV_URI || 'mongodb://localhost:27017/memedam_dev'
    console.log('正在連接資料庫:', mongoUri)
    await mongoose.connect(mongoUri)
    console.log('資料庫連接成功')

    // 獲取一些測試用戶
    const users = await User.find().limit(5)
    if (users.length === 0) {
      console.log('沒有找到用戶，請先創建一些測試用戶')
      return
    }

    // 獲取一些測試迷因
    const memes = await Meme.find().limit(10)
    if (memes.length === 0) {
      console.log('沒有找到迷因，請先創建一些測試迷因')
      return
    }

    // 獲取一些測試留言
    const comments = await Comment.find().limit(5)
    if (comments.length === 0) {
      console.log('沒有找到留言，請先創建一些測試留言')
      return
    }

    // 檢舉原因
    const reasons = ['inappropriate', 'hate_speech', 'spam', 'copyright', 'other']

    // 檢舉狀態
    const statuses = ['pending', 'processed', 'rejected']

    // 檢舉目標類型
    const targetTypes = ['meme', 'comment', 'user']

    // 創建測試檢舉資料
    const testReports = []

    // 為每個用戶創建一些檢舉
    for (let i = 0; i < 20; i++) {
      const reporter = users[Math.floor(Math.random() * users.length)]
      const reason = reasons[Math.floor(Math.random() * reasons.length)]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const targetType = targetTypes[Math.floor(Math.random() * targetTypes.length)]

      let targetId
      switch (targetType) {
        case 'meme':
          targetId = memes[Math.floor(Math.random() * memes.length)]._id
          break
        case 'comment':
          targetId = comments[Math.floor(Math.random() * comments.length)]._id
          break
        case 'user':
          targetId = users[Math.floor(Math.random() * users.length)]._id
          break
      }

      // 隨機日期（最近30天內）
      const createdAt = new Date()
      createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30))

      const report = {
        reporter_id: reporter._id,
        target_type: targetType,
        target_id: targetId,
        reason: reason,
        description: `測試檢舉描述 ${i + 1}`,
        status: status,
        createdAt: createdAt,
      }

      // 如果已處理，添加處理時間
      if (status === 'processed' || status === 'rejected') {
        report.processed_at = new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000)
        report.handler_id = users[Math.floor(Math.random() * users.length)]._id
      }

      testReports.push(report)
    }

    // 插入測試資料
    const result = await Report.insertMany(testReports)
    console.log(`成功創建 ${result.length} 個測試檢舉`)

    // 顯示統計
    const total = await Report.countDocuments()
    const pending = await Report.countDocuments({ status: 'pending' })
    const processed = await Report.countDocuments({ status: 'processed' })
    const rejected = await Report.countDocuments({ status: 'rejected' })

    console.log('檢舉統計:')
    console.log(`總數: ${total}`)
    console.log(`待處理: ${pending}`)
    console.log(`已處理: ${processed}`)
    console.log(`已拒絕: ${rejected}`)
  } catch (error) {
    console.error('創建測試檢舉失敗:', error)
  } finally {
    await mongoose.disconnect()
    console.log('已斷開資料庫連接')
  }
}

// 執行腳本
createTestReports()
