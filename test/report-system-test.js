import mongoose from 'mongoose'
import request from 'supertest'
import { app } from '../index.js'
import Report from '../models/Report.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Notification from '../models/Notification.js'

describe('檢舉系統測試', () => {
  let testUser, testMeme, testReport, authToken

  beforeAll(async () => {
    // 連接到測試資料庫
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/memedam_test')

    // 清理測試資料
    await Report.deleteMany({})
    await User.deleteMany({})
    await Meme.deleteMany({})
    await Notification.deleteMany({})
  })

  beforeEach(async () => {
    // 建立測試用戶
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'user',
    })

    // 建立測試迷因
    testMeme = await Meme.create({
      title: '測試迷因',
      description: '這是一個測試迷因',
      image_url: 'https://example.com/test.jpg',
      user_id: testUser._id,
      tags: ['test'],
    })

    // 取得認證 token
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
    })

    authToken = loginResponse.body.data.token
  })

  afterEach(async () => {
    // 清理測試資料
    await Report.deleteMany({})
    await Notification.deleteMany({})
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  describe('檢舉提交', () => {
    test('應該能成功提交檢舉', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'inappropriate',
          description: '這個迷因內容不當',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.target_type).toBe('meme')
      expect(response.body.data.reason).toBe('inappropriate')
    })

    test('應該防止重複檢舉', async () => {
      // 第一次檢舉
      await request(app).post('/api/reports').set('Authorization', `Bearer ${authToken}`).send({
        target_type: 'meme',
        target_id: testMeme._id.toString(),
        reason: 'inappropriate',
        description: '這個迷因內容不當',
      })

      // 第二次檢舉同一目標
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'spam',
          description: '這是垃圾內容',
        })

      expect(response.status).toBe(409)
      expect(response.body.success).toBe(false)
    })

    test('應該驗證目標是否存在', async () => {
      const fakeId = new mongoose.Types.ObjectId()
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: fakeId.toString(),
          reason: 'inappropriate',
          description: '這個迷因內容不當',
        })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })

    test('應該驗證檢舉原因', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'invalid_reason',
          description: '這個迷因內容不當',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('檢舉查詢', () => {
    beforeEach(async () => {
      // 建立測試檢舉
      testReport = await Report.create({
        reporter_id: testUser._id,
        target_type: 'meme',
        target_id: testMeme._id,
        reason: 'inappropriate',
        description: '這個迷因內容不當',
      })
    })

    test('用戶應該能查看自己的檢舉', async () => {
      const response = await request(app)
        .get('/api/reports/my')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.reports).toHaveLength(1)
      expect(response.body.data.reports[0]._id).toBe(testReport._id.toString())
    })

    test('應該支援分頁查詢', async () => {
      const response = await request(app)
        .get('/api/reports/my?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.pagination).toBeDefined()
      expect(response.body.data.pagination.page).toBe(1)
      expect(response.body.data.pagination.limit).toBe(10)
    })
  })

  describe('檢舉處理', () => {
    let adminToken

    beforeEach(async () => {
      // 建立管理員用戶
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      })

      // 取得管理員認證 token
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      })

      adminToken = loginResponse.body.data.token

      // 建立測試檢舉
      testReport = await Report.create({
        reporter_id: testUser._id,
        target_type: 'meme',
        target_id: testMeme._id,
        reason: 'inappropriate',
        description: '這個迷因內容不當',
      })
    })

    test('管理員應該能處理檢舉', async () => {
      const response = await request(app)
        .put(`/api/reports/${testReport._id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'processed',
          action: 'warn_author',
          admin_comment: '內容已警告處理',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('processed')
      expect(response.body.data.action).toBe('warn_author')
    })

    test('管理員應該能批次處理檢舉', async () => {
      // 建立多個檢舉
      const reports = await Promise.all([
        Report.create({
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'spam',
          description: '垃圾內容',
        }),
        Report.create({
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'copyright',
          description: '版權問題',
        }),
      ])

      const response = await request(app)
        .put('/api/reports/batch/resolve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ids: reports.map((r) => r._id.toString()),
          status: 'processed',
          action: 'remove_content',
          admin_comment: '批次處理完成',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.updatedCount).toBe(2)
    })

    test('非管理員不能處理檢舉', async () => {
      const response = await request(app)
        .put(`/api/reports/${testReport._id}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'processed',
          action: 'warn_author',
          admin_comment: '內容已警告處理',
        })

      expect(response.status).toBe(403)
    })
  })

  describe('通知系統', () => {
    test('檢舉提交後應該發送通知', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'inappropriate',
          description: '這個迷因內容不當',
        })

      expect(response.status).toBe(201)

      // 檢查是否發送了通知
      const notifications = await Notification.find({
        user_id: testUser._id,
        type: 'report_submitted',
      })

      expect(notifications).toHaveLength(1)
      expect(notifications[0].title).toBe('檢舉已提交')
    })

    test('檢舉處理後應該發送通知', async () => {
      // 建立管理員用戶
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      })

      const adminLoginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      })

      const adminToken = adminLoginResponse.body.data.token

      // 建立檢舉
      const report = await Report.create({
        reporter_id: testUser._id,
        target_type: 'meme',
        target_id: testMeme._id,
        reason: 'inappropriate',
        description: '這個迷因內容不當',
      })

      // 處理檢舉
      await request(app)
        .put(`/api/reports/${report._id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'processed',
          action: 'warn_author',
          admin_comment: '內容已警告處理',
        })

      // 檢查是否發送了處理通知
      const processedNotifications = await Notification.find({
        user_id: testUser._id,
        type: 'report_processed',
      })

      expect(processedNotifications).toHaveLength(1)
      expect(processedNotifications[0].title).toBe('檢舉已處理')

      // 檢查是否發送了作者警告通知
      const authorNotifications = await Notification.find({
        user_id: testMeme.user_id,
        type: 'author_warned',
      })

      expect(authorNotifications).toHaveLength(1)
      expect(authorNotifications[0].title).toBe('內容警告')
    })
  })

  describe('統計功能', () => {
    let adminToken

    beforeEach(async () => {
      // 建立管理員用戶
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      })

      const adminLoginResponse = await request(app).post('/api/auth/login').send({
        email: 'admin@example.com',
        password: 'password123',
      })

      adminToken = adminLoginResponse.body.data.token

      // 建立多個檢舉
      await Promise.all([
        Report.create({
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate',
          status: 'pending',
        }),
        Report.create({
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'spam',
          status: 'processed',
        }),
        Report.create({
          reporter_id: testUser._id,
          target_type: 'comment',
          target_id: new mongoose.Types.ObjectId(),
          reason: 'hate_speech',
          status: 'rejected',
        }),
      ])
    })

    test('應該能取得檢舉統計', async () => {
      const response = await request(app)
        .get('/api/reports/stats?period=7d')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.totalReports).toBe(3)
      expect(response.body.data.pendingReports).toBe(1)
      expect(response.body.data.processedReports).toBe(1)
      expect(response.body.data.rejectedReports).toBe(1)
    })
  })
})
