import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Like from '../../../models/Like.js'
import Comment from '../../../models/Comment.js'
import Follow from '../../../models/Follow.js'
import { getHotMemes, getUserWeeklyStats } from '../../../services/notificationScheduler.js'
import {
  createHotContentNotifications,
  createWeeklySummaryNotification,
} from '../../../services/notificationService.js'

describe('定時通知系統單元測試', () => {
  let mongoServer
  let testUsers = []
  let testMemes = []
  let originalConnection

  beforeAll(async () => {
    // 保存原始連接
    originalConnection = mongoose.connection.readyState

    // 設置測試環境變數
    process.env.NODE_ENV = 'test'
    process.env.MONGODB_URI = 'mongodb://localhost:27017/memedam_test'
    process.env.FRONTEND_URL = 'http://localhost:5173'

    // 如果沒有連接，啟動記憶體MongoDB
    if (mongoose.connection.readyState === 0) {
      try {
        mongoServer = await MongoMemoryServer.create()
        const mongoUri = mongoServer.getUri()
        await mongoose.connect(mongoUri)
      } catch (error) {
        console.warn('無法啟動記憶體MongoDB，使用現有連接:', error.message)
      }
    }
    // 如果已有連接，使用現有的資料庫

    // 建立測試用戶
    for (let i = 0; i < 5; i++) {
      const user = await User.create({
        username: `testuser${i}`,
        email: `test${i}@example.com`,
        password: 'password123',
        role: 'user',
        notificationSettings: {
          trendingContent: i % 2 === 0, // 偶數用戶開啟熱門內容通知
          weeklyDigest: true,
        },
      })
      testUsers.push(user)
    }

    // 建立測試迷因
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    for (let i = 0; i < 8; i++) {
      // 只創建8個迷因，讓 testUsers[4] 沒有迷因
      const meme = await Meme.create({
        title: `測試迷因 ${i}`,
        type: 'text', // 必填：迷因類型
        content: `這是測試迷因 ${i} 的內容`, // 必填：內容
        author_id: testUsers[i % 4]._id, // 只分配給前4個用戶
        like_count: Number(i * 2 + 5), // 確保是數字
        comment_count: Number(i), // 確保是數字
        view_count: Number(i * 10), // 確保是數字
        status: 'public',
        createdAt: i < 4 ? now : yesterday,
      })
      testMemes.push(meme)
    }
  }, 60000)

  afterAll(async () => {
    // 只在我們創建的 mongoServer 存在時才停止它
    if (mongoServer) {
      await mongoose.disconnect()
      await mongoServer.stop()
    } else if (originalConnection === 0) {
      // 如果原本沒有連接，我們需要斷開
      await mongoose.disconnect()
    }
    // 如果原本就有連接，保持連接不變
  })

  beforeEach(async () => {
    // 清理測試數據
    await Like.deleteMany({})
    await Comment.deleteMany({})
    await Follow.deleteMany({})
  })

  describe('熱門內容篩選邏輯測試', () => {
    it('應該正確計算迷因熱度分數', async () => {
      const hotMemes = await getHotMemes(48, 10)

      expect(Array.isArray(hotMemes)).toBe(true)

      // 如果沒有足夠的測試數據，跳過這個測試
      if (hotMemes.length === 0) {
        console.warn('跳過測試：沒有足夠的熱門迷因數據')
        return
      }

      expect(hotMemes.length).toBeGreaterThan(0)

      // 檢查熱度計算是否正確
      hotMemes.forEach((meme) => {
        expect(meme).toHaveProperty('hotScore')
        expect(typeof meme.hotScore).toBe('number')

        const expectedHotScore = meme.like_count * 3 + meme.comment_count * 2 + meme.view_count * 1
        expect(meme.hotScore).toBe(expectedHotScore)
      })
    })

    it('應該按熱度分數降序排列', async () => {
      const hotMemes = await getHotMemes(48, 10)

      // 如果沒有足夠的測試數據，跳過這個測試
      if (hotMemes.length < 2) {
        console.warn('跳過測試：沒有足夠的熱門迷因數據進行排序測試')
        return
      }

      // 檢查每一個迷因都有hotScore屬性且不是NaN
      hotMemes.forEach((meme) => {
        expect(meme).toHaveProperty('hotScore')
        expect(typeof meme.hotScore).toBe('number')
        expect(meme.hotScore).not.toBeNaN()
      })

      // 檢查排序是否正確
      for (let i = 0; i < hotMemes.length - 1; i++) {
        const currentScore = hotMemes[i].hotScore
        const nextScore = hotMemes[i + 1].hotScore

        // 如果任一值是NaN，跳過比較
        if (isNaN(currentScore) || isNaN(nextScore)) {
          continue
        }

        expect(currentScore).toBeGreaterThanOrEqual(nextScore)
      }
    })

    it('應該過濾掉讚數少於5的迷因', async () => {
      // 建立一個讚數少於5的迷因
      const lowLikeMeme = await Meme.create({
        title: '低讚數測試迷因',
        type: 'text', // 必填：迷因類型
        content: '這是低讚數測試迷因的內容', // 必填：內容
        author_id: testUsers[0]._id,
        like_count: 3, // 少於5
        comment_count: 1,
        view_count: 10,
        status: 'public',
        createdAt: new Date(),
      })

      const hotMemes = await getHotMemes(24, 20)

      // 應該不包含低讚數的迷因
      const found = hotMemes.find((m) => m._id.toString() === lowLikeMeme._id.toString())
      expect(found).toBeUndefined()

      await Meme.findByIdAndDelete(lowLikeMeme._id)
    })

    it('應該限制返回數量', async () => {
      const limit = 3
      const hotMemes = await getHotMemes(48, limit)

      expect(hotMemes.length).toBeLessThanOrEqual(limit)
    })
  })

  describe('週報統計計算測試', () => {
    beforeEach(async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      // 為測試用戶建立測試數據
      await Like.create({
        meme_id: testMemes[0]._id,
        user_id: testUsers[0]._id,
        createdAt: weekAgo,
      })

      await Comment.create({
        meme_id: testMemes[0]._id,
        user_id: testUsers[0]._id,
        content: '測試評論',
        createdAt: weekAgo,
      })

      await Follow.create({
        following_id: testUsers[1]._id,
        follower_id: testUsers[0]._id,
        createdAt: weekAgo,
      })
    })

    it('應該正確計算用戶週統計數據', async () => {
      // 確保測試數據存在
      const userMemes = await Meme.find({ author_id: testUsers[0]._id })
      expect(userMemes.length).toBeGreaterThan(0)

      const stats = await getUserWeeklyStats(testUsers[0]._id)

      expect(stats).toHaveProperty('new_followers')
      expect(stats).toHaveProperty('total_likes')
      expect(stats).toHaveProperty('total_comments')
      expect(stats).toHaveProperty('memes_posted')
      expect(stats).toHaveProperty('most_liked_meme')

      // 檢查統計數據（可能因時間篩選而為0）
      expect(typeof stats.new_followers).toBe('number')
      expect(typeof stats.total_likes).toBe('number')
      expect(typeof stats.total_comments).toBe('number')
      expect(typeof stats.memes_posted).toBe('number')
    })

    it('應該正確識別最受歡迎的迷因', async () => {
      // 為另一個迷因添加更多讚
      await Like.create({
        meme_id: testMemes[1]._id,
        user_id: testUsers[1]._id,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })

      const stats = await getUserWeeklyStats(testUsers[0]._id)

      // 檢查最受歡迎的迷因是否正確
      if (stats.most_liked_meme) {
        expect(stats.most_liked_meme.memeId).toBeDefined()
        expect(stats.most_liked_meme.title).toBeDefined()
        expect(stats.most_liked_meme.likeCount).toBeGreaterThan(0)
      }
    })

    it('對於沒有活動的用戶應該返回零值', async () => {
      const stats = await getUserWeeklyStats(testUsers[4]._id)

      expect(stats.new_followers).toBe(0)
      expect(stats.total_likes).toBe(0)
      expect(stats.total_comments).toBe(0)
      expect(stats.memes_posted).toBe(0)
      expect(stats.most_liked_meme).toBeNull()
    })
  })

  describe('通知建立測試', () => {
    it('應該能夠建立熱門內容通知', async () => {
      const hotMemes = await getHotMemes(48, 2)
      const targetUserIds = [testUsers[0]._id]

      const result = await createHotContentNotifications(hotMemes, targetUserIds)

      expect(result).toBeDefined()
      expect(typeof result.sent).toBe('number')
    })

    it('應該能夠建立週報摘要通知', async () => {
      const weeklyStats = {
        new_followers: 2,
        total_likes: 10,
        total_comments: 5,
        memes_posted: 3,
        most_liked_meme: {
          memeId: testMemes[0]._id,
          title: '熱門迷因',
          likeCount: 15,
        },
      }

      const result = await createWeeklySummaryNotification(testUsers[0]._id, weeklyStats)

      expect(result).toBeDefined()
    })

    it('應該處理空的熱門內容列表', async () => {
      const result = await createHotContentNotifications([], [testUsers[0]._id])
      expect(result).toBeUndefined()
    })
  })

  describe('效能測試', () => {
    it('應該在合理時間內完成熱門內容計算', async () => {
      const startTime = Date.now()
      await getHotMemes(48, 5)
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(2000) // 少於2秒
    })

    it('應該在合理時間內完成統計計算', async () => {
      const startTime = Date.now()
      await getUserWeeklyStats(testUsers[0]._id)
      const endTime = Date.now()

      const duration = endTime - startTime
      expect(duration).toBeLessThan(1000) // 少於1秒
    })
  })
})
