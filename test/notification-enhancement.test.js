import request from 'supertest'
import mongoose from 'mongoose'
import { app } from '../index.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'

describe('通知功能擴充測試', () => {
  let testUser
  let testSender
  let authToken

  beforeAll(async () => {
    // 創建測試用戶
    testUser = new User({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password123',
    })
    await testUser.save()

    testSender = new User({
      username: 'testsender',
      email: 'testsender@example.com',
      password: 'password123',
    })
    await testSender.save()

    // 獲取認證 token
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'testuser@example.com',
      password: 'password123',
    })

    authToken = loginResponse.body.token
  })

  afterAll(async () => {
    await User.deleteMany({})
    await Notification.deleteMany({})
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    await Notification.deleteMany({})
  })

  describe('Notification Model 擴充測試', () => {
    test('應該能創建包含新欄位的通知', async () => {
      const notificationData = {
        user_id: testUser._id,
        title: '測試通知標題',
        sender_id: testSender._id,
        type: 'like',
        content: '這是一個測試通知內容',
        action_text: '查看詳情',
        priority: 5,
        url: 'https://example.com',
      }

      const notification = new Notification(notificationData)
      await notification.save()

      expect(notification.title).toBe('測試通知標題')
      expect(notification.sender_id.toString()).toBe(testSender._id.toString())
      expect(notification.action_text).toBe('查看詳情')
      expect(notification.priority).toBe(5)
      expect(notification.url).toBe('https://example.com')
    })

    test('應該驗證必填欄位', async () => {
      const notificationData = {
        user_id: testUser._id,
        // 缺少 title
        type: 'like',
        content: '測試內容',
      }

      const notification = new Notification(notificationData)
      await expect(notification.save()).rejects.toThrow()
    })
  })

  describe('未讀計數功能測試', () => {
    test('應該能取得未讀通知數量', async () => {
      // 創建一些測試通知
      await Notification.create([
        {
          user_id: testUser._id,
          title: '未讀通知1',
          type: 'like',
          content: '內容1',
          is_read: false,
        },
        {
          user_id: testUser._id,
          title: '已讀通知1',
          type: 'comment',
          content: '內容2',
          is_read: true,
        },
        {
          user_id: testUser._id,
          title: '未讀通知2',
          type: 'follow',
          content: '內容3',
          is_read: false,
        },
      ])

      const response = await request(app)
        .get('/api/notifications/unread/count')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.count).toBe(2)
    })

    test('取得通知列表時應包含未讀計數', async () => {
      // 創建測試通知
      await Notification.create([
        {
          user_id: testUser._id,
          title: '未讀通知1',
          type: 'like',
          content: '內容1',
          is_read: false,
        },
        {
          user_id: testUser._id,
          title: '已讀通知1',
          type: 'comment',
          content: '內容2',
          is_read: true,
        },
      ])

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.unreadCount).toBe(1)
      expect(response.body.data).toHaveLength(2)
    })
  })

  describe('API 路由測試', () => {
    test('應該能創建包含新欄位的通知', async () => {
      const notificationData = {
        user_id: testUser._id.toString(),
        title: 'API 測試通知',
        sender_id: testSender._id.toString(),
        type: 'mention',
        content: '這是一個通過 API 創建的通知',
        action_text: '回覆',
        priority: 8,
        url: 'https://example.com/mention',
      }

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData)

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('API 測試通知')
      expect(response.body.data.action_text).toBe('回覆')
      expect(response.body.data.priority).toBe(8)
    })

    test('應該能更新通知的已讀狀態', async () => {
      const notification = await Notification.create({
        user_id: testUser._id,
        title: '測試通知',
        type: 'like',
        content: '測試內容',
        is_read: false,
      })

      const response = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.is_read).toBe(true)
    })

    test('應該能批次標記所有通知為已讀', async () => {
      // 創建多個未讀通知
      await Notification.create([
        {
          user_id: testUser._id,
          title: '未讀通知1',
          type: 'like',
          content: '內容1',
          is_read: false,
        },
        {
          user_id: testUser._id,
          title: '未讀通知2',
          type: 'comment',
          content: '內容2',
          is_read: false,
        },
      ])

      const response = await request(app)
        .patch('/api/notifications/read/all')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.modifiedCount).toBe(2)

      // 驗證所有通知都已標記為已讀
      const unreadCount = await Notification.countDocuments({
        user_id: testUser._id,
        is_read: false,
      })
      expect(unreadCount).toBe(0)
    })
  })
})
