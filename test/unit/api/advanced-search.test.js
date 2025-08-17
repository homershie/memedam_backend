import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('進階搜尋功能測試', () => {
  let testUser
  let authToken
  let testMemes = []

  beforeAll(async () => {
    // 創建測試用戶
    testUser = await createTestUser(User, {
      username: `search_user_${Date.now()}`,
      email: `search_${Date.now()}@example.com`,
    })

    // 登入取得 token
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email: testUser.email,
        password: 'testpassword123',
      })
    authToken = loginResponse.body.token

    // 創建多個測試迷因
    const memeData = [
      {
        title: '有趣的程式設計迷因',
        description: '這是一個關於程式設計的有趣迷因',
        tags: ['程式設計', '有趣', 'javascript'],
        author_id: testUser._id,
        view_count: 1000,
        like_count: 100,
        share_count: 20,
        created_at: new Date('2024-01-01'),
      },
      {
        title: '熱門貓咪迷因',
        description: '超級可愛的貓咪迷因，大家都喜歡',
        tags: ['貓咪', '熱門', '可愛'],
        author_id: testUser._id,
        view_count: 5000,
        like_count: 500,
        share_count: 100,
        created_at: new Date('2024-01-15'),
      },
      {
        title: '最新科技趨勢',
        description: 'AI 和機器學習的最新發展',
        tags: ['科技', 'AI', '機器學習', '最新'],
        author_id: testUser._id,
        view_count: 2000,
        like_count: 200,
        share_count: 50,
        created_at: new Date('2024-02-01'),
      },
      {
        title: 'JavaScript 框架比較',
        description: 'React vs Vue vs Angular 的詳細比較',
        tags: ['javascript', 'react', 'vue', 'angular', '框架'],
        author_id: testUser._id,
        view_count: 3000,
        like_count: 300,
        share_count: 75,
        created_at: new Date('2024-02-10'),
      },
      {
        title: '狗狗的日常生活',
        description: '記錄狗狗們的可愛瞬間',
        tags: ['狗狗', '寵物', '日常', '可愛'],
        author_id: testUser._id,
        view_count: 1500,
        like_count: 150,
        share_count: 30,
        created_at: new Date('2024-02-15'),
      },
    ]

    for (const data of memeData) {
      const meme = await createTestMeme(Meme, data)
      testMemes.push(meme)
    }
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme })
  })

  describe('基本搜尋功能', () => {
    it('應該根據關鍵字搜尋迷因標題', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=程式設計')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.some(meme => 
        meme.title.includes('程式設計')
      )).toBe(true)
    })

    it('應該根據關鍵字搜尋迷因描述', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=機器學習')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.some(meme => 
        meme.description.includes('機器學習')
      )).toBe(true)
    })

    it('應該支援空白搜尋返回所有結果', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })
  })

  describe('標籤搜尋', () => {
    it('應該根據單一標籤搜尋', async () => {
      const response = await request(app)
        .get('/api/memes/search?tags=javascript')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.every(meme => 
        meme.tags.includes('javascript')
      )).toBe(true)
    })

    it('應該支援多個標籤搜尋（OR 邏輯）', async () => {
      const response = await request(app)
        .get('/api/memes/search?tags=貓咪,狗狗')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.every(meme => 
        meme.tags.includes('貓咪') || meme.tags.includes('狗狗')
      )).toBe(true)
    })

    it('應該支援標籤組合搜尋（AND 邏輯）', async () => {
      const response = await request(app)
        .get('/api/memes/search?tags=javascript&tags=框架')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.every(meme => 
        meme.tags.includes('javascript') && meme.tags.includes('框架')
      )).toBe(true)
    })
  })

  describe('排序功能', () => {
    it('應該按照熱門度排序（預設）', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&sort=hot')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      const data = response.body.data
      for (let i = 1; i < data.length; i++) {
        const prevScore = data[i-1].view_count + data[i-1].like_count * 2
        const currScore = data[i].view_count + data[i].like_count * 2
        expect(prevScore).toBeGreaterThanOrEqual(currScore)
      }
    })

    it('應該按照最新時間排序', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&sort=latest')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      const data = response.body.data
      for (let i = 1; i < data.length; i++) {
        expect(new Date(data[i-1].created_at)).toBeGreaterThanOrEqual(
          new Date(data[i].created_at)
        )
      }
    })

    it('應該按照最多讚數排序', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&sort=likes')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      const data = response.body.data
      for (let i = 1; i < data.length; i++) {
        expect(data[i-1].like_count).toBeGreaterThanOrEqual(data[i].like_count)
      }
    })

    it('應該按照最多觀看數排序', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&sort=views')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      const data = response.body.data
      for (let i = 1; i < data.length; i++) {
        expect(data[i-1].view_count).toBeGreaterThanOrEqual(data[i].view_count)
      }
    })
  })

  describe('過濾功能', () => {
    it('應該根據日期範圍過濾', async () => {
      const startDate = '2024-01-10'
      const endDate = '2024-02-05'
      
      const response = await request(app)
        .get(`/api/memes/search?q=&startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      response.body.data.forEach(meme => {
        const memeDate = new Date(meme.created_at)
        expect(memeDate).toBeGreaterThanOrEqual(new Date(startDate))
        expect(memeDate).toBeLessThanOrEqual(new Date(endDate))
      })
    })

    it('應該根據最小讚數過濾', async () => {
      const minLikes = 200
      
      const response = await request(app)
        .get(`/api/memes/search?q=&minLikes=${minLikes}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      response.body.data.forEach(meme => {
        expect(meme.like_count).toBeGreaterThanOrEqual(minLikes)
      })
    })

    it('應該根據最小觀看數過濾', async () => {
      const minViews = 2000
      
      const response = await request(app)
        .get(`/api/memes/search?q=&minViews=${minViews}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      response.body.data.forEach(meme => {
        expect(meme.view_count).toBeGreaterThanOrEqual(minViews)
      })
    })

    it('應該根據作者過濾', async () => {
      const response = await request(app)
        .get(`/api/memes/search?q=&author=${testUser.username}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      response.body.data.forEach(meme => {
        expect(meme.author.username).toBe(testUser.username)
      })
    })
  })

  describe('組合搜尋', () => {
    it('應該支援關鍵字 + 標籤組合搜尋', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=JavaScript&tags=框架')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      response.body.data.forEach(meme => {
        const hasKeyword = meme.title.includes('JavaScript') || 
                          meme.description.includes('JavaScript')
        const hasTag = meme.tags.includes('框架')
        expect(hasKeyword && hasTag).toBe(true)
      })
    })

    it('應該支援多個過濾條件組合', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&tags=javascript&minLikes=100&sort=latest')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      response.body.data.forEach(meme => {
        expect(meme.tags.includes('javascript')).toBe(true)
        expect(meme.like_count).toBeGreaterThanOrEqual(100)
      })
    })
  })

  describe('搜尋建議', () => {
    it('應該提供搜尋建議', async () => {
      const response = await request(app)
        .get('/api/memes/search/suggestions?q=java')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.some(suggestion => 
        suggestion.toLowerCase().includes('java')
      )).toBe(true)
    })

    it('應該提供熱門標籤建議', async () => {
      const response = await request(app)
        .get('/api/memes/search/popular-tags')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.length).toBeGreaterThan(0)
    })
  })

  describe('搜尋歷史', () => {
    it('應該記錄用戶搜尋歷史', async () => {
      // 執行搜尋
      await request(app)
        .get('/api/memes/search?q=測試搜尋')
        .set('Authorization', `Bearer ${authToken}`)

      // 獲取搜尋歷史
      const response = await request(app)
        .get('/api/users/search-history')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body.data.some(item => 
        item.query === '測試搜尋'
      )).toBe(true)
    })

    it('應該能清除搜尋歷史', async () => {
      const response = await request(app)
        .delete('/api/users/search-history')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('分頁功能', () => {
    it('應該支援搜尋結果分頁', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination).toBeDefined()
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(2)
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(2)
    })

    it('應該返回正確的分頁資訊', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&page=2&limit=2')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.pagination.page).toBe(2)
      expect(response.body.pagination.hasNext).toBeDefined()
      expect(response.body.pagination.hasPrev).toBe(true)
    })
  })

  describe('錯誤處理', () => {
    it('應該處理無效的排序參數', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&sort=invalid')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('排序')
    })

    it('應該處理無效的日期格式', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&startDate=invalid-date')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('日期')
    })

    it('應該處理過大的分頁限制', async () => {
      const response = await request(app)
        .get('/api/memes/search?q=&limit=1000')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('限制')
    })
  })
})
