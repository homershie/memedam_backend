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

// 調試通知系統
const debugNotificationSystem = async () => {
  try {
    console.log('=== 開始調試通知系統 ===\n')

    // 1. 檢查資料庫中的用戶
    const users = await User.find().limit(5)
    console.log(`找到 ${users.length} 個用戶:`)
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user._id})`)
      console.log(`   通知設定: ${JSON.stringify(user.notificationSettings)}`)
    })

    // 2. 檢查資料庫中的迷因
    const memes = await Meme.find().limit(5)
    console.log(`\n找到 ${memes.length} 個迷因:`)
    memes.forEach((meme, index) => {
      console.log(`${index + 1}. ${meme.title} (${meme._id})`)
      console.log(`   作者: ${meme.author_id}`)
    })

    // 3. 檢查現有的通知
    const notifications = await Notification.find().limit(10)
    console.log(`\n找到 ${notifications.length} 個通知:`)
    notifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.type} - ${notification.content}`)
      console.log(`   接收者: ${notification.user_id}`)
      console.log(`   發送者: ${notification.sender_id}`)
      console.log(`   時間: ${notification.createdAt}`)
    })

    // 4. 如果有足夠的數據，進行測試
    if (users.length >= 2 && memes.length >= 1) {
      const user1 = users[0] // 迷因作者
      const user2 = users[1] // 按讚者
      const meme = memes[0]

      console.log('\n=== 開始測試按讚通知 ===')
      console.log(`測試用戶1 (作者): ${user1.username} (${user1._id})`)
      console.log(`測試用戶2 (按讚者): ${user2.username} (${user2._id})`)
      console.log(`測試迷因: ${meme.title} (${meme._id})`)

      // 確保迷因作者正確
      if (meme.author_id.toString() !== user1._id.toString()) {
        console.log('更新迷因作者...')
        meme.author_id = user1._id
        await meme.save()
      }

      // 測試創建通知
      console.log('\n調用 createNewLikeNotification...')
      await createNewLikeNotification(meme._id, user2._id)

      // 檢查是否創建了通知
      const newNotifications = await Notification.find({
        user_id: user1._id,
        type: 'new_like',
      })
        .sort({ createdAt: -1 })
        .limit(1)

      if (newNotifications.length > 0) {
        console.log('✅ 通知創建成功!')
        console.log(`通知內容: ${newNotifications[0].content}`)
      } else {
        console.log('❌ 通知創建失敗!')
      }
    }

    console.log('\n=== 調試完成 ===')
  } catch (error) {
    console.error('調試失敗:', error)
  }
}

// 執行調試
const runDebug = async () => {
  await connectDB()
  await debugNotificationSystem()
  await mongoose.disconnect()
  console.log('調試結束，資料庫連接已關閉')
}

runDebug()
