import mongoose from 'mongoose'
import '../config/loadEnv.js'
import connectDB from '../config/db.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Notification from '../models/Notification.js'
import {
  createNewFollowerNotification,
  createNewCommentNotification,
  createNewLikeNotification,
  createMentionNotifications,
  createHotContentNotifications,
  createWeeklySummaryNotification,
  NOTIFICATION_TYPES
} from '../utils/notificationService.js'

// 測試通知系統
const testNotificationSystem = async () => {
  try {
    console.log('開始測試通知系統...')
    
    // 連接數據庫
    await connectDB()
    
    // 清理測試數據
    await Notification.deleteMany({ title: { $regex: '^測試' } })
    
    // 創建測試用戶
    const testUser1 = await User.findOne({ username: /test.*user.*1/i }) || 
      await User.create({
        username: 'testnotifyuser1',
        email: 'testnotify1@example.com',
        password: 'testpassword123',
        display_name: '測試用戶1'
      })
    
    const testUser2 = await User.findOne({ username: /test.*user.*2/i }) || 
      await User.create({
        username: 'testnotifyuser2', 
        email: 'testnotify2@example.com',
        password: 'testpassword123',
        display_name: '測試用戶2'
      })
    
    console.log('創建的測試用戶:', {
      user1: { id: testUser1._id, username: testUser1.username },
      user2: { id: testUser2._id, username: testUser2.username }
    })
    
    // 測試 1: 新追蹤者通知
    console.log('\n=== 測試新追蹤者通知 ===')
    await createNewFollowerNotification(testUser1._id, testUser2._id)
    const followerNotification = await Notification.findOne({
      user_id: testUser1._id,
      type: NOTIFICATION_TYPES.NEW_FOLLOWER
    }).sort({ createdAt: -1 })
    console.log('追蹤者通知:', followerNotification ? '✅ 成功' : '❌ 失敗')
    
    // 測試 2: 新按讚通知（需要先創建一個測試迷因）
    console.log('\n=== 測試新按讚通知 ===')
    const testMeme = await Meme.create({
      title: '測試迷因',
      author_id: testUser1._id,
      content: '這是一個測試迷因',
      tags: ['測試'],
      file_url: 'https://example.com/test.jpg'
    })
    
    await createNewLikeNotification(testMeme._id, testUser2._id)
    const likeNotification = await Notification.findOne({
      user_id: testUser1._id,
      type: NOTIFICATION_TYPES.NEW_LIKE
    }).sort({ createdAt: -1 })
    console.log('按讚通知:', likeNotification ? '✅ 成功' : '❌ 失敗')
    
    // 測試 3: 新留言通知
    console.log('\n=== 測試新留言通知 ===')
    await createNewCommentNotification(testMeme._id, testUser2._id, '這是一個測試留言')
    const commentNotification = await Notification.findOne({
      user_id: testUser1._id,
      type: NOTIFICATION_TYPES.NEW_COMMENT
    }).sort({ createdAt: -1 })
    console.log('留言通知:', commentNotification ? '✅ 成功' : '❌ 失敗')
    
    // 測試 4: 新提及通知
    console.log('\n=== 測試新提及通知 ===')
    const mentionContent = `嘿 @${testUser1.username} 看看這個迷因！`
    await createMentionNotifications(mentionContent, testUser2._id, testMeme._id, 'comment')
    const mentionNotification = await Notification.findOne({
      user_id: testUser1._id,
      type: NOTIFICATION_TYPES.NEW_MENTION
    }).sort({ createdAt: -1 })
    console.log('提及通知:', mentionNotification ? '✅ 成功' : '❌ 失敗')
    
    // 測試 5: 熱門內容通知
    console.log('\n=== 測試熱門內容通知 ===')
    const hotMemes = [testMeme]
    const hotResult = await createHotContentNotifications(hotMemes, [testUser1._id, testUser2._id])
    console.log('熱門內容通知:', hotResult.sent > 0 ? '✅ 成功' : '❌ 失敗', `發送了 ${hotResult.sent} 條通知`)
    
    // 測試 6: 週報摘要通知
    console.log('\n=== 測試週報摘要通知 ===')
    const weeklyStats = {
      new_followers: 5,
      total_likes: 20,
      total_comments: 8,
      memes_posted: 3
    }
    await createWeeklySummaryNotification(testUser1._id, weeklyStats)
    const summaryNotification = await Notification.findOne({
      user_id: testUser1._id,
      type: NOTIFICATION_TYPES.WEEKLY_SUMMARY
    }).sort({ createdAt: -1 })
    console.log('週報摘要通知:', summaryNotification ? '✅ 成功' : '❌ 失敗')
    
    // 顯示所有測試通知
    console.log('\n=== 通知列表 ===')
    const allNotifications = await Notification.find({
      user_id: { $in: [testUser1._id, testUser2._id] }
    }).sort({ createdAt: -1 }).limit(10)
    
    allNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. [${notification.type}] ${notification.title}: ${notification.content}`)
    })
    
    console.log('\n✅ 通知系統測試完成！')
    
    // 清理測試數據
    await testMeme.deleteOne()
    await Notification.deleteMany({ user_id: { $in: [testUser1._id, testUser2._id] } })
    console.log('✅ 測試數據已清理')
    
  } catch (error) {
    console.error('❌ 測試失敗:', error)
  } finally {
    mongoose.connection.close()
  }
}

// 運行測試
testNotificationSystem()