import mongoose from 'mongoose'
import Announcement from '../models/Announcement.js'
import User from '../models/User.js'
import { loadEnv } from '../config/loadEnv.js'

// 載入環境變數
loadEnv()

// 連接到資料庫
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB 連接成功')
  } catch (error) {
    console.error('MongoDB 連接失敗:', error)
    process.exit(1)
  }
}

// 創建測試公告
const createTestAnnouncements = async () => {
  try {
    // 先找到一個管理員用戶作為作者
    const adminUser = await User.findOne({ role: 'admin' })
    if (!adminUser) {
      console.log('找不到管理員用戶，請先創建一個管理員用戶')
      return
    }

    // 清除現有的測試公告
    await Announcement.deleteMany({ title: { $regex: /^測試公告/ } })
    console.log('已清除舊的測試公告')

    // 創建測試公告
    const testAnnouncements = [
      {
        title: '測試公告：系統維護通知',
        content:
          '親愛的用戶們，我們將於本週末進行系統維護，屆時網站可能會暫時無法訪問。維護時間預計為 2 小時，我們會盡快完成維護工作。感謝您的理解與支持！',
        author_id: adminUser._id,
        status: 'public',
        category: 'system',
        pinned: true,
      },
      {
        title: '測試公告：新功能上線',
        content:
          '我們很高興地宣布，迷因編輯器的新功能已經上線！現在您可以更方便地編輯和分享您的迷因作品。新功能包括：1. 更直觀的編輯介面 2. 更多濾鏡效果 3. 一鍵分享功能。快來試試看吧！',
        author_id: adminUser._id,
        status: 'public',
        category: 'update',
        pinned: false,
      },
      {
        title: '測試公告：社群活動預告',
        content:
          '下個月我們將舉辦第一屆迷因創作大賽！參賽者將有機會獲得豐厚獎品，包括現金獎勵和平台 VIP 會員資格。比賽詳情將在近期公布，敬請期待！',
        author_id: adminUser._id,
        status: 'public',
        category: 'activity',
        pinned: false,
      },
    ]

    // 插入測試公告
    const createdAnnouncements = await Announcement.insertMany(testAnnouncements)
    console.log(`成功創建 ${createdAnnouncements.length} 個測試公告`)

    // 顯示創建的公告
    createdAnnouncements.forEach((announcement, index) => {
      console.log(`${index + 1}. ${announcement.title}`)
      console.log(`   分類: ${announcement.category}`)
      console.log(`   狀態: ${announcement.status}`)
      console.log(`   置頂: ${announcement.pinned ? '是' : '否'}`)
      console.log('')
    })
  } catch (error) {
    console.error('創建測試公告失敗:', error)
  }
}

// 主函數
const main = async () => {
  await connectDB()
  await createTestAnnouncements()
  await mongoose.disconnect()
  console.log('腳本執行完成')
}

// 執行腳本
main().catch(console.error)
