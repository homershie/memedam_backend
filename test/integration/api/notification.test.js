import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Notification from '../../../models/Notification.js'
import NotificationReceipt from '../../../models/NotificationReceipt.js'
import Meme from '../../../models/Meme.js'
import Comment from '../../../models/Comment.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'
import {
  createNewFollowerNotification,
  createNewCommentNotification,
  createNewLikeNotification,
  createMentionNotifications,
  createBulkNotification,
} from '../../../services/notificationService.js'
import mongoose from 'mongoose'

// Mock 推播和郵件服務
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
  },
}))

describe('通知系統測試', () => {
  let testUser1, testUser2, testMeme, authToken1, authToken2

  beforeAll(async () => {
    // 創建測試用戶
    testUser1 = await createTestUser(User, {
      username: `notify_user1_${Date.now()}`,
      email: `notify1_${Date.now()}@example.com`,
      notificationSettings: {
        newFollower: true,
        newComment: true,
        newLike: true,
        newMention: true,
        trendingContent: true,
        weeklyDigest: true,
      },
    })

    testUser2 = await createTestUser(User, {
      username: `notify_user2_${Date.now()}`,
      email: `notify2_${Date.now()}@example.com`,
      notificationSettings: {
        newFollower: true,
        newComment: true,
        newLike: false, // 關閉讚通知
        newMention: true,
        trendingContent: false,
        weeklyDigest: true,
      },
    })

    // 創建測試迷因
    testMeme = await createTestMeme(Meme, testUser1._id, {
      title: `test_meme_${Date.now()}`,
    })

    // 登入取得 tokens
    const [login1, login2] = await Promise.all([
      request(app).post('/api/users/login').send({
        email: testUser1.email,
        password: 'testpassword123',
      }),
      request(app).post('/api/users/login').send({
        email: testUser2.email,
        password: 'testpassword123',
      }),
    ])

    authToken1 = login1.body.token
    authToken2 = login2.body.token
  })

  beforeEach(async () => {
    // 清理通知
    await Notification.deleteMany({})
    await NotificationReceipt.deleteMany({})
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupTestData({ User, Notification, NotificationReceipt, Meme, Comment })
  })

  describe('通知服務單元測試', () => {
    describe('事件觸發通知', () => {
      it('應該在被提及時創建通知', async () => {
        const comment = {
          _id: 'comment123',
          content: `Hey @${testUser2.username}, check this out!`,
          author_id: testUser1._id,
          meme_id: testMeme._id,
        }

        await createMentionNotifications(comment.content, testUser1._id, testMeme._id, 'comment')

        const notification = await Notification.findOne({
          verb: 'mention',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        expect(notification).toBeDefined()
        expect(notification.actor_id.toString()).toBe(testUser1._id.toString())
        expect(notification.payload.context_type).toBe('comment')
      })

      it('應該在被關注時創建通知', async () => {
        await createNewFollowerNotification(testUser2._id, testUser1._id)

        const notification = await Notification.findOne({
          verb: 'follow',
          object_type: 'user',
          object_id: testUser2._id,
        })

        expect(notification).toBeDefined()
        expect(notification.actor_id.toString()).toBe(testUser1._id.toString())
      })

      it('應該在收到讚時創建通知', async () => {
        await createNewLikeNotification(testMeme._id, testUser2._id)

        const notification = await Notification.findOne({
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        expect(notification).toBeDefined()
        expect(notification.actor_id.toString()).toBe(testUser2._id.toString())
        expect(notification.object_type).toBe('meme')
      })

      it('應該在收到留言時創建通知', async () => {
        const comment = {
          _id: 'comment456',
          content: 'Great meme!',
          author_id: testUser2._id,
          meme_id: testMeme._id,
        }

        await createNewCommentNotification(testMeme._id, testUser2._id, comment.content)

        const notification = await Notification.findOne({
          verb: 'comment',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        expect(notification).toBeDefined()
        expect(notification.actor_id.toString()).toBe(testUser2._id.toString())
        expect(notification.payload.comment_content).toBe(comment.content)
      })
    })

    describe('通知去重', () => {
      it('應該防止重複的通知', async () => {
        // 創建第一個通知
        await createNewFollowerNotification(testUser2._id, testUser1._id)

        // 嘗試創建相同的通知
        await createNewFollowerNotification(testUser2._id, testUser1._id)

        // 應該只有一個通知
        const notifications = await Notification.find({
          verb: 'follow',
          object_type: 'user',
          object_id: testUser2._id,
          actor_id: testUser1._id,
        })

        expect(notifications.length).toBe(1)
      })

      it('應該合併相似的通知', async () => {
        // 創建多個讚的通知
        for (let i = 0; i < 5; i++) {
          await createNewLikeNotification(testMeme._id, testUser2._id)
        }

        // 應該合併為一個通知
        const notifications = await Notification.find({
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
          actor_id: testUser2._id,
        })

        expect(notifications.length).toBe(1)
      })
    })

    describe('通知設定過濾', () => {
      it('應該根據用戶設定過濾通知類型', async () => {
        // testUser2 關閉了 like 通知
        await createNewLikeNotification(testMeme._id, testUser1._id)

        const notification = await Notification.findOne({
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        // 不應該創建通知，因為 testUser2 關閉了 like 通知
        expect(notification).toBeNull()
      })
    })
  })

  describe('通知 API 整合測試', () => {
    describe('獲取通知列表', () => {
      beforeEach(async () => {
        // 創建測試通知
        const notification1 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'follow',
          object_type: 'user',
          object_id: testUser1._id,
          title: '新追蹤者',
          content: 'User2 開始追蹤您',
        })

        const notification2 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
          title: '新讚',
          content: 'User2 喜歡了您的迷因',
        })

        const notification3 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'comment',
          object_type: 'meme',
          object_id: testMeme._id,
          title: '新評論',
          content: 'User2 評論了您的迷因',
        })

        // 創建通知收據
        await NotificationReceipt.create([
          {
            notification_id: notification1._id,
            user_id: testUser1._id,
            read_at: null, // 未讀
          },
          {
            notification_id: notification2._id,
            user_id: testUser1._id,
            read_at: new Date(), // 已讀
          },
          {
            notification_id: notification3._id,
            user_id: testUser1._id,
            read_at: null, // 未讀
          },
        ])
      })

      it('應該獲取用戶的通知列表', async () => {
        const response = await request(app)
          .get('/api/notifications')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveLength(3)
        expect(response.body.data[0]).toHaveProperty('verb')
        expect(response.body.data[0]).toHaveProperty('is_read')
      })

      it('應該支援分頁', async () => {
        const response = await request(app)
          .get('/api/notifications?page=1&limit=2')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(2)
        expect(response.body.pagination).toBeDefined()
        expect(response.body.pagination.total).toBe(3)
      })

      it('應該過濾未讀通知', async () => {
        const response = await request(app)
          .get('/api/notifications?unread=true')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(2)
        expect(response.body.data.every((n) => !n.is_read)).toBe(true)
      })

      it('應該按類型過濾通知', async () => {
        const response = await request(app)
          .get('/api/notifications?verb=follow')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].verb).toBe('follow')
      })
    })

    describe('標記通知已讀', () => {
      let notificationId, receiptId

      beforeEach(async () => {
        const notification = await Notification.create({
          actor_id: testUser2._id,
          verb: 'follow',
          object_type: 'user',
          object_id: testUser1._id,
          title: 'Test notification',
        })
        notificationId = notification._id

        const receipt = await NotificationReceipt.create({
          notification_id: notificationId,
          user_id: testUser1._id,
          read_at: null,
        })
        receiptId = receipt._id
      })

      it('應該標記單個通知為已讀', async () => {
        const response = await request(app)
          .patch(`/api/notifications/${receiptId}/read`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const updatedReceipt = await NotificationReceipt.findById(receiptId)
        expect(updatedReceipt.read_at).toBeDefined()
      })

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
          .patch('/api/notifications/read-all')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const unreadCount = await NotificationReceipt.countDocuments({
          user_id: testUser1._id,
          read_at: null,
          deleted_at: null,
        })
        expect(unreadCount).toBe(0)
      })

      it('應該防止標記其他用戶的通知', async () => {
        const response = await request(app)
          .patch(`/api/notifications/${receiptId}/read`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(403)
        expect(response.body.success).toBe(false)
      })
    })

    describe('刪除通知', () => {
      let notificationId, receiptId

      beforeEach(async () => {
        const notification = await Notification.create({
          actor_id: testUser2._id,
          verb: 'follow',
          object_type: 'user',
          object_id: testUser1._id,
          title: 'Test notification',
        })
        notificationId = notification._id

        const receipt = await NotificationReceipt.create({
          notification_id: notificationId,
          user_id: testUser1._id,
        })
        receiptId = receipt._id
      })

      it('應該刪除單個通知', async () => {
        const response = await request(app)
          .delete(`/api/notifications/${receiptId}`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const deletedReceipt = await NotificationReceipt.findById(receiptId)
        expect(deletedReceipt.deleted_at).toBeDefined()
      })

      it('應該防止刪除其他用戶的通知', async () => {
        const response = await request(app)
          .delete(`/api/notifications/${receiptId}`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(403)
        expect(response.body.success).toBe(false)
      })

      it('應該清空所有通知', async () => {
        // 創建多個通知收據
        const notification2 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        await NotificationReceipt.create({
          notification_id: notification2._id,
          user_id: testUser1._id,
        })

        const response = await request(app)
          .delete('/api/notifications/clear')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const remainingCount = await NotificationReceipt.countDocuments({
          user_id: testUser1._id,
          deleted_at: null,
        })
        expect(remainingCount).toBe(0)
      })
    })

    describe('通知統計', () => {
      beforeEach(async () => {
        const notification1 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'follow',
          object_type: 'user',
          object_id: testUser1._id,
        })

        const notification2 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        const notification3 = await Notification.create({
          actor_id: testUser2._id,
          verb: 'comment',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        await NotificationReceipt.create([
          {
            notification_id: notification1._id,
            user_id: testUser1._id,
            read_at: null, // 未讀
          },
          {
            notification_id: notification2._id,
            user_id: testUser1._id,
            read_at: null, // 未讀
          },
          {
            notification_id: notification3._id,
            user_id: testUser1._id,
            read_at: new Date(), // 已讀
          },
        ])
      })

      it('應該獲取未讀通知數量', async () => {
        const response = await request(app)
          .get('/api/notifications/unread-count')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data.unread_count).toBe(2)
      })

      it('應該獲取通知統計資訊', async () => {
        const response = await request(app)
          .get('/api/notifications/stats')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('total')
        expect(response.body.data).toHaveProperty('unread')
        expect(response.body.data).toHaveProperty('by_type')
        expect(response.body.data.by_type).toHaveProperty('follow')
        expect(response.body.data.by_type).toHaveProperty('like')
        expect(response.body.data.by_type).toHaveProperty('comment')
      })
    })

    describe('通知設定管理', () => {
      it('應該更新通知設定', async () => {
        const newSettings = {
          newFollower: false,
          newComment: true,
          newLike: false,
          newMention: true,
          trendingContent: false,
          weeklyDigest: true,
        }

        const response = await request(app)
          .patch('/api/users/notification-settings')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(newSettings)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const updatedUser = await User.findById(testUser1._id)
        expect(updatedUser.notificationSettings.newFollower).toBe(false)
        expect(updatedUser.notificationSettings.newLike).toBe(false)
      })

      it('應該獲取當前通知設定', async () => {
        const response = await request(app)
          .get('/api/users/notification-settings')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('newFollower')
        expect(response.body.data).toHaveProperty('newComment')
        expect(response.body.data).toHaveProperty('newLike')
      })
    })
  })

  describe('批量通知處理', () => {
    it('應該批量創建通知', async () => {
      const recipients = [testUser1._id, testUser2._id]

      await createBulkNotification(
        {
          actor_id: new mongoose.Types.ObjectId(),
          verb: 'announcement',
          object_type: 'user',
          object_id: new mongoose.Types.ObjectId(),
          title: '系統維護通知',
          content: '系統將進行維護',
        },
        { allUsers: false, userIds: recipients },
      )

      const notifications = await Notification.find({
        verb: 'announcement',
      })

      expect(notifications).toHaveLength(1)
      expect(notifications[0].title).toBe('系統維護通知')
    })

    it('應該處理大量通知的效能', async () => {
      const startTime = Date.now()
      const notifications = []

      // 創建 100 個通知
      for (let i = 0; i < 100; i++) {
        const notification = await Notification.create({
          actor_id: testUser2._id,
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
          title: `Notification ${i}`,
        })

        notifications.push({
          notification_id: notification._id,
          user_id: testUser1._id,
        })
      }

      await NotificationReceipt.insertMany(notifications)
      const endTime = Date.now()

      // 應該在合理時間內完成（例如 1 秒）
      expect(endTime - startTime).toBeLessThan(1000)

      const count = await NotificationReceipt.countDocuments({
        user_id: testUser1._id,
        deleted_at: null,
      })
      expect(count).toBe(100)
    })
  })
})
