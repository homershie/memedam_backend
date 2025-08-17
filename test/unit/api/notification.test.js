import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Notification from '../../../models/Notification.js'
import Meme from '../../../models/Meme.js'
import Comment from '../../../models/Comment.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'
import { notificationService } from '../../../utils/notificationService.js'

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
      notification_settings: {
        email: true,
        push: true,
        in_app: true,
        mention: true,
        follow: true,
        like: true,
        comment: true,
      },
    })

    testUser2 = await createTestUser(User, {
      username: `notify_user2_${Date.now()}`,
      email: `notify2_${Date.now()}@example.com`,
      notification_settings: {
        email: false,
        push: true,
        in_app: true,
        mention: true,
        follow: true,
        like: false,
        comment: true,
      },
    })

    // 創建測試迷因
    testMeme = await createTestMeme(Meme, {
      title: `test_meme_${Date.now()}`,
      author_id: testUser1._id,
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
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupTestData({ User, Notification, Meme, Comment })
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

        await notificationService.createMentionNotification({
          mentionedUser: testUser2,
          mentioner: testUser1,
          context: 'comment',
          contextId: comment._id,
          content: comment.content,
        })

        const notification = await Notification.findOne({
          recipient_id: testUser2._id,
          type: 'mention',
        })

        expect(notification).toBeDefined()
        expect(notification.sender_id.toString()).toBe(testUser1._id.toString())
        expect(notification.metadata.context).toBe('comment')
      })

      it('應該在被關注時創建通知', async () => {
        await notificationService.createFollowNotification({
          follower: testUser1,
          followed: testUser2,
        })

        const notification = await Notification.findOne({
          recipient_id: testUser2._id,
          type: 'follow',
        })

        expect(notification).toBeDefined()
        expect(notification.sender_id.toString()).toBe(testUser1._id.toString())
      })

      it('應該在收到讚時創建通知', async () => {
        await notificationService.createLikeNotification({
          liker: testUser2,
          contentOwner: testUser1,
          contentType: 'meme',
          contentId: testMeme._id,
        })

        const notification = await Notification.findOne({
          recipient_id: testUser1._id,
          type: 'like',
        })

        expect(notification).toBeDefined()
        expect(notification.sender_id.toString()).toBe(testUser2._id.toString())
        expect(notification.metadata.content_type).toBe('meme')
      })

      it('應該在收到留言時創建通知', async () => {
        const comment = {
          _id: 'comment456',
          content: 'Great meme!',
          author_id: testUser2._id,
          meme_id: testMeme._id,
        }

        await notificationService.createCommentNotification({
          commenter: testUser2,
          contentOwner: testUser1,
          comment,
          meme: testMeme,
        })

        const notification = await Notification.findOne({
          recipient_id: testUser1._id,
          type: 'comment',
        })

        expect(notification).toBeDefined()
        expect(notification.sender_id.toString()).toBe(testUser2._id.toString())
        expect(notification.metadata.comment_id).toBe(comment._id)
      })
    })

    describe('通知去重', () => {
      it('應該防止重複的通知', async () => {
        // 創建第一個通知
        await notificationService.createFollowNotification({
          follower: testUser1,
          followed: testUser2,
        })

        // 嘗試創建相同的通知
        await notificationService.createFollowNotification({
          follower: testUser1,
          followed: testUser2,
        })

        // 應該只有一個通知
        const notifications = await Notification.find({
          recipient_id: testUser2._id,
          sender_id: testUser1._id,
          type: 'follow',
        })

        expect(notifications.length).toBe(1)
      })

      it('應該合併相似的通知', async () => {
        // 創建多個讚的通知
        for (let i = 0; i < 5; i++) {
          await notificationService.createLikeNotification({
            liker: testUser2,
            contentOwner: testUser1,
            contentType: 'meme',
            contentId: testMeme._id,
          })
        }

        // 應該合併為一個通知
        const notifications = await Notification.find({
          recipient_id: testUser1._id,
          type: 'like',
          'metadata.content_id': testMeme._id,
        })

        expect(notifications.length).toBe(1)
        expect(notifications[0].count).toBe(5)
      })
    })

    describe('通知設定過濾', () => {
      it('應該根據用戶設定過濾通知類型', async () => {
        // testUser2 關閉了 like 通知
        await notificationService.createLikeNotification({
          liker: testUser1,
          contentOwner: testUser2,
          contentType: 'meme',
          contentId: 'meme123',
        })

        const notification = await Notification.findOne({
          recipient_id: testUser2._id,
          type: 'like',
        })

        // 不應該創建通知
        expect(notification).toBeNull()
      })

      it('應該根據用戶設定選擇通知渠道', async () => {
        const sendGridMock = vi.spyOn(require('@sendgrid/mail').default, 'send')
        
        // testUser1 開啟了 email 通知
        await notificationService.createFollowNotification({
          follower: testUser2,
          followed: testUser1,
        })

        // 應該發送 email
        expect(sendGridMock).toHaveBeenCalled()

        // testUser2 關閉了 email 通知
        await notificationService.createFollowNotification({
          follower: testUser1,
          followed: testUser2,
        })

        // 不應該發送額外的 email
        expect(sendGridMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('通知 API 整合測試', () => {
    describe('獲取通知列表', () => {
      beforeEach(async () => {
        // 創建測試通知
        await Notification.create([
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'follow',
            message: 'User2 關注了你',
            is_read: false,
          },
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'like',
            message: 'User2 喜歡了你的迷因',
            is_read: true,
          },
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'comment',
            message: 'User2 評論了你的迷因',
            is_read: false,
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
        expect(response.body.data[0]).toHaveProperty('type')
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
        expect(response.body.data.every(n => !n.is_read)).toBe(true)
      })

      it('應該按類型過濾通知', async () => {
        const response = await request(app)
          .get('/api/notifications?type=follow')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(1)
        expect(response.body.data[0].type).toBe('follow')
      })
    })

    describe('標記通知已讀', () => {
      let notificationId

      beforeEach(async () => {
        const notification = await Notification.create({
          recipient_id: testUser1._id,
          sender_id: testUser2._id,
          type: 'follow',
          message: 'Test notification',
          is_read: false,
        })
        notificationId = notification._id
      })

      it('應該標記單個通知為已讀', async () => {
        const response = await request(app)
          .patch(`/api/notifications/${notificationId}/read`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const updatedNotification = await Notification.findById(notificationId)
        expect(updatedNotification.is_read).toBe(true)
      })

      it('應該標記所有通知為已讀', async () => {
        // 創建多個未讀通知
        await Notification.create([
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'like',
            is_read: false,
          },
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'comment',
            is_read: false,
          },
        ])

        const response = await request(app)
          .patch('/api/notifications/read-all')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const unreadCount = await Notification.countDocuments({
          recipient_id: testUser1._id,
          is_read: false,
        })
        expect(unreadCount).toBe(0)
      })

      it('應該防止標記其他用戶的通知', async () => {
        const response = await request(app)
          .patch(`/api/notifications/${notificationId}/read`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(403)
        expect(response.body.success).toBe(false)
      })
    })

    describe('刪除通知', () => {
      let notificationId

      beforeEach(async () => {
        const notification = await Notification.create({
          recipient_id: testUser1._id,
          sender_id: testUser2._id,
          type: 'follow',
          message: 'Test notification',
        })
        notificationId = notification._id
      })

      it('應該刪除單個通知', async () => {
        const response = await request(app)
          .delete(`/api/notifications/${notificationId}`)
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const deletedNotification = await Notification.findById(notificationId)
        expect(deletedNotification).toBeNull()
      })

      it('應該防止刪除其他用戶的通知', async () => {
        const response = await request(app)
          .delete(`/api/notifications/${notificationId}`)
          .set('Authorization', `Bearer ${authToken2}`)

        expect(response.status).toBe(403)
        expect(response.body.success).toBe(false)
      })

      it('應該清空所有通知', async () => {
        // 創建多個通知
        await Notification.create([
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'like',
          },
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'comment',
          },
        ])

        const response = await request(app)
          .delete('/api/notifications/clear')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const remainingCount = await Notification.countDocuments({
          recipient_id: testUser1._id,
        })
        expect(remainingCount).toBe(0)
      })
    })

    describe('通知統計', () => {
      beforeEach(async () => {
        await Notification.create([
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'follow',
            is_read: false,
          },
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'like',
            is_read: false,
          },
          {
            recipient_id: testUser1._id,
            sender_id: testUser2._id,
            type: 'comment',
            is_read: true,
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
          email: false,
          push: true,
          in_app: true,
          mention: false,
          follow: true,
          like: false,
          comment: true,
        }

        const response = await request(app)
          .patch('/api/users/notification-settings')
          .set('Authorization', `Bearer ${authToken1}`)
          .send(newSettings)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)

        const updatedUser = await User.findById(testUser1._id)
        expect(updatedUser.notification_settings.email).toBe(false)
        expect(updatedUser.notification_settings.mention).toBe(false)
      })

      it('應該獲取當前通知設定', async () => {
        const response = await request(app)
          .get('/api/users/notification-settings')
          .set('Authorization', `Bearer ${authToken1}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('email')
        expect(response.body.data).toHaveProperty('push')
        expect(response.body.data).toHaveProperty('in_app')
      })
    })
  })

  describe('批量通知處理', () => {
    it('應該批量創建通知', async () => {
      const recipients = [testUser1._id, testUser2._id]
      
      await notificationService.createBulkNotification({
        recipients,
        type: 'announcement',
        message: '系統維護通知',
        metadata: {
          announcement_id: 'ann123',
        },
      })

      const notifications = await Notification.find({
        type: 'announcement',
      })

      expect(notifications).toHaveLength(2)
      expect(notifications.every(n => n.message === '系統維護通知')).toBe(true)
    })

    it('應該處理大量通知的效能', async () => {
      const startTime = Date.now()
      const notifications = []

      // 創建 100 個通知
      for (let i = 0; i < 100; i++) {
        notifications.push({
          recipient_id: testUser1._id,
          sender_id: testUser2._id,
          type: 'like',
          message: `Notification ${i}`,
        })
      }

      await Notification.insertMany(notifications)
      const endTime = Date.now()

      // 應該在合理時間內完成（例如 1 秒）
      expect(endTime - startTime).toBeLessThan(1000)

      const count = await Notification.countDocuments({
        recipient_id: testUser1._id,
      })
      expect(count).toBe(100)
    })
  })
})