import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import mongoose from 'mongoose'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Like from '../../../models/Like.js'
import Comment from '../../../models/Comment.js'
import Follow from '../../../models/Follow.js'
import Notification from '../../../models/Notification.js'
import NotificationReceipt from '../../../models/NotificationReceipt.js'
import {
  getHotMemes,
  getUserWeeklyStats,
  sendHotContentNotifications,
  sendWeeklySummaryNotifications,
} from '../../../services/notificationScheduler.js'
import {
  createHotContentNotifications,
  createWeeklySummaryNotification,
} from '../../../services/notificationService.js'

describe('定時通知系統整合測試', () => {
  let testUsers = []
  let testMemes = []

  beforeAll(async () => {
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

    for (let i = 0; i < 10; i++) {
      const meme = await Meme.create({
        title: `測試迷因 ${i}`,
        author_id: testUsers[i % 5]._id,
        like_count: i * 2, // 不同的讚數
        comment_count: i,
        view_count: i * 10,
        status: 'public',
        createdAt: i < 5 ? now : yesterday, // 前5個今天建立，後5個昨天建立
      })
      testMemes.push(meme)
    }
  })

  afterEach(async () => {
    // 清理測試數據
    await NotificationReceipt.deleteMany({})
    await Notification.deleteMany({})
    await Like.deleteMany({})
    await Comment.deleteMany({})
    await Follow.deleteMany({})
  })

  afterAll(async () => {
    // 清理所有測試數據
    await Meme.deleteMany({ title: { $regex: /^測試迷因/ } })
    await User.deleteMany({ username: { $regex: /^testuser/ } })
  })

  describe('熱門內容篩選邏輯測試', () => {
    it('應該正確計算迷因熱度分數', async () => {
      const hotMemes = await getHotMemes(48, 10) // 48小時內，取前10個

      expect(Array.isArray(hotMemes)).toBe(true)
      expect(hotMemes.length).toBeGreaterThan(0)

      // 檢查熱度計算是否正確
      hotMemes.forEach((meme) => {
        const expectedHotScore = meme.like_count * 3 + meme.comment_count * 2 + meme.view_count * 1
        expect(meme.hotScore).toBe(expectedHotScore)
      })
    })

    it('應該按熱度分數降序排列', async () => {
      const hotMemes = await getHotMemes(48, 10)

      for (let i = 0; i < hotMemes.length - 1; i++) {
        expect(hotMemes[i].hotScore).toBeGreaterThanOrEqual(hotMemes[i + 1].hotScore)
      }
    })

    it('應該過濾掉讚數少於5的迷因', async () => {
      // 建立一個讚數少於5的迷因
      const lowLikeMeme = await Meme.create({
        title: '低讚數測試迷因',
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
      const stats = await getUserWeeklyStats(testUsers[0]._id)

      expect(stats).toHaveProperty('new_followers')
      expect(stats).toHaveProperty('total_likes')
      expect(stats).toHaveProperty('total_comments')
      expect(stats).toHaveProperty('memes_posted')
      expect(stats).toHaveProperty('most_liked_meme')

      expect(stats.new_followers).toBe(1)
      expect(stats.total_likes).toBe(1)
      expect(stats.total_comments).toBe(1)
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
      const stats = await getUserWeeklyStats(testUsers[4]._id) // 這個用戶沒有活動

      expect(stats.new_followers).toBe(0)
      expect(stats.total_likes).toBe(0)
      expect(stats.total_comments).toBe(0)
      expect(stats.memes_posted).toBe(0)
      expect(stats.most_liked_meme).toBeNull()
    })
  })

  describe('批量發送效能測試', () => {
    it('應該能夠批量建立熱門內容通知', async () => {
      const hotMemes = await getHotMemes(48, 3)
      const targetUserIds = testUsers.slice(0, 3).map((u) => u._id)

      const startTime = Date.now()
      const result = await createHotContentNotifications(hotMemes, targetUserIds)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(result.sent).toBeGreaterThan(0)

      // 檢查通知是否正確建立
      const notifications = await Notification.find({ verb: 'system' })
      expect(notifications.length).toBeGreaterThan(0)

      // 檢查處理時間是否合理（應該在幾秒鐘內完成）
      const processingTime = endTime - startTime
      expect(processingTime).toBeLessThan(5000) // 少於5秒
    })

    it('應該能夠處理大量用戶的週報通知', async () => {
      const startTime = Date.now()

      // 模擬批量處理
      const promises = testUsers.map((user) =>
        createWeeklySummaryNotification(user._id, {
          new_followers: 1,
          total_likes: 5,
          total_comments: 3,
          memes_posted: 2,
          most_liked_meme: null,
        }),
      )

      const results = await Promise.allSettled(promises)
      const endTime = Date.now()

      const successful = results.filter((r) => r.status === 'fulfilled').length
      expect(successful).toBeGreaterThan(0)

      // 檢查處理時間是否合理
      const processingTime = endTime - startTime
      expect(processingTime).toBeLessThan(10000) // 少於10秒
    })

    it('應該在批量處理中正確處理錯誤', async () => {
      const invalidUserId = new mongoose.Types.ObjectId()
      const hotMemes = await getHotMemes(48, 2)

      // 嘗試為無效用戶發送通知
      await expect(createHotContentNotifications(hotMemes, [invalidUserId])).rejects.toThrow()
    })
  })

  describe('定時任務執行測試', () => {
    it('應該能夠模擬熱門內容通知任務執行', async () => {
      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // 建立一些活躍用戶
      const activeUsers = testUsers.slice(0, 3)
      for (const user of activeUsers) {
        user.last_login_at = new Date()
        await user.save()
      }

      await sendHotContentNotifications()

      // 檢查日誌輸出
      expect(consoleSpy).toHaveBeenCalledWith('開始發送熱門內容通知...')

      consoleSpy.mockRestore()
    })

    it('應該能夠模擬週報摘要通知任務執行', async () => {
      // Mock console.log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // 建立活躍用戶
      const activeUsers = testUsers.slice(0, 2)
      for (const user of activeUsers) {
        user.last_login_at = new Date()
        await user.save()
      }

      await sendWeeklySummaryNotifications()

      // 檢查日誌輸出
      expect(consoleSpy).toHaveBeenCalledWith('開始發送週報摘要通知...')

      consoleSpy.mockRestore()
    })

    it('應該在沒有熱門內容時正確處理', async () => {
      // Mock getHotMemes to return empty array
      const originalGetHotMemes = await import('../../../services/notificationScheduler.js')
      const mockGetHotMemes = vi.fn().mockResolvedValue([])
      vi.doMock('../../../services/notificationScheduler.js', () => ({
        ...originalGetHotMemes,
        getHotMemes: mockGetHotMemes,
      }))

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // 重新導入模組以使用mock
      const { sendHotContentNotifications: mockedSendHotContent } = await import(
        '../../../services/notificationScheduler.js'
      )

      await mockedSendHotContent()

      expect(consoleSpy).toHaveBeenCalledWith('沒有找到熱門內容，跳過通知發送')

      consoleSpy.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('權限和設定測試', () => {
    it('應該只向開啟熱門內容通知的用戶發送', async () => {
      const hotMemes = await getHotMemes(48, 2)

      // 只選擇開啟熱門內容通知的用戶
      const enabledUsers = testUsers.filter((_, index) => index % 2 === 0)
      const targetUserIds = enabledUsers.map((u) => u._id)

      await createHotContentNotifications(hotMemes, targetUserIds)

      // 檢查通知是否只發送給開啟設定的用戶
      const receipts = await NotificationReceipt.find({})
      const receiptUserIds = receipts.map((r) => r.userId.toString())

      // 所有接收者都應該在目標用戶列表中
      receiptUserIds.forEach((userId) => {
        expect(targetUserIds.map((id) => id.toString())).toContain(userId)
      })
    })

    it('應該正確處理用戶通知設定', async () => {
      // 測試用戶設定檢查
      const userWithDisabledTrending = testUsers.find(
        (u) => !u.notificationSettings.trendingContent,
      )
      const userWithEnabledTrending = testUsers.find((u) => u.notificationSettings.trendingContent)

      expect(userWithDisabledTrending).toBeDefined()
      expect(userWithEnabledTrending).toBeDefined()
    })
  })

  describe('效能和負載測試', () => {
    it('應該在合理時間內處理大量通知', async () => {
      const hotMemes = await getHotMemes(48, 2)
      const largeUserSet = Array.from({ length: 100 }, () => testUsers[0]._id) // 模擬大量用戶

      const startTime = Date.now()
      const result = await createHotContentNotifications(hotMemes, largeUserSet)
      const endTime = Date.now()

      const processingTime = endTime - startTime

      // 即使處理大量用戶也應該在合理時間內完成
      expect(processingTime).toBeLessThan(30000) // 少於30秒
      expect(result.sent).toBeGreaterThan(0)
    })

    it('應該正確處理記憶體使用', async () => {
      // 這個測試確保函數不會造成記憶體洩漏
      const initialMemoryUsage = process.memoryUsage().heapUsed

      for (let i = 0; i < 10; i++) {
        const hotMemes = await getHotMemes(48, 2)
        await createHotContentNotifications(hotMemes, [testUsers[0]._id])
      }

      const finalMemoryUsage = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage

      // 記憶體增加應該在合理範圍內
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 少於50MB
    })
  })
})
