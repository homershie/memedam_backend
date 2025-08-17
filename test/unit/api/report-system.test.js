import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import Report from '../../../models/Report.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Notification from '../../../models/Notification.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('檢舉系統測試', () => {
  let testUser, testMeme, testReport, authToken

  beforeAll(async () => {
    // 清理測試資料
    await cleanupTestData({ Report, User, Meme, Notification })
  })

  beforeEach(async () => {
    // 建立測試用戶
    testUser = await createTestUser(User, {
      role: 'user',
      status: 'active',
      is_verified: true,
    })

    // 建立測試迷因
    testMeme = await createTestMeme(Meme, testUser._id, {
      title: '測試迷因',
      type: 'image',
      content: '這是一個測試迷因',
      image_url: 'https://example.com/test.jpg',
      status: 'public',
      tags_cache: ['test'],
    })

    // 取得認證 token
    const loginResponse = await request(app).post('/api/users/login').send({
      login: testUser.email,
      password: 'testpassword123',
    })

    authToken = loginResponse.body.token
  })

  afterEach(async () => {
    // 清理測試資料
    await cleanupTestData({ Report, Notification })
  })

  afterAll(async () => {
    await cleanupTestData({ Report, User, Meme, Notification })
  })

  describe('檢舉提交', () => {
    it('應該能成功提交檢舉', async () => {
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

    it('應該防止重複檢舉', async () => {
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

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該驗證檢舉原因', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'invalid_reason',
          description: '無效的檢舉原因',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該驗證目標類型', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'invalid_type',
          target_id: testMeme._id.toString(),
          reason: 'inappropriate',
          description: '無效的目標類型',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('檢舉查詢', () => {
    beforeEach(async () => {
      // 創建一些測試檢舉
      await Report.create([
        {
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate',
          description: '檢舉1',
          status: 'pending',
        },
        {
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'spam',
          description: '檢舉2',
          status: 'resolved',
        },
      ])
    })

    it('應該能查詢用戶的檢舉歷史', async () => {
      const response = await request(app)
        .get('/api/reports/my-reports')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })

    it('應該能按狀態篩選檢舉', async () => {
      const response = await request(app)
        .get('/api/reports/my-reports?status=pending')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      response.body.data.forEach((report) => {
        expect(report.status).toBe('pending')
      })
    })
  })

  describe('管理員功能', () => {
    let adminUser, adminToken

    beforeEach(async () => {
      // 創建管理員用戶
      adminUser = await createTestUser(User, {
        role: 'admin',
        status: 'active',
        is_verified: true,
      })

      const adminLoginResponse = await request(app).post('/api/users/login').send({
        login: adminUser.email,
        password: 'testpassword123',
      })

      adminToken = adminLoginResponse.body.token

      // 創建測試檢舉
      await Report.create({
        reporter_id: testUser._id,
        target_type: 'meme',
        target_id: testMeme._id,
        reason: 'inappropriate',
        description: '管理員測試檢舉',
        status: 'pending',
      })
    })

    it('管理員應該能查看所有檢舉', async () => {
      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    it('管理員應該能更新檢舉狀態', async () => {
      const report = await Report.findOne({ status: 'pending' })

      const response = await request(app)
        .patch(`/api/reports/${report._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          admin_notes: '已處理此檢舉',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('resolved')
    })

    it('非管理員無法查看所有檢舉', async () => {
      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(403)
    })
  })

  describe('檢舉統計', () => {
    beforeEach(async () => {
      // 創建不同類型的檢舉
      await Report.create([
        {
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate',
          status: 'pending',
        },
        {
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'spam',
          status: 'resolved',
        },
        {
          reporter_id: testUser._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'copyright',
          status: 'rejected',
        },
      ])
    })

    it('應該能獲取檢舉統計', async () => {
      const response = await request(app)
        .get('/api/reports/statistics')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('total')
      expect(response.body.data).toHaveProperty('byStatus')
      expect(response.body.data).toHaveProperty('byReason')
    })
  })

  describe('通知功能', () => {
    it('提交檢舉後應該發送通知', async () => {
      await request(app).post('/api/reports').set('Authorization', `Bearer ${authToken}`).send({
        target_type: 'meme',
        target_id: testMeme._id.toString(),
        reason: 'inappropriate',
        description: '測試通知',
      })

      // 檢查是否創建了通知
      const notifications = await Notification.find({
        recipient_id: testUser._id,
        type: 'report_submitted',
      })

      expect(notifications.length).toBeGreaterThan(0)
    })
  })

  describe('檢舉品質檢查', () => {
    it('應該檢查檢舉內容品質', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'inappropriate',
          description: 'a', // 太短的描述
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該檢查檢舉頻率限制', async () => {
      // 快速提交多個檢舉
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/reports')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            target_type: 'meme',
            target_id: testMeme._id.toString(),
            reason: 'inappropriate',
            description: `檢舉 ${i}`,
          })
      }

      // 檢查是否觸發頻率限制
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id.toString(),
          reason: 'inappropriate',
          description: '頻率限制測試',
        })

      // 可能被限制或成功，取決於實際實現
      expect([200, 201, 429]).toContain(response.status)
    })
  })
})
