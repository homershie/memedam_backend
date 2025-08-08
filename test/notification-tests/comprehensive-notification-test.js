import mongoose from 'mongoose'
import '../../config/loadEnv.js'
import connectDB from '../../config/db.js'
import User from '../../models/User.js'
import Meme from '../../models/Meme.js'
import Notification from '../../models/Notification.js'
import Like from '../../models/Like.js'
import Comment from '../../models/Comment.js'
import {
  createNewFollowerNotification,
  createNewCommentNotification,
  createNewLikeNotification,
  createMentionNotifications,
  NOTIFICATION_TYPES,
} from '../../utils/notificationService.js'

// 測試用戶數據
const TEST_USERS = {
  admin001: {
    _id: '687f3c43b0994c81cccd4918',
    username: 'admin001',
    display_name: '超級管理員',
    email: 'admin001@example.com',
  },
  testUser: {
    username: 'testuser001',
    display_name: '測試用戶001',
    email: 'testuser001@example.com',
    password: 'testpassword123',
  },
}

// 連接數據庫
const connectTestDB = async () => {
  try {
    await connectDB()
    console.log('✅ 數據庫連接成功')
  } catch (error) {
    console.error('❌ 數據庫連接失敗:', error)
    process.exit(1)
  }
}

// 清理測試數據
const cleanupTestData = async () => {
  try {
    // 清理測試通知
    await Notification.deleteMany({
      user_id: { $in: [TEST_USERS.admin001._id] },
    })

    // 清理測試按讚
    await Like.deleteMany({
      user_id: { $in: [TEST_USERS.admin001._id] },
    })

    // 清理測試留言
    await Comment.deleteMany({
      user_id: { $in: [TEST_USERS.admin001._id] },
    })

    console.log('✅ 測試數據清理完成')
  } catch (error) {
    console.error('❌ 清理測試數據失敗:', error)
  }
}

// 創建測試用戶
const createTestUser = async () => {
  try {
    let testUser = await User.findOne({ username: TEST_USERS.testUser.username })

    if (!testUser) {
      testUser = await User.create({
        username: TEST_USERS.testUser.username,
        display_name: TEST_USERS.testUser.display_name,
        email: TEST_USERS.testUser.email,
        password: TEST_USERS.testUser.password,
        notificationSettings: {
          browser: true,
          newFollower: true,
          newComment: true,
          newLike: true,
          newMention: true,
          trendingContent: false,
          weeklyDigest: true,
        },
      })
      console.log('✅ 創建測試用戶:', testUser.username)
    } else {
      console.log('✅ 找到現有測試用戶:', testUser.username)
    }

    return testUser
  } catch (error) {
    console.error('❌ 創建測試用戶失敗:', error)
    throw error
  }
}

// 獲取或創建測試迷因
const getOrCreateTestMeme = async (authorId) => {
  try {
    let testMeme = await Meme.findOne({
      title: '測試通知迷因',
      author_id: authorId,
    })

    if (!testMeme) {
      testMeme = await Meme.create({
        title: '測試通知迷因',
        type: 'image',
        content: '這是一個用於測試通知功能的迷因',
        author_id: authorId,
        image_url: 'https://example.com/test-meme.jpg',
        detail_markdown: '# 測試通知迷因\n\n這是一個用於測試通知功能的迷因，包含詳細介紹內容。',
        tags_cache: ['測試', '通知'],
        like_count: 0,
        comment_count: 0,
        share_count: 0,
      })
      console.log('✅ 創建測試迷因:', testMeme.title)
    } else {
      console.log('✅ 找到現有測試迷因:', testMeme.title)
    }

    return testMeme
  } catch (error) {
    console.error('❌ 創建測試迷因失敗:', error)
    throw error
  }
}

// 檢查通知是否存在
const checkNotification = async (userId, type, expectedContent = null) => {
  try {
    const notification = await Notification.findOne({
      user_id: userId,
      type: type,
    }).sort({ createdAt: -1 })

    if (notification) {
      console.log(`✅ 找到 ${type} 通知:`, notification.content)
      if (expectedContent && notification.content.includes(expectedContent)) {
        console.log('✅ 通知內容符合預期')
      }
      return notification
    } else {
      console.log(`❌ 未找到 ${type} 通知`)
      return null
    }
  } catch (error) {
    console.error('❌ 檢查通知失敗:', error)
    return null
  }
}

// 測試按讚通知
const testLikeNotification = async (testUser, meme) => {
  console.log('\n=== 測試按讚通知 ===')

  try {
    // 模擬按讚操作
    await createNewLikeNotification(meme._id, testUser._id)

    // 檢查通知是否創建
    const notification = await checkNotification(
      meme.author_id,
      NOTIFICATION_TYPES.NEW_LIKE,
      testUser.display_name,
    )

    return notification !== null
  } catch (error) {
    console.error('❌ 按讚通知測試失敗:', error)
    return false
  }
}

// 測試留言通知
const testCommentNotification = async (testUser, meme) => {
  console.log('\n=== 測試留言通知 ===')

  try {
    const commentContent = '這是一個測試留言！'

    // 模擬留言操作
    await createNewCommentNotification(meme._id, testUser._id, commentContent)

    // 檢查通知是否創建
    const notification = await checkNotification(
      meme.author_id,
      NOTIFICATION_TYPES.NEW_COMMENT,
      testUser.display_name,
    )

    return notification !== null
  } catch (error) {
    console.error('❌ 留言通知測試失敗:', error)
    return false
  }
}

// 測試提及通知
const testMentionNotification = async (testUser, meme) => {
  console.log('\n=== 測試提及通知 ===')

  try {
    const mentionContent = `嘿 @${TEST_USERS.admin001.username} 看看這個迷因！`

    // 模擬提及操作
    await createMentionNotifications(mentionContent, testUser._id, meme._id, 'comment')

    // 檢查通知是否創建
    const notification = await checkNotification(
      TEST_USERS.admin001._id,
      NOTIFICATION_TYPES.NEW_MENTION,
      testUser.display_name,
    )

    return notification !== null
  } catch (error) {
    console.error('❌ 提及通知測試失敗:', error)
    return false
  }
}

// 測試追蹤通知
const testFollowNotification = async (testUser) => {
  console.log('\n=== 測試追蹤通知 ===')

  try {
    // 模擬追蹤操作
    await createNewFollowerNotification(TEST_USERS.admin001._id, testUser._id)

    // 檢查通知是否創建
    const notification = await checkNotification(
      TEST_USERS.admin001._id,
      NOTIFICATION_TYPES.NEW_FOLLOWER,
      testUser.display_name,
    )

    return notification !== null
  } catch (error) {
    console.error('❌ 追蹤通知測試失敗:', error)
    return false
  }
}

// 檢查用戶通知設定
const checkUserNotificationSettings = async (userId) => {
  console.log('\n=== 檢查用戶通知設定 ===')

  try {
    const user = await User.findById(userId)
    if (!user) {
      console.log('❌ 用戶不存在')
      return false
    }

    console.log('用戶通知設定:', JSON.stringify(user.notificationSettings, null, 2))

    // 檢查是否啟用了相關通知
    const settings = user.notificationSettings || {}
    const requiredSettings = ['newLike', 'newComment', 'newMention', 'newFollower']

    for (const setting of requiredSettings) {
      if (settings[setting] === false) {
        console.log(`⚠️ 警告: ${setting} 通知被禁用`)
      } else {
        console.log(`✅ ${setting} 通知已啟用`)
      }
    }

    return true
  } catch (error) {
    console.error('❌ 檢查通知設定失敗:', error)
    return false
  }
}

// 顯示所有通知
const showAllNotifications = async (userId) => {
  console.log('\n=== 用戶所有通知 ===')

  try {
    const notifications = await Notification.find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(10)

    if (notifications.length === 0) {
      console.log('📭 暫無通知')
    } else {
      notifications.forEach((notification, index) => {
        console.log(
          `${index + 1}. [${notification.type}] ${notification.content} (${notification.createdAt})`,
        )
      })
    }

    return notifications
  } catch (error) {
    console.error('❌ 獲取通知失敗:', error)
    return []
  }
}

// 主測試函數
const runComprehensiveTest = async () => {
  console.log('🚀 開始全面通知功能測試...')

  try {
    // 連接數據庫
    await connectTestDB()

    // 清理舊的測試數據
    await cleanupTestData()

    // 創建測試用戶
    const testUser = await createTestUser()

    // 檢查admin001用戶
    const adminUser = await User.findById(TEST_USERS.admin001._id)
    if (!adminUser) {
      console.log('❌ admin001 用戶不存在')
      return
    }

    console.log('✅ 找到 admin001 用戶:', adminUser.username)

    // 檢查通知設定
    await checkUserNotificationSettings(TEST_USERS.admin001._id)

    // 獲取或創建測試迷因
    const testMeme = await getOrCreateTestMeme(TEST_USERS.admin001._id)

    // 執行各種通知測試
    const testResults = {
      like: await testLikeNotification(testUser, testMeme),
      comment: await testCommentNotification(testUser, testMeme),
      mention: await testMentionNotification(testUser, testMeme),
      follow: await testFollowNotification(testUser),
    }

    // 顯示測試結果
    console.log('\n=== 測試結果總結 ===')
    console.log(`按讚通知: ${testResults.like ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`留言通知: ${testResults.comment ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`提及通知: ${testResults.mention ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`追蹤通知: ${testResults.follow ? '✅ 成功' : '❌ 失敗'}`)

    // 顯示所有通知
    await showAllNotifications(TEST_USERS.admin001._id)

    // 計算成功率
    const successCount = Object.values(testResults).filter(Boolean).length
    const totalTests = Object.keys(testResults).length
    const successRate = (successCount / totalTests) * 100

    console.log(`\n📊 測試成功率: ${successRate.toFixed(1)}% (${successCount}/${totalTests})`)

    if (successRate === 100) {
      console.log('🎉 所有通知測試都通過了！')
    } else {
      console.log('⚠️ 部分通知測試失敗，請檢查相關功能')
    }
  } catch (error) {
    console.error('❌ 測試執行失敗:', error)
  } finally {
    // 關閉數據庫連接
    await mongoose.connection.close()
    console.log('✅ 測試完成，數據庫連接已關閉')
  }
}

// 執行測試
runComprehensiveTest()
