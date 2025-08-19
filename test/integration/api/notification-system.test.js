import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../../../../index.js'
import User from '../../../../models/User.js'
import Notification from '../../../../models/Notification.js'
import NotificationReceipt from '../../../../models/NotificationReceipt.js'
import { generateToken } from '../../../../utils/authUtils.js'

describe('通知系統 API', () => {
  let testUser, testUser2, userToken, adminToken
  let testNotification, testReceipt

  beforeAll(async () => {
    // 建立測試用戶
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'user',
    })

    testUser2 = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'password123',
      role: 'user',
    })

    // 建立管理員用戶
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    })

    userToken = generateToken(testUser)
    adminToken = generateToken(adminUser)
  })

  beforeEach(async () => {
    // 建立測試通知
    testNotification = await Notification.create({
      actor_id: testUser2._id,
      verb: 'like',
      object_type: 'meme',
      object_id: new mongoose.Types.ObjectId(),
      payload: { memeTitle: '測試迷因' },
      title: '有人按讚了您的迷因',
      content: 'testuser2 按讚了您的迷因',
    })

    // 建立測試收件項
    testReceipt = await NotificationReceipt.create({
      notification_id: testNotification._id,
      user_id: testUser._id,
    })
  })

  afterEach(async () => {
    // 清理測試資料
    await Notification.deleteMany({})
    await NotificationReceipt.deleteMany({})
    await User.deleteMany({})
  })

  describe('GET /api/notifications', () => {
    it('應該能取得使用者的通知列表', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBe(1)
      expect(response.body.data[0]).toMatchObject({
        _id: testReceipt._id.toString(),
        notification_id: testNotification._id.toString(),
        user_id: testUser._id.toString(),
        verb: 'like',
        object_type: 'meme',
        isRead: false,
        isDeleted: false,
        isArchived: false,
      })
      expect(response.body.unreadCount).toBe(1)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      })
    })

    it('應該不顯示已刪除的通知', async () => {
      // 軟刪除測試收件項
      await NotificationReceipt.findByIdAndUpdate(testReceipt._id, {
        deleted_at: new Date(),
      })

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.data.length).toBe(0)
      expect(response.body.unreadCount).toBe(0)
    })

    it('應該支援各種篩選', async () => {
      // 建立另一個測試通知
      const notification2 = await Notification.create({
        actor_id: testUser2._id,
        verb: 'comment',
        object_type: 'meme',
        object_id: new mongoose.Types.ObjectId(),
        payload: { memeTitle: '測試迷因2' },
        title: '有人評論了您的迷因',
        content: 'testuser2 評論了您的迷因',
      })

      await NotificationReceipt.create({
        notification_id: notification2._id,
        user_id: testUser._id,
      })

      const response = await request(app)
        .get('/api/notifications?page=1&limit=1&verb=like')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.data.length).toBe(1)
      expect(response.body.data[0].verb).toBe('like')
      expect(response.body.pagination.total).toBe(1)
    })
  })

  describe('GET /api/notifications/:id', () => {
    it('應該能取得特定通知', async () => {
      const response = await request(app)
        .get(`/api/notifications/${testReceipt._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data._id).toBe(testReceipt._id.toString())
      expect(response.body.data.notification_id).toBe(testNotification._id.toString())
    })

    it('應該傳回 404 當通知不存在', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .get(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)

      expect(response.body.error).toBe('找不到通知')
    })

    it('應該傳回 404 當嘗試存取他人的通知', async () => {
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
      })

      const otherToken = generateToken(otherUser)

      const response = await request(app)
        .get(`/api/notifications/${testReceipt._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404)

      expect(response.body.error).toBe('找不到通知')
    })
  })

  describe('PATCH /api/notifications/:id', () => {
    it('應該能更新通知收件項', async () => {
      const response = await request(app)
        .patch(`/api/notifications/${testReceipt._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ read: true, archived: false })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.isRead).toBe(true)
      expect(response.body.data.isArchived).toBe(false)
    })

    it('應該傳回 404 當通知不存在', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .patch(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ read: true })
        .expect(404)

      expect(response.body.error).toBe('找不到通知')
    })
  })

  describe('DELETE /api/notifications/:id', () => {
    it('應該能軟刪除通知收件項', async () => {
      await request(app)
        .delete(`/api/notifications/${testReceipt._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204)

      // 驗證收件項已被軟刪除
      const deletedReceipt = await NotificationReceipt.findById(testReceipt._id)
      expect(deletedReceipt.deleted_at).toBeTruthy()

      // 驗證通知事件仍然存在
      const notification = await Notification.findById(testNotification._id)
      expect(notification).toBeTruthy()
    })

    it('應該支援重複刪除（不會出錯）', async () => {
      // 第一次刪除
      await request(app)
        .delete(`/api/notifications/${testReceipt._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204)

      // 第二次刪除應該仍然成功
      await request(app)
        .delete(`/api/notifications/${testReceipt._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204)
    })

    it('應該傳回 404 當通知不存在', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .delete(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)

      expect(response.body.error).toBe('找不到通知')
    })
  })

  describe('PATCH /api/notifications/:id/read', () => {
    it('應該能標記通知為已讀', async () => {
      const response = await request(app)
        .patch(`/api/notifications/${testReceipt._id}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.isRead).toBe(true)

      // 驗證資料庫中的更新
      const updatedReceipt = await NotificationReceipt.findById(testReceipt._id)
      expect(updatedReceipt.read_at).toBeTruthy()
    })
  })

  describe('PATCH /api/notifications/read/all', () => {
    it('應該能標記所有通知為已讀', async () => {
      // 建立另一個未讀通知
      const notification2 = await Notification.create({
        actor_id: testUser2._id,
        verb: 'comment',
        object_type: 'meme',
        object_id: new mongoose.Types.ObjectId(),
        title: '新評論',
        content: 'testuser2 評論了您的迷因',
      })

      await NotificationReceipt.create({
        notification_id: notification2._id,
        user_id: testUser._id,
      })

      const response = await request(app)
        .patch('/api/notifications/read/all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.updatedCount).toBe(2)

      // 驗證所有通知都已標記為已讀
      const receipts = await NotificationReceipt.find({ user_id: testUser._id })
      receipts.forEach((receipt) => {
        expect(receipt.read_at).toBeTruthy()
      })
    })
  })

  describe('DELETE /api/notifications', () => {
    it('應該能批次刪除通知', async () => {
      const response = await request(app)
        .delete('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [testReceipt._id.toString()] })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.deletedCount).toBe(1)

      // 驗證收件項已被軟刪除
      const deletedReceipt = await NotificationReceipt.findById(testReceipt._id)
      expect(deletedReceipt.deleted_at).toBeTruthy()
    })

    it('應該支援條件刪除', async () => {
      const response = await request(app)
        .delete('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ unreadOnly: true })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.deletedCount).toBe(1)
    })

    it('應該傳回 400 當沒有提供刪除條件', async () => {
      const response = await request(app)
        .delete('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400)

      expect(response.body.error).toBe('請提供刪除條件：ids 或 olderThan 或 unreadOnly')
    })
  })

  describe('GET /api/notifications/unread/count', () => {
    it('應該能取得未讀通知數量', async () => {
      const response = await request(app)
        .get('/api/notifications/unread/count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.unreadCount).toBe(1)
    })
  })

  describe('管理員功能', () => {
    it('應該能建立通知事件', async () => {
      const response = await request(app)
        .post('/api/notifications/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          actor_id: testUser._id,
          verb: 'system',
          object_type: 'user',
          object_id: testUser._id,
          title: '系統維護通知',
          content: '系統將於今晚進行維護',
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.title).toBe('系統維護通知')
    })

    it('應該只允許管理員用戶建立通知', async () => {
      await request(app)
        .post('/api/notifications/admin')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          actor_id: testUser._id,
          verb: 'system',
          object_type: 'user',
          object_id: testUser._id,
          title: '測試通知',
          content: '這是一個測試通知',
        })
        .expect(403)
    })

    it('應該能硬刪除通知事件', async () => {
      // 驗證通知事件已被刪除
      const response = await request(app)
        .delete(`/api/notifications/admin/${testNotification._id}?hard=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.deletedReceipts).toBe(1)

      // 驗證通知事件已被刪除
      const deletedNotification = await Notification.findById(testNotification._id)
      expect(deletedNotification).toBeNull()

      // 驗證相關收件項也被刪除
      const deletedReceipt = await NotificationReceipt.findById(testReceipt._id)
      expect(deletedReceipt).toBeNull()
    })

    it('應該傳回 400 當缺少 hard 參數', async () => {
      const response = await request(app)
        .delete(`/api/notifications/admin/${testNotification._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400)

      expect(response.body.error).toBe('請使用 hard=true 參數來確認硬刪除操作')
    })

    it('應該只允許管理員用戶硬刪除通知', async () => {
      await request(app)
        .delete(`/api/notifications/admin/${testNotification._id}?hard=true`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
    })

    it('應該能清理孤兒收件項', async () => {
      const response = await request(app)
        .post('/api/notifications/admin/cleanup-orphans')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.deletedCount).toBeGreaterThanOrEqual(0)
    })
  })
})
