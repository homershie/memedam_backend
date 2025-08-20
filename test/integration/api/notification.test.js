import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Notification from '../../../models/Notification.js'
import NotificationReceipt from '../../../models/NotificationReceipt.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('通知 API 測試', () => {
  let testUser1, testUser2, testMeme, authToken1

  beforeAll(async () => {
    // 創建測試用戶
    testUser1 = await createTestUser(User, {
      username: `testuser1_${Date.now()}`,
      email: `test1_${Date.now()}@example.com`,
    })

    testUser2 = await createTestUser(User, {
      username: `testuser2_${Date.now()}`,
      email: `test2_${Date.now()}@example.com`,
    })

    // 創建測試迷因
    testMeme = await createTestMeme(Meme, testUser1._id, {
      title: `測試迷因 ${Date.now()}`,
    })

    // 登入取得 token
    const login1 = await request(app).post('/api/users/login').send({
      login: testUser1.email,
      password: 'testpassword123',
    })
    authToken1 = login1.body.token
  })

  beforeEach(async () => {
    // 清理通知
    await Notification.deleteMany({})
    await NotificationReceipt.deleteMany({})
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme, Notification, NotificationReceipt })
  })

  describe('獲取通知列表', () => {
    it('應該能夠獲取空的通知列表', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(0)
    })

    it('應該能夠獲取用戶的通知列表', async () => {
      // 創建通知
      const notification = await Notification.create({
        actor_id: testUser2._id,
        verb: 'like',
        object_type: 'meme',
        object_id: testMeme._id,
      })

      await NotificationReceipt.create({
        notification_id: notification._id,
        user_id: testUser1._id,
        read_at: null,
      })

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].notificationId).toBe(notification._id.toString())
    })
  })

  describe('獲取未讀通知數量', () => {
    it('應該能夠獲取未讀通知數量', async () => {
      const response = await request(app)
        .get('/api/notifications/unread/count')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.unreadCount).toBe(0)
    })

    it('應該能夠正確計算未讀通知數量', async () => {
      // 創建多個通知
      const notification1 = await Notification.create({
        actor_id: testUser2._id,
        verb: 'like',
        object_type: 'meme',
        object_id: testMeme._id,
      })

      const notification2 = await Notification.create({
        actor_id: testUser2._id,
        verb: 'comment',
        object_type: 'meme',
        object_id: testMeme._id,
      })

      await NotificationReceipt.create([
        {
          notification_id: notification1._id,
          user_id: testUser1._id,
          read_at: null,
        },
        {
          notification_id: notification2._id,
          user_id: testUser1._id,
          read_at: new Date(), // 已讀
        },
      ])

      const response = await request(app)
        .get('/api/notifications/unread/count')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.unreadCount).toBe(1)
    })
  })

  describe('標記通知為已讀', () => {
    it('應該能夠標記單個通知為已讀', async () => {
      const notification = await Notification.create({
        actor_id: testUser2._id,
        verb: 'like',
        object_type: 'meme',
        object_id: testMeme._id,
      })

      const receipt = await NotificationReceipt.create({
        notification_id: notification._id,
        user_id: testUser1._id,
        read_at: null,
      })

      const response = await request(app)
        .patch(`/api/notifications/${receipt._id}/read`)
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 驗證通知已被標記為已讀
      const updatedReceipt = await NotificationReceipt.findById(receipt._id)
      expect(updatedReceipt.read_at).not.toBeNull()
    })
  })

  describe('標記所有通知為已讀', () => {
    it('應該標記所有通知為已讀', async () => {
      // 創建多個未讀通知收據
      const notification2 = await Notification.create({
        actor_id: testUser2._id,
        verb: 'like',
        object_type: 'meme',
        object_id: testMeme._id,
      })

      await NotificationReceipt.create([
        {
          notification_id: notification2._id,
          user_id: testUser1._id,
          read_at: null,
        },
      ])

      const response = await request(app)
        .patch('/api/notifications/read/all')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      const unreadCount = await NotificationReceipt.countDocuments({
        user_id: testUser1._id,
        read_at: null,
      })
      expect(unreadCount).toBe(0)
    })
  })

  describe('通知設定', () => {
    it('應該能夠獲取通知設定', async () => {
      const response = await request(app)
        .get('/api/users/notification-settings')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      // 通知設定直接包含在 data 中
      expect(response.body.data).toHaveProperty('newFollower')
      expect(response.body.data).toHaveProperty('newComment')
      expect(response.body.data).toHaveProperty('newLike')
    })

    it('應該能夠更新通知設定', async () => {
      const newSettings = {
        newFollower: false,
        newComment: true,
        newLike: false,
        newMention: true,
        trendingContent: true,
        weeklyDigest: false,
        browser: true,
      }

      const response = await request(app)
        .patch('/api/users/notification-settings')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(newSettings)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 驗證設定已更新 - 重新查詢用戶以確保數據是最新的
      const updatedUser = await User.findById(testUser1._id)
      expect(updatedUser.notificationSettings).toMatchObject(newSettings)
    })
  })

  describe('錯誤處理', () => {
    it('未授權用戶應該無法訪問通知', async () => {
      const response = await request(app).get('/api/notifications')

      expect(response.status).toBe(401)
    })

    it('無效的通知 ID 應該返回錯誤', async () => {
      const response = await request(app)
        .patch('/api/notifications/invalid-id/read')
        .set('Authorization', `Bearer ${authToken1}`)

      // 無效的 ID 可能返回 400 或 404，兩者都是合理的錯誤回應
      expect([400, 404]).toContain(response.status)
    })
  })
})
