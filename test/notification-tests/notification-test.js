import mongoose from 'mongoose'
import { createNewLikeNotification } from '../../utils/notificationService.js'
import User from '../../models/User.js'
import Meme from '../../models/Meme.js'
import Notification from '../../models/Notification.js'

// 連接資料庫
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/memedex')
    console.log('資料庫連接成功')
  } catch (error) {
    console.error('資料庫連接失敗:', error)
    process.exit(1)
  }
}

// 測試通知系統
const testNotificationSystem = async () => {
  try {
    console.log('開始測試通知系統...')

    // 1. 檢查是否有用戶和迷因
    const users = await User.find().limit(2)
    const memes = await Meme.find().limit(1)

    if (users.length < 2) {
      console.log('需要至少2個用戶來測試')
      return
    }

    if (memes.length < 1) {
      console.log('需要至少1個迷因來測試')
      return
    }

    const user1 = users[0] // 迷因作者
    const user2 = users[1] // 按讚者
    const meme = memes[0]

    console.log(`測試用戶1 (作者): ${user1.username} (${user1._id})`)
    console.log(`測試用戶2 (按讚者): ${user2.username} (${user2._id})`)
    console.log(`測試迷因: ${meme.title} (${meme._id})`)

    // 2. 檢查迷因作者
    if (meme.author_id.toString() !== user1._id.toString()) {
      console.log('迷因作者與用戶1不匹配，更新迷因作者...')
      meme.author_id = user1._id
      await meme.save()
    }

    // 3. 測試創建按讚通知
    console.log('\n開始測試按讚通知創建...')
    await createNewLikeNotification(meme._id, user2._id)

    // 4. 檢查通知是否創建成功
    const notifications = await Notification.find({
      user_id: user1._id,
      type: 'new_like',
    })
      .sort({ createdAt: -1 })
      .limit(5)

    console.log(`\n找到 ${notifications.length} 個按讚通知:`)
    notifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.content} (${notification.createdAt})`)
    })

    // 5. 檢查用戶通知設定
    console.log('\n用戶1的通知設定:')
    console.log(JSON.stringify(user1.notificationSettings, null, 2))

    console.log('\n測試完成！')
  } catch (error) {
    console.error('測試失敗:', error)
  }
}

// 執行測試
const runTest = async () => {
  await connectDB()
  await testNotificationSystem()
  await mongoose.disconnect()
  console.log('測試結束，資料庫連接已關閉')
}

runTest()
