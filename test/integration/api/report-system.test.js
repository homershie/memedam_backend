import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import Comment from '../../../models/Comment.js'
import Report from '../../../models/Report.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('舉報系統測試', () => {
  let testUser1, testUser2, adminUser
  let testMeme, testComment
  let authToken1, authToken2, adminToken

  beforeAll(async () => {
    // 創建測試用戶
    testUser1 = await createTestUser(User, {
      username: `reporter_${Date.now()}`,
      email: `reporter_${Date.now()}@example.com`,
    })

    testUser2 = await createTestUser(User, {
      username: `reported_${Date.now()}`,
      email: `reported_${Date.now()}@example.com`,
    })

    adminUser = await createTestUser(User, {
      username: `admin_${Date.now()}`,
      email: `admin_${Date.now()}@example.com`,
      role: 'admin',
    })

    // 創建測試內容
    testMeme = await createTestMeme(Meme, {
      title: `test_meme_${Date.now()}`,
      author_id: testUser2._id,
      image_url: 'https://example.com/meme.jpg',
    })

    testComment = await Comment.create({
      content: 'This is a test comment',
      author_id: testUser2._id,
      meme_id: testMeme._id,
    })

    // 登入取得 tokens
    const [login1, login2, loginAdmin] = await Promise.all([
      request(app).post('/api/users/login').send({
        email: testUser1.email,
        password: 'testpassword123',
      }),
      request(app).post('/api/users/login').send({
        email: testUser2.email,
        password: 'testpassword123',
      }),
      request(app).post('/api/users/login').send({
        email: adminUser.email,
        password: 'testpassword123',
      }),
    ])

    authToken1 = login1.body.token
    authToken2 = login2.body.token
    adminToken = loginAdmin.body.token
  })

  beforeEach(async () => {
    // 清理舉報記錄
    await Report.deleteMany({})
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme, Comment, Report })
  })

  describe('創建舉報', () => {
    it('應該成功創建迷因舉報', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '這個迷因包含不當內容',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('report_id')

      const report = await Report.findById(response.body.data.report_id)
      expect(report).toBeDefined()
      expect(report.reporter_id.toString()).toBe(testUser1._id.toString())
      expect(report.target_id.toString()).toBe(testMeme._id.toString())
    })

    it('應該成功創建留言舉報', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'comment',
          target_id: testComment._id,
          reason: 'harassment',
          description: '這個留言包含騷擾內容',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      
      const report = await Report.findById(response.body.data.report_id)
      expect(report.target_type).toBe('comment')
      expect(report.reason).toBe('harassment')
    })

    it('應該成功創建用戶舉報', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'user',
          target_id: testUser2._id,
          reason: 'spam',
          description: '這個用戶發送垃圾訊息',
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      
      const report = await Report.findById(response.body.data.report_id)
      expect(report.target_type).toBe('user')
      expect(report.reason).toBe('spam')
    })

    it('應該驗證必填欄位', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          // 缺少 target_id 和 reason
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('必填')
    })

    it('應該防止重複舉報', async () => {
      // 第一次舉報
      await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '第一次舉報',
        })

      // 嘗試重複舉報
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '重複舉報',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('已經舉報過')
    })

    it('應該防止自我舉報', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '嘗試舉報自己的內容',
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('不能舉報自己')
    })
  })

  describe('舉報品質檢查', () => {
    it('應該拒絕過短的描述', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '太短', // 少於 10 個字
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('描述太短')
    })

    it('應該拒絕過長的描述', async () => {
      const longDescription = 'a'.repeat(1001) // 超過 1000 字

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: longDescription,
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('描述太長')
    })

    it('應該檢測並拒絕垃圾舉報', async () => {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'other',
          description: 'asdfasdfasdf', // 無意義的內容
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('請提供有意義的描述')
    })

    it('應該限制舉報頻率', async () => {
      // 快速創建多個舉報
      const reports = []
      for (let i = 0; i < 10; i++) {
        const meme = await createTestMeme(Meme, {
          title: `spam_test_${i}`,
          author_id: testUser2._id,
        })

        reports.push(
          request(app)
            .post('/api/reports')
            .set('Authorization', `Bearer ${authToken1}`)
            .send({
              target_type: 'meme',
              target_id: meme._id,
              reason: 'spam',
              description: `舉報 ${i} - 這是垃圾內容`,
            })
        )
      }

      const responses = await Promise.all(reports)
      const blockedCount = responses.filter(r => r.status === 429).length
      
      expect(blockedCount).toBeGreaterThan(0)
    })
  })

  describe('舉報狀態管理', () => {
    let reportId

    beforeEach(async () => {
      const report = await Report.create({
        reporter_id: testUser1._id,
        target_type: 'meme',
        target_id: testMeme._id,
        reason: 'inappropriate_content',
        description: '測試舉報',
        status: 'pending',
      })
      reportId = report._id
    })

    it('管理員應該能夠審核舉報', async () => {
      const response = await request(app)
        .patch(`/api/reports/${reportId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'reviewing',
          admin_notes: '正在審核此舉報',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      const updatedReport = await Report.findById(reportId)
      expect(updatedReport.status).toBe('reviewing')
      expect(updatedReport.reviewed_by.toString()).toBe(adminUser._id.toString())
    })

    it('管理員應該能夠批准舉報', async () => {
      const response = await request(app)
        .patch(`/api/reports/${reportId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action_taken: 'content_removed',
          admin_notes: '內容已移除',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      const updatedReport = await Report.findById(reportId)
      expect(updatedReport.status).toBe('resolved')
      expect(updatedReport.action_taken).toBe('content_removed')
    })

    it('管理員應該能夠拒絕舉報', async () => {
      const response = await request(app)
        .patch(`/api/reports/${reportId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rejection_reason: 'no_violation',
          admin_notes: '經審核後未發現違規內容',
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      const updatedReport = await Report.findById(reportId)
      expect(updatedReport.status).toBe('rejected')
      expect(updatedReport.rejection_reason).toBe('no_violation')
    })

    it('非管理員不能審核舉報', async () => {
      const response = await request(app)
        .patch(`/api/reports/${reportId}/review`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({
          status: 'reviewing',
        })

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('權限不足')
    })
  })

  describe('舉報查詢', () => {
    beforeEach(async () => {
      // 創建多個舉報記錄
      await Report.create([
        {
          reporter_id: testUser1._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '舉報 1',
          status: 'pending',
        },
        {
          reporter_id: testUser1._id,
          target_type: 'comment',
          target_id: testComment._id,
          reason: 'harassment',
          description: '舉報 2',
          status: 'reviewing',
        },
        {
          reporter_id: testUser2._id,
          target_type: 'user',
          target_id: testUser1._id,
          reason: 'spam',
          description: '舉報 3',
          status: 'resolved',
        },
      ])
    })

    it('用戶應該能查看自己的舉報記錄', async () => {
      const response = await request(app)
        .get('/api/reports/my-reports')
        .set('Authorization', `Bearer ${authToken1}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.data.every(r => 
        r.reporter_id === testUser1._id.toString()
      )).toBe(true)
    })

    it('管理員應該能查看所有舉報', async () => {
      const response = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.length).toBeGreaterThanOrEqual(3)
    })

    it('應該支援按狀態過濾', async () => {
      const response = await request(app)
        .get('/api/reports?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.every(r => r.status === 'pending')).toBe(true)
    })

    it('應該支援按類型過濾', async () => {
      const response = await request(app)
        .get('/api/reports?target_type=meme')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.every(r => r.target_type === 'meme')).toBe(true)
    })

    it('應該支援分頁', async () => {
      const response = await request(app)
        .get('/api/reports?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination).toBeDefined()
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(2)
    })
  })

  describe('舉報統計', () => {
    beforeEach(async () => {
      // 創建各種狀態的舉報
      const reports = []
      const reasons = ['inappropriate_content', 'harassment', 'spam', 'copyright']
      const statuses = ['pending', 'reviewing', 'resolved', 'rejected']

      for (let i = 0; i < 20; i++) {
        reports.push({
          reporter_id: i % 2 === 0 ? testUser1._id : testUser2._id,
          target_type: ['meme', 'comment', 'user'][i % 3],
          target_id: testMeme._id,
          reason: reasons[i % 4],
          description: `測試舉報 ${i}`,
          status: statuses[i % 4],
          created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        })
      }

      await Report.insertMany(reports)
    })

    it('應該提供舉報總覽統計', async () => {
      const response = await request(app)
        .get('/api/reports/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('total_reports')
      expect(response.body.data).toHaveProperty('pending_reports')
      expect(response.body.data).toHaveProperty('resolved_reports')
      expect(response.body.data).toHaveProperty('rejected_reports')
    })

    it('應該提供按原因分類的統計', async () => {
      const response = await request(app)
        .get('/api/reports/stats/by-reason')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('inappropriate_content')
      expect(response.body.data).toHaveProperty('harassment')
      expect(response.body.data).toHaveProperty('spam')
    })

    it('應該提供按類型分類的統計', async () => {
      const response = await request(app)
        .get('/api/reports/stats/by-type')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('meme')
      expect(response.body.data).toHaveProperty('comment')
      expect(response.body.data).toHaveProperty('user')
    })

    it('應該提供時間趨勢統計', async () => {
      const response = await request(app)
        .get('/api/reports/stats/trends?days=7')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data[0]).toHaveProperty('date')
      expect(response.body.data[0]).toHaveProperty('count')
    })

    it('應該提供熱門被舉報內容', async () => {
      const response = await request(app)
        .get('/api/reports/stats/top-reported')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('target_id')
        expect(response.body.data[0]).toHaveProperty('report_count')
      }
    })
  })

  describe('自動處理', () => {
    it('應該自動封鎖多次被舉報的內容', async () => {
      // 創建多個用戶舉報同一內容
      const reporters = []
      for (let i = 0; i < 5; i++) {
        const user = await createTestUser(User, {
          username: `auto_reporter_${i}`,
          email: `auto_${i}@example.com`,
        })
        reporters.push(user)
      }

      // 每個用戶舉報同一個迷因
      for (const reporter of reporters) {
        await Report.create({
          reporter_id: reporter._id,
          target_type: 'meme',
          target_id: testMeme._id,
          reason: 'inappropriate_content',
          description: '自動處理測試',
          status: 'pending',
        })
      }

      // 觸發自動處理
      const response = await request(app)
        .post('/api/reports/auto-process')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 檢查迷因是否被封鎖
      const meme = await Meme.findById(testMeme._id)
      expect(meme.is_blocked).toBe(true)
    })

    it('應該自動處理垃圾舉報者', async () => {
      // 創建大量無效舉報
      const memes = []
      for (let i = 0; i < 10; i++) {
        const meme = await createTestMeme(Meme, {
          title: `valid_meme_${i}`,
          author_id: testUser2._id,
        })
        memes.push(meme)

        // 創建舉報
        const report = await Report.create({
          reporter_id: testUser1._id,
          target_type: 'meme',
          target_id: meme._id,
          reason: 'spam',
          description: '無效舉報測試',
          status: 'pending',
        })

        // 管理員拒絕舉報
        await Report.findByIdAndUpdate(report._id, {
          status: 'rejected',
          rejection_reason: 'false_report',
          reviewed_by: adminUser._id,
        })
      }

      // 檢查用戶是否被標記
      const user = await User.findById(testUser1._id)
      expect(user.report_abuse_count).toBeGreaterThan(0)
      expect(user.can_report).toBe(false)
    })
  })
})
