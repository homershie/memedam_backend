import mongoose from 'mongoose'
import User from '../models/User.js'
import {
  createNewCommentNotification,
  createNewLikeNotification,
  createNewFollowerNotification,
} from '../utils/notificationService.js'

// 測試通知設定功能
const testNotificationSettings = async () => {
  try {
    console.log('開始測試通知設定功能...')

    // 創建測試用戶
    const testUser1 = new User({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'password123',
      notificationSettings: {
        newFollower: true,
        newComment: false, // 關閉留言通知
        newLike: true,
        newMention: true,
        trendingContent: false,
        weeklyDigest: true,
      },
    })

    const testUser2 = new User({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123',
      notificationSettings: {
        newFollower: false, // 關閉追蹤通知
        newComment: true,
        newLike: false, // 關閉按讚通知
        newMention: true,
        trendingContent: true,
        weeklyDigest: false,
      },
    })

    const testUser3 = new User({
      username: 'testuser3',
      email: 'test3@example.com',
      password: 'password123',
      // 使用默認設定
      notificationSettings: {
        newFollower: true,
        newComment: true,
        newLike: true,
        newMention: true,
        trendingContent: false,
        weeklyDigest: true,
      },
    })

    await testUser1.save()
    await testUser2.save()
    await testUser3.save()

    console.log('測試用戶已創建')

    // 測試追蹤通知
    console.log('\n測試追蹤通知...')
    await createNewFollowerNotification(testUser1._id, testUser2._id) // user1 應該收到通知
    await createNewFollowerNotification(testUser2._id, testUser1._id) // user2 不應該收到通知

    // 測試留言通知
    console.log('\n測試留言通知...')
    await createNewCommentNotification('fake_meme_id', testUser1._id, '測試留言內容') // user1 不應該收到通知
    await createNewCommentNotification('fake_meme_id', testUser2._id, '測試留言內容') // user2 應該收到通知

    // 測試按讚通知
    console.log('\n測試按讚通知...')
    await createNewLikeNotification('fake_meme_id', testUser1._id) // user1 應該收到通知
    await createNewLikeNotification('fake_meme_id', testUser2._id) // user2 不應該收到通知

    console.log('\n測試完成！請檢查控制台輸出以確認通知設定是否正確工作。')

    // 清理測試數據
    await User.deleteMany({ username: { $in: ['testuser1', 'testuser2', 'testuser3'] } })
    console.log('測試數據已清理')
  } catch (error) {
    console.error('測試失敗:', error)
  }
}

// 如果直接運行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  // 連接數據庫
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam')
    .then(() => {
      console.log('已連接到數據庫')
      return testNotificationSettings()
    })
    .then(() => {
      console.log('測試完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('測試過程中發生錯誤:', error)
      process.exit(1)
    })
}

export default testNotificationSettings
