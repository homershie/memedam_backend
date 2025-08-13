import mongoose from 'mongoose'
import '../../config/loadEnv.js'
import connectDB from '../../config/db.js'
import User from '../../models/User.js'
import Meme from '../../models/Meme.js'
import Notification from '../../models/Notification.js'
import Like from '../../models/Like.js'
import Comment from '../../models/Comment.js'
import { createLike } from '../../controllers/likeController.js'
import { createComment } from '../../controllers/commentController.js'

// 測試用戶數據
const TEST_USERS = {
  admin001: {
    _id: '687f3c43b0994c81cccd4918',
    username: 'admin001',
    display_name: '超級管理員',
    email: 'admin001@example.com',
  },
  testUser: {
    username: 'testuser003',
    display_name: '測試用戶003',
    email: 'testuser003@example.com',
    password: 'testpassword123',
  },
}

// 模擬請求對象
const createMockRequest = (user, body = {}) => {
  return {
    user: user,
    body: body,
    params: {},
    query: {},
  }
}

// 模擬響應對象
const createMockResponse = () => {
  const res = {
    status: (code) => {
      res.statusCode = code
      return res
    },
    json: (data) => {
      res.data = data
      return res
    },
  }
  return res
}

// 測試按讚功能
const testLikeFunctionality = async (testUser, meme) => {
  console.log('\n=== 測試按讚功能 ===')

  try {
    // 模擬按讚請求
    const req = createMockRequest(testUser, { meme_id: meme._id.toString() })
    const res = createMockResponse()

    await createLike(req, res)

    if (res.statusCode === 201 && res.data?.success) {
      console.log('✅ 按讚API調用成功')
    } else {
      console.log('❌ 按讚API調用失敗:', res.data)
      return false
    }

    // 檢查按讚記錄
    const likeRecord = await Like.findOne({
      meme_id: meme._id,
      user_id: testUser._id,
    })

    if (likeRecord) {
      console.log('✅ 按讚記錄創建成功')
    } else {
      console.log('❌ 按讚記錄創建失敗')
      return false
    }

    // 檢查通知
    const notification = await Notification.findOne({
      user_id: meme.author_id,
      type: 'new_like',
      sender_id: testUser._id,
    }).sort({ createdAt: -1 })

    if (notification) {
      console.log('✅ 按讚通知創建成功:', notification.content)
      return true
    } else {
      console.log('❌ 按讚通知創建失敗')
      return false
    }
  } catch (error) {
    console.error('❌ 按讚功能測試失敗:', error)
    return false
  }
}

// 測試留言功能
const testCommentFunctionality = async (testUser, meme) => {
  console.log('\n=== 測試留言功能 ===')

  try {
    const commentContent = '這是一個端到端測試留言！'

    // 模擬留言請求
    const req = createMockRequest(testUser, {
      content: commentContent,
      meme_id: meme._id.toString(),
    })
    const res = createMockResponse()

    await createComment(req, res)

    if (res.statusCode === 201 && res.data?.success) {
      console.log('✅ 留言API調用成功')
    } else {
      console.log('❌ 留言API調用失敗:', res.data)
      return false
    }

    // 檢查留言記錄
    const commentRecord = await Comment.findOne({
      meme_id: meme._id,
      user_id: testUser._id,
      content: commentContent,
    })

    if (commentRecord) {
      console.log('✅ 留言記錄創建成功')
    } else {
      console.log('❌ 留言記錄創建失敗')
      return false
    }

    // 檢查通知
    const notification = await Notification.findOne({
      user_id: meme.author_id,
      type: 'new_comment',
      sender_id: testUser._id,
    }).sort({ createdAt: -1 })

    if (notification) {
      console.log('✅ 留言通知創建成功:', notification.content)
      return true
    } else {
      console.log('❌ 留言通知創建失敗')
      return false
    }
  } catch (error) {
    console.error('❌ 留言功能測試失敗:', error)
    return false
  }
}

// 測試提及功能
const testMentionFunctionality = async (testUser, meme) => {
  console.log('\n=== 測試提及功能 ===')

  try {
    const mentionContent = `嘿 @${TEST_USERS.admin001.username} 看看這個端到端測試迷因！`

    // 模擬提及留言請求
    const req = createMockRequest(testUser, {
      content: mentionContent,
      meme_id: meme._id.toString(),
    })
    const res = createMockResponse()

    await createComment(req, res)

    if (res.statusCode === 201 && res.data?.success) {
      console.log('✅ 提及留言API調用成功')
    } else {
      console.log('❌ 提及留言API調用失敗:', res.data)
      return false
    }

    // 檢查留言記錄
    const commentRecord = await Comment.findOne({
      meme_id: meme._id,
      user_id: testUser._id,
      content: mentionContent,
    })

    if (commentRecord) {
      console.log('✅ 提及留言記錄創建成功')
    } else {
      console.log('❌ 提及留言記錄創建失敗')
      return false
    }

    // 檢查提及通知
    const notification = await Notification.findOne({
      user_id: TEST_USERS.admin001._id,
      type: 'new_mention',
      sender_id: testUser._id,
    }).sort({ createdAt: -1 })

    if (notification) {
      console.log('✅ 提及通知創建成功:', notification.content)
      return true
    } else {
      console.log('❌ 提及通知創建失敗')
      return false
    }
  } catch (error) {
    console.error('❌ 提及功能測試失敗:', error)
    return false
  }
}

// 檢查通知設定
const checkNotificationSettings = async (userId) => {
  console.log('\n=== 檢查通知設定 ===')

  try {
    const user = await User.findById(userId)
    if (!user) {
      console.log('❌ 用戶不存在')
      return false
    }

    const settings = user.notificationSettings || {}
    console.log('通知設定:', JSON.stringify(settings, null, 2))

    // 檢查關鍵設定
    const keySettings = ['newLike', 'newComment', 'newMention']
    let allEnabled = true

    for (const setting of keySettings) {
      if (settings[setting] === false) {
        console.log(`⚠️ ${setting} 通知被禁用`)
        allEnabled = false
      } else {
        console.log(`✅ ${setting} 通知已啟用`)
      }
    }

    return allEnabled
  } catch (error) {
    console.error('❌ 檢查通知設定失敗:', error)
    return false
  }
}

// 顯示通知統計
const showNotificationStats = async (userId) => {
  console.log('\n=== 通知統計 ===')

  try {
    const notifications = await Notification.find({ user_id: userId }).sort({ createdAt: -1 })

    const stats = {
      total: notifications.length,
      unread: notifications.filter((n) => !n.is_read).length,
      byType: {},
    }

    notifications.forEach((notification) => {
      if (!stats.byType[notification.type]) {
        stats.byType[notification.type] = 0
      }
      stats.byType[notification.type]++
    })

    console.log('總通知數:', stats.total)
    console.log('未讀通知數:', stats.unread)
    console.log('按類型統計:')
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })

    return stats
  } catch (error) {
    console.error('❌ 獲取通知統計失敗:', error)
    return null
  }
}

// 主測試函數
const runEndToEndTest = async () => {
  console.log('🚀 開始端到端通知功能測試...')

  try {
    // 連接數據庫
    await connectDB()
    console.log('✅ 數據庫連接成功')

    // 創建測試用戶
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

    // 檢查admin001用戶
    const adminUser = await User.findById(TEST_USERS.admin001._id)
    if (!adminUser) {
      console.log('❌ admin001 用戶不存在')
      return
    }

    console.log('✅ 找到 admin001 用戶:', adminUser.username)

    // 檢查通知設定
    const settingsOk = await checkNotificationSettings(TEST_USERS.admin001._id)
    if (!settingsOk) {
      console.log('⚠️ 通知設定有問題，可能影響通知功能')
    }

    // 獲取或創建測試迷因
    let testMeme = await Meme.findOne({
      title: '端到端測試迷因',
      author_id: TEST_USERS.admin001._id,
    })

    if (!testMeme) {
      testMeme = await Meme.create({
        title: '端到端測試迷因',
        type: 'image',
        content: '這是一個用於端到端測試通知功能的迷因',
        author_id: TEST_USERS.admin001._id,
        image_url: 'https://example.com/e2e-test-meme.jpg',
        detail_markdown:
          '# 端到端測試迷因\n\n這是一個用於端到端測試通知功能的迷因，包含詳細介紹內容。',
        tags_cache: ['端到端測試', '通知'],
        like_count: 0,
        comment_count: 0,
        share_count: 0,
      })
      console.log('✅ 創建端到端測試迷因:', testMeme.title)
    } else {
      console.log('✅ 找到現有端到端測試迷因:', testMeme.title)
    }

    // 清理舊的測試數據
    await Notification.deleteMany({
      user_id: { $in: [TEST_USERS.admin001._id, testUser._id] },
    })
    await Like.deleteMany({
      user_id: testUser._id,
      meme_id: testMeme._id,
    })
    await Comment.deleteMany({
      user_id: testUser._id,
      meme_id: testMeme._id,
    })
    console.log('✅ 清理舊的測試數據')

    // 執行端到端測試
    const testResults = {
      like: await testLikeFunctionality(testUser, testMeme),
      comment: await testCommentFunctionality(testUser, testMeme),
      mention: await testMentionFunctionality(testUser, testMeme),
    }

    // 顯示測試結果
    console.log('\n=== 端到端測試結果總結 ===')
    console.log(`按讚功能: ${testResults.like ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`留言功能: ${testResults.comment ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`提及功能: ${testResults.mention ? '✅ 成功' : '❌ 失敗'}`)

    // 顯示通知統計
    await showNotificationStats(TEST_USERS.admin001._id)

    // 計算成功率
    const successCount = Object.values(testResults).filter(Boolean).length
    const totalTests = Object.keys(testResults).length
    const successRate = (successCount / totalTests) * 100

    console.log(`\n📊 端到端測試成功率: ${successRate.toFixed(1)}% (${successCount}/${totalTests})`)

    if (successRate === 100) {
      console.log('🎉 所有端到端通知測試都通過了！')
    } else {
      console.log('⚠️ 部分端到端通知測試失敗，請檢查相關功能')
    }
  } catch (error) {
    console.error('❌ 端到端測試執行失敗:', error)
  } finally {
    // 關閉數據庫連接
    await mongoose.connection.close()
    console.log('✅ 測試完成，數據庫連接已關閉')
  }
}

// 執行測試
runEndToEndTest()
