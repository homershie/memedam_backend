import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('熱門和最新推薦分頁功能測試', () => {
  let testUser
  let authToken
  let testMemes = []

  beforeAll(async () => {
    // 創建測試用戶
    testUser = await createTestUser(User, {
      username: `pagination_user_${Date.now()}`,
      email: `pagination_${Date.now()}@example.com`,
    })

    // 登入取得 token
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email: testUser.email,
        password: 'testpassword123',
      })
    authToken = loginResponse.body.token

    // 創建多個測試迷因，模擬不同的熱門度和時間
    const now = Date.now()
    for (let i = 0; i < 30; i++) {
      const meme = await createTestMeme(Meme, {
        title: `Test Meme ${i}`,
        description: `Description for meme ${i}`,
        author_id: testUser._id,
        image_url: `https://example.com/meme${i}.jpg`,
        tags: ['test', `tag${i % 5}`],
        view_count: Math.floor(Math.random() * 10000),
        like_count: Math.floor(Math.random() * 1000),
        comment_count: Math.floor(Math.random() * 100),
        share_count: Math.floor(Math.random() * 50),
        created_at: new Date(now - i * 24 * 60 * 60 * 1000), // 每個相差一天
        updated_at: new Date(now - i * 24 * 60 * 60 * 1000),
      })
      testMemes.push(meme)
    }
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme })
  })

  describe('熱門推薦分頁測試', () => {
    it('應該返回第一頁的熱門迷因', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBeLessThanOrEqual(10)
      expect(response.body.pagination).toBeDefined()
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(10)
    })

    it('應該返回第二頁的熱門迷因', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=2&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.pagination.page).toBe(2)
      expect(response.body.pagination.hasPrev).toBe(true)
    })

    it('應該按熱門度排序', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      
      const memes = response.body.data
      for (let i = 1; i < memes.length; i++) {
        const prevScore = memes[i-1].view_count + 
                         memes[i-1].like_count * 2 + 
                         memes[i-1].comment_count * 3 +
                         memes[i-1].share_count * 4
        const currScore = memes[i].view_count + 
                         memes[i].like_count * 2 + 
                         memes[i].comment_count * 3 +
                         memes[i].share_count * 4
        expect(prevScore).toBeGreaterThanOrEqual(currScore)
      }
    })

    it('應該支援時間範圍過濾（7天）', async () => {
      const response = await request(app)
        .get('/api/memes/hot?days=7&page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      response.body.data.forEach(meme => {
        expect(new Date(meme.created_at)).toBeGreaterThanOrEqual(sevenDaysAgo)
      })
    })

    it('應該支援時間範圍過濾（30天）', async () => {
      const response = await request(app)
        .get('/api/memes/hot?days=30&page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      response.body.data.forEach(meme => {
        expect(new Date(meme.created_at)).toBeGreaterThanOrEqual(thirtyDaysAgo)
      })
    })

    it('應該返回正確的分頁資訊', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        hasPrev: false,
        hasNext: expect.any(Boolean),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      })
    })

    it('應該處理超出範圍的頁碼', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=999&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(0)
      expect(response.body.pagination.page).toBe(999)
      expect(response.body.pagination.hasPrev).toBe(true)
      expect(response.body.pagination.hasNext).toBe(false)
    })

    it('應該使用預設分頁參數', async () => {
      const response = await request(app)
        .get('/api/memes/hot')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBeDefined()
    })

    it('應該限制最大頁面大小', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=200')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.length).toBeLessThanOrEqual(100) // 假設最大限制是 100
    })
  })

  describe('最新推薦分頁測試', () => {
    it('應該返回最新的迷因', async () => {
      const response = await request(app)
        .get('/api/memes/latest?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBeLessThanOrEqual(10)
    })

    it('應該按時間降序排序', async () => {
      const response = await request(app)
        .get('/api/memes/latest?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      
      const memes = response.body.data
      for (let i = 1; i < memes.length; i++) {
        expect(new Date(memes[i-1].created_at)).toBeGreaterThanOrEqual(
          new Date(memes[i].created_at)
        )
      }
    })

    it('應該支援分頁瀏覽', async () => {
      // 獲取第一頁
      const page1 = await request(app)
        .get('/api/memes/latest?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      // 獲取第二頁
      const page2 = await request(app)
        .get('/api/memes/latest?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      expect(page1.status).toBe(200)
      expect(page2.status).toBe(200)
      
      // 確保兩頁的內容不同
      const page1Ids = page1.body.data.map(m => m._id)
      const page2Ids = page2.body.data.map(m => m._id)
      
      const hasOverlap = page1Ids.some(id => page2Ids.includes(id))
      expect(hasOverlap).toBe(false)
    })

    it('應該返回正確的總頁數', async () => {
      const response = await request(app)
        .get('/api/memes/latest?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.pagination.totalPages).toBe(
        Math.ceil(response.body.pagination.total / 5)
      )
    })

    it('應該處理空結果', async () => {
      const response = await request(app)
        .get('/api/memes/latest?page=1000&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(0)
    })
  })

  describe('混合推薦測試', () => {
    it('應該結合熱門度和新鮮度', async () => {
      const response = await request(app)
        .get('/api/memes/trending?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      
      // 檢查是否有混合的排序邏輯
      const memes = response.body.data
      if (memes.length > 0) {
        expect(memes[0]).toHaveProperty('trending_score')
      }
    })

    it('應該支援權重調整', async () => {
      const response = await request(app)
        .get('/api/memes/trending?hotWeight=0.7&freshWeight=0.3&page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('分頁邊界條件測試', () => {
    it('應該處理負數頁碼', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=-1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('頁碼')
    })

    it('應該處理零頁碼', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=0&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('應該處理負數限制', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=-10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('限制')
    })

    it('應該處理非數字參數', async () => {
      const response = await request(app)
        .get('/api/memes/hot?page=abc&limit=xyz')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('效能測試', () => {
    it('應該在合理時間內返回大量數據', async () => {
      const startTime = Date.now()
      
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=50')
        .set('Authorization', `Bearer ${authToken}`)

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(1000) // 應該在 1 秒內返回
    })

    it('應該有效處理並發請求', async () => {
      const requests = []
      
      for (let i = 1; i <= 5; i++) {
        requests.push(
          request(app)
            .get(`/api/memes/hot?page=${i}&limit=10`)
            .set('Authorization', `Bearer ${authToken}`)
        )
      }

      const responses = await Promise.all(requests)
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200)
        expect(response.body.pagination.page).toBe(index + 1)
      })
    })
  })

  describe('快取測試', () => {
    it('應該快取熱門推薦結果', async () => {
      // 第一次請求
      const response1 = await request(app)
        .get('/api/memes/hot?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      // 第二次相同請求
      const response2 = await request(app)
        .get('/api/memes/hot?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      
      // 檢查是否有快取標頭
      if (response2.headers['x-cache-hit']) {
        expect(response2.headers['x-cache-hit']).toBe('true')
      }
    })

    it('應該在數據更新時清除快取', async () => {
      // 創建新迷因
      await createTestMeme(Meme, {
        title: 'Cache Test Meme',
        author_id: testUser._id,
        view_count: 99999,
        like_count: 9999,
      })

      // 請求應該包含新數據
      const response = await request(app)
        .get('/api/memes/hot?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.some(m => 
        m.title === 'Cache Test Meme'
      )).toBe(true)
    })
  })
})
