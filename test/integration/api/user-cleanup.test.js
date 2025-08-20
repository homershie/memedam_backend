import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Comment from '../../../models/Comment.js'
import Like from '../../../models/Like.js'
import Follow from '../../../models/Follow.js'
import Notification from '../../../models/Notification.js'
import VerificationToken from '../../../models/VerificationToken.js'
import { cleanupTestData } from '../../setup.js'
import { userCleanupScheduler } from '../../../services/userCleanupScheduler.js'

describe('用戶清理系統測試', () => {
  let verifiedUser, inactiveUser, activeUser
  let testMeme

  beforeAll(async () => {
    // 創建各種狀態的測試用戶
    const now = new Date()
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000)

    // 已驗證的活躍用戶
    verifiedUser = await User.create({
      username: `verified_active_${Date.now()}`,
      email: `verified_active_${Date.now()}@example.com`,
      password: 'password123',
      is_verified: true,
      last_login: now,
      created_at: thirtyDaysAgo,
    })

    // 非活躍用戶（超過一年未登入）
    inactiveUser = await User.create({
      username: `inactive_${Date.now()}`,
      email: `inactive_${Date.now()}@example.com`,
      password: 'password123',
      is_verified: true,
      last_login: yearAgo,
      created_at: yearAgo,
    })

    // 活躍用戶
    activeUser = await User.create({
      username: `active_${Date.now()}`,
      email: `active_${Date.now()}@example.com`,
      password: 'password123',
      is_verified: true,
      last_login: new Date(now - 7 * 24 * 60 * 60 * 1000),
      created_at: thirtyDaysAgo,
    })

    // 創建測試內容
    testMeme = await Meme.create({
      title: 'Test Meme',
      author_id: verifiedUser._id,
      image_url: 'https://example.com/meme.jpg',
    })

    await Comment.create({
      content: 'Test comment',
      author_id: verifiedUser._id,
      meme_id: testMeme._id,
    })
  })

  afterAll(async () => {
    await cleanupTestData({
      User,
      Meme,
      Comment,
      Like,
      Follow,
      Notification,
      VerificationToken,
    })
  })

  describe('未驗證用戶清理', () => {
    it('應該清理超過 7 天未驗證的用戶', async () => {
      const oldUnverifiedUser = await User.create({
        username: `old_unverified_${Date.now()}`,
        email: `old_unverified_${Date.now()}@example.com`,
        password: 'password123',
        is_verified: false,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      })

      const recentUnverifiedUser = await User.create({
        username: `recent_unverified_${Date.now()}`,
        email: `recent_unverified_${Date.now()}@example.com`,
        password: 'password123',
        is_verified: false,
        created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      })

      // 執行清理
      await userCleanupScheduler.cleanupUnverifiedUsers()

      // 檢查結果
      const oldUserExists = await User.findById(oldUnverifiedUser._id)
      const recentUserExists = await User.findById(recentUnverifiedUser._id)

      expect(oldUserExists).toBeNull()
      expect(recentUserExists).toBeDefined()
    })

    it('應該保留已驗證的用戶', async () => {
      // 執行清理
      await userCleanupScheduler.cleanupUnverifiedUsers()

      // 已驗證用戶應該被保留
      const userExists = await User.findById(verifiedUser._id)
      expect(userExists).toBeDefined()
    })

    it('應該清理相關的驗證 token', async () => {
      const userToDelete = await User.create({
        username: `delete_token_${Date.now()}`,
        email: `delete_token_${Date.now()}@example.com`,
        password: 'password123',
        is_verified: false,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      })

      // 創建驗證 token
      await VerificationToken.create({
        user_id: userToDelete._id,
        token: 'test_token_123',
        type: 'email_verification',
      })

      // 執行清理
      await userCleanupScheduler.cleanupUnverifiedUsers()

      // 檢查 token 是否被刪除
      const tokenExists = await VerificationToken.findOne({
        user_id: userToDelete._id,
      })
      expect(tokenExists).toBeNull()
    })
  })

  describe('非活躍用戶處理', () => {
    it('應該識別超過一年未登入的用戶', async () => {
      const inactiveUsers = await userCleanupScheduler.findInactiveUsers(365)

      const inactiveUserIds = inactiveUsers.map((u) => u._id.toString())
      expect(inactiveUserIds).toContain(inactiveUser._id.toString())
      expect(inactiveUserIds).not.toContain(activeUser._id.toString())
    })

    it('應該標記非活躍用戶', async () => {
      await userCleanupScheduler.markInactiveUsers()

      const markedUser = await User.findById(inactiveUser._id)
      expect(markedUser.is_inactive).toBe(true)
      expect(markedUser.inactive_since).toBeDefined()
    })

    it('應該發送重新激活通知', async () => {
      const sendEmailMock = vi.fn()
      vi.mock('../../../services/emailService.js', () => ({
        sendReactivationEmail: sendEmailMock,
      }))

      await userCleanupScheduler.sendReactivationNotices()

      // 應該發送郵件給非活躍用戶
      expect(sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: inactiveUser.email,
        }),
      )
    })

    it('應該在寬限期後刪除非活躍用戶', async () => {
      // 標記用戶為非活躍超過 30 天
      await User.findByIdAndUpdate(inactiveUser._id, {
        is_inactive: true,
        inactive_since: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      })

      await userCleanupScheduler.deleteInactiveUsers()

      const userExists = await User.findById(inactiveUser._id)
      expect(userExists).toBeNull()
    })
  })

  describe('級聯刪除', () => {
    let userToDelete, memeToDelete

    beforeEach(async () => {
      // 創建要刪除的用戶及其內容
      userToDelete = await User.create({
        username: `cascade_delete_${Date.now()}`,
        email: `cascade_${Date.now()}@example.com`,
        password: 'password123',
        is_verified: true,
      })

      memeToDelete = await Meme.create({
        title: 'Meme to delete',
        author_id: userToDelete._id,
        image_url: 'https://example.com/delete.jpg',
      })

      await Comment.create({
        content: 'Comment to delete',
        author_id: userToDelete._id,
        meme_id: memeToDelete._id,
      })

      // 創建相關資料
      await Like.create({
        user_id: userToDelete._id,
        target_id: memeToDelete._id,
        target_type: 'Meme',
      })

      await Follow.create({
        follower_id: verifiedUser._id,
        following_id: userToDelete._id,
      })

      await Notification.create({
        recipient_id: userToDelete._id,
        sender_id: verifiedUser._id,
        type: 'follow',
        message: 'Someone followed you',
      })
    })

    it('應該刪除用戶的所有迷因', async () => {
      await userCleanupScheduler.cascadeDeleteUser(userToDelete._id)

      const memesExist = await Meme.find({ author_id: userToDelete._id })
      expect(memesExist).toHaveLength(0)
    })

    it('應該刪除用戶的所有留言', async () => {
      await userCleanupScheduler.cascadeDeleteUser(userToDelete._id)

      const commentsExist = await Comment.find({ author_id: userToDelete._id })
      expect(commentsExist).toHaveLength(0)
    })

    it('應該刪除用戶的所有讚', async () => {
      await userCleanupScheduler.cascadeDeleteUser(userToDelete._id)

      const likesExist = await Like.find({ user_id: userToDelete._id })
      expect(likesExist).toHaveLength(0)
    })

    it('應該刪除用戶的關注關係', async () => {
      await userCleanupScheduler.cascadeDeleteUser(userToDelete._id)

      const followsExist = await Follow.find({
        $or: [{ follower_id: userToDelete._id }, { following_id: userToDelete._id }],
      })
      expect(followsExist).toHaveLength(0)
    })

    it('應該刪除用戶的通知', async () => {
      await userCleanupScheduler.cascadeDeleteUser(userToDelete._id)

      const notificationsExist = await Notification.find({
        $or: [{ recipient_id: userToDelete._id }, { sender_id: userToDelete._id }],
      })
      expect(notificationsExist).toHaveLength(0)
    })

    it('應該更新相關統計數據', async () => {
      // 添加一些統計數據
      await User.findByIdAndUpdate(verifiedUser._id, {
        $inc: { followers_count: 1 },
      })

      await userCleanupScheduler.cascadeDeleteUser(userToDelete._id)

      // 檢查統計數據是否更新
      const updatedUser = await User.findById(verifiedUser._id)
      expect(updatedUser.followers_count).toBe(0)
    })
  })

  describe('排程任務', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('應該每天執行一次清理任務', () => {
      const cleanupSpy = vi.spyOn(userCleanupScheduler, 'runDailyCleanup')

      // 啟動排程
      userCleanupScheduler.startScheduler()

      // 模擬經過 24 小時
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)

      expect(cleanupSpy).toHaveBeenCalledTimes(1)

      // 模擬再經過 24 小時
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)

      expect(cleanupSpy).toHaveBeenCalledTimes(2)
    })

    it('應該記錄清理統計', async () => {
      const stats = await userCleanupScheduler.runDailyCleanup()

      expect(stats).toHaveProperty('unverified_deleted')
      expect(stats).toHaveProperty('inactive_marked')
      expect(stats).toHaveProperty('inactive_deleted')
      expect(stats).toHaveProperty('tokens_cleaned')
      expect(stats).toHaveProperty('execution_time')
    })

    it('應該處理清理過程中的錯誤', async () => {
      // 模擬資料庫錯誤
      vi.spyOn(User, 'deleteMany').mockRejectedValueOnce(new Error('Database error'))

      const consoleSpy = vi.spyOn(console, 'error')

      await userCleanupScheduler.runDailyCleanup()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('清理失敗'),
        expect.any(Error),
      )
    })
  })

  describe('批量清理優化', () => {
    it('應該使用批次處理大量用戶', async () => {
      // 創建大量未驗證用戶
      const users = []
      for (let i = 0; i < 100; i++) {
        users.push({
          username: `batch_user_${i}`,
          email: `batch_${i}@example.com`,
          password: 'password123',
          is_verified: false,
          created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        })
      }
      await User.insertMany(users)

      const startTime = Date.now()
      await userCleanupScheduler.cleanupUnverifiedUsers({ batchSize: 10 })
      const endTime = Date.now()

      // 應該在合理時間內完成
      expect(endTime - startTime).toBeLessThan(5000)

      // 檢查用戶是否被刪除
      const remainingUsers = await User.find({
        username: { $regex: /^batch_user_/ },
      })
      expect(remainingUsers).toHaveLength(0)
    })

    it('應該使用事務確保資料一致性', async () => {
      const session = await User.startSession()

      let userToDelete
      beforeEach(async () => {
        userToDelete = await User.create({
          username: `cascade_test_${Date.now()}`,
          email: `cascade_test_${Date.now()}@example.com`,
          password: 'password123',
          is_verified: true,
        })
      })

      try {
        await session.withTransaction(async () => {
          await userCleanupScheduler.cascadeDeleteUser(userToDelete._id, { session })
        })

        // 檢查所有相關資料都被刪除
        const user = await User.findById(userToDelete._id)
        const memes = await Meme.find({ author_id: userToDelete._id })
        const comments = await Comment.find({ author_id: userToDelete._id })

        expect(user).toBeNull()
        expect(memes).toHaveLength(0)
        expect(comments).toHaveLength(0)
      } finally {
        await session.endSession()
      }
    })
  })

  describe('管理介面', () => {
    let adminToken

    beforeAll(async () => {
      // 創建管理員用戶
      const admin = await User.create({
        username: `admin_${Date.now()}`,
        email: `admin_${Date.now()}@example.com`,
        password: 'admin123',
        is_verified: true,
        role: 'admin',
      })

      const loginResponse = await request(app).post('/api/users/login').send({
        email: admin.email,
        password: 'admin123',
      })

      adminToken = loginResponse.body.token
    })

    it('應該允許管理員手動觸發清理', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'unverified_users',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('deleted_count')
    })

    it('應該提供清理統計報告', async () => {
      const response = await request(app)
        .get('/api/admin/cleanup/stats')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('last_run')
      expect(response.body.data).toHaveProperty('next_run')
      expect(response.body.data).toHaveProperty('total_cleaned')
    })

    it('應該允許配置清理參數', async () => {
      const response = await request(app)
        .patch('/api/admin/cleanup/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          unverified_days: 7,
          inactive_days: 365,
          grace_period_days: 30,
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })
})
