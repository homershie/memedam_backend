import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import Meme from '../../../models/Meme.js'
import { createTestUser, createTestMeme, cleanupTestData } from '../../setup.js'

describe('無限滾動功能測試', () => {
  let testUser
  let authToken
  let testMemes = []
  const totalMemes = 50 // 創建足夠多的迷因來測試無限滾動

  beforeAll(async () => {
    // 創建測試用戶
    testUser = await createTestUser(User, {
      username: `scroll_user_${Date.now()}`,
      email: `scroll_${Date.now()}@example.com`,
    })

    // 登入取得 token
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email: testUser.email,
        password: 'testpassword123',
      })
    authToken = loginResponse.body.token

    // 創建大量測試迷因
    const now = Date.now()
    for (let i = 0; i < totalMemes; i++) {
      const meme = await createTestMeme(Meme, {
        title: `Scroll Test Meme ${i}`,
        description: `Description for infinite scroll test ${i}`,
        author_id: testUser._id,
        image_url: `https://example.com/scroll${i}.jpg`,
        tags: ['scroll', 'test', `batch${Math.floor(i / 10)}`],
        view_count: Math.floor(Math.random() * 1000) + i * 10,
        like_count: Math.floor(Math.random() * 100) + i,
        created_at: new Date(now - i * 60 * 60 * 1000), // 每個相差一小時
      })
      testMemes.push(meme)
    }
  })

  afterAll(async () => {
    await cleanupTestData({ User, Meme })
  })

  describe('基本無限滾動', () => {
    it('應該返回第一批數據', async () => {
      const response = await request(app)
        .get('/api/memes?limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(10)
      expect(response.body).toHaveProperty('nextCursor')
      expect(response.body.hasMore).toBe(true)
    })

    it('應該使用 cursor 獲取下一批數據', async () => {
      // 獲取第一批
      const firstBatch = await request(app)
        .get('/api/memes?limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(firstBatch.status).toBe(200)
      const cursor = firstBatch.body.nextCursor

      // 使用 cursor 獲取第二批
      const secondBatch = await request(app)
        .get(`/api/memes?cursor=${cursor}&limit=10`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(secondBatch.status).toBe(200)
      expect(secondBatch.body.data).toHaveLength(10)
      
      // 確保沒有重複數據
      const firstIds = firstBatch.body.data.map(m => m._id)
      const secondIds = secondBatch.body.data.map(m => m._id)
      const hasOverlap = firstIds.some(id => secondIds.includes(id))
      expect(hasOverlap).toBe(false)
    })

    it('應該正確標記最後一頁', async () => {
      let cursor = null
      let hasMore = true
      let totalFetched = 0

      // 持續滾動直到沒有更多數據
      while (hasMore && totalFetched < totalMemes + 10) {
        const url = cursor 
          ? `/api/memes?cursor=${cursor}&limit=20`
          : '/api/memes?limit=20'
        
        const response = await request(app)
          .get(url)
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        
        totalFetched += response.body.data.length
        hasMore = response.body.hasMore
        cursor = response.body.nextCursor

        // 最後一頁應該標記 hasMore 為 false
        if (response.body.data.length < 20) {
          expect(response.body.hasMore).toBe(false)
        }
      }

      expect(totalFetched).toBeGreaterThanOrEqual(totalMemes)
    })
  })

  describe('基於時間的無限滾動', () => {
    it('應該支援基於時間戳的滾動', async () => {
      const response = await request(app)
        .get('/api/memes?limit=10&sortBy=createdAt')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // 檢查是否按時間排序
      const memes = response.body.data
      for (let i = 1; i < memes.length; i++) {
        expect(new Date(memes[i-1].created_at)).toBeGreaterThanOrEqual(
          new Date(memes[i].created_at)
        )
      }
    })

    it('應該使用時間戳作為 cursor', async () => {
      // 獲取第一批
      const firstBatch = await request(app)
        .get('/api/memes?limit=5&sortBy=createdAt')
        .set('Authorization', `Bearer ${authToken}`)

      const lastMeme = firstBatch.body.data[firstBatch.body.data.length - 1]
      const timestamp = new Date(lastMeme.created_at).getTime()

      // 使用時間戳獲取下一批
      const secondBatch = await request(app)
        .get(`/api/memes?before=${timestamp}&limit=5&sortBy=createdAt`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(secondBatch.status).toBe(200)
      
      // 確保第二批的所有迷因都比第一批的最後一個舊
      secondBatch.body.data.forEach(meme => {
        expect(new Date(meme.created_at)).toBeLessThan(new Date(lastMeme.created_at))
      })
    })
  })

  describe('基於分數的無限滾動', () => {
    it('應該支援基於熱門度分數的滾動', async () => {
      const response = await request(app)
        .get('/api/memes?limit=10&sortBy=hot')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      
      // 檢查是否按熱門度排序
      const memes = response.body.data
      for (let i = 1; i < memes.length; i++) {
        const prevScore = memes[i-1].view_count + memes[i-1].like_count * 2
        const currScore = memes[i].view_count + memes[i].like_count * 2
        expect(prevScore).toBeGreaterThanOrEqual(currScore)
      }
    })

    it('應該處理相同分數的情況', async () => {
      // 創建多個相同分數的迷因
      const sameScoredMemes = []
      for (let i = 0; i < 5; i++) {
        const meme = await createTestMeme(Meme, {
          title: `Same Score Meme ${i}`,
          author_id: testUser._id,
          view_count: 100,
          like_count: 50,
        })
        sameScoredMemes.push(meme)
      }

      const response = await request(app)
        .get('/api/memes?limit=10&sortBy=hot')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })

  describe('過濾條件下的無限滾動', () => {
    it('應該在標籤過濾下保持滾動連續性', async () => {
      // 第一批帶標籤過濾
      const firstBatch = await request(app)
        .get('/api/memes?tags=scroll&limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      expect(firstBatch.status).toBe(200)
      expect(firstBatch.body.data.every(m => m.tags.includes('scroll'))).toBe(true)

      // 使用 cursor 獲取第二批
      if (firstBatch.body.nextCursor) {
        const secondBatch = await request(app)
          .get(`/api/memes?tags=scroll&cursor=${firstBatch.body.nextCursor}&limit=5`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(secondBatch.status).toBe(200)
        expect(secondBatch.body.data.every(m => m.tags.includes('scroll'))).toBe(true)
      }
    })

    it('應該在搜索條件下保持滾動連續性', async () => {
      // 第一批帶搜索條件
      const firstBatch = await request(app)
        .get('/api/memes?q=Test&limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      expect(firstBatch.status).toBe(200)
      
      // 使用 cursor 獲取第二批
      if (firstBatch.body.nextCursor) {
        const secondBatch = await request(app)
          .get(`/api/memes?q=Test&cursor=${firstBatch.body.nextCursor}&limit=5`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(secondBatch.status).toBe(200)
        
        // 確保沒有重複
        const firstIds = firstBatch.body.data.map(m => m._id)
        const secondIds = secondBatch.body.data.map(m => m._id)
        const hasOverlap = firstIds.some(id => secondIds.includes(id))
        expect(hasOverlap).toBe(false)
      }
    })
  })

  describe('錯誤處理', () => {
    it('應該處理無效的 cursor', async () => {
      const response = await request(app)
        .get('/api/memes?cursor=invalid_cursor&limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('cursor')
    })

    it('應該處理過大的 limit', async () => {
      const response = await request(app)
        .get('/api/memes?limit=1000')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.length).toBeLessThanOrEqual(100) // 假設最大限制是 100
    })

    it('應該處理負數 limit', async () => {
      const response = await request(app)
        .get('/api/memes?limit=-10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })

  describe('效能優化', () => {
    it('應該快速返回大批數據', async () => {
      const startTime = Date.now()
      
      const response = await request(app)
        .get('/api/memes?limit=50')
        .set('Authorization', `Bearer ${authToken}`)

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(500) // 應該在 500ms 內返回
    })

    it('應該支援預加載下一批數據', async () => {
      const response = await request(app)
        .get('/api/memes?limit=10&preload=true')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      
      // 檢查是否有預加載提示
      if (response.body.preloadHint) {
        expect(response.body.preloadHint).toHaveProperty('nextCursor')
        expect(response.body.preloadHint).toHaveProperty('expectedCount')
      }
    })
  })

  describe('狀態管理', () => {
    it('應該正確處理並發滾動請求', async () => {
      const requests = []
      
      // 同時發送多個滾動請求
      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app)
            .get(`/api/memes?limit=10&offset=${i * 10}`)
            .set('Authorization', `Bearer ${authToken}`)
        )
      }

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })

      // 確保每個請求返回不同的數據
      const allIds = []
      responses.forEach(response => {
        response.body.data.forEach(meme => {
          expect(allIds).not.toContain(meme._id)
          allIds.push(meme._id)
        })
      })
    })

    it('應該在數據更新後重置滾動', async () => {
      // 獲取第一批
      const firstBatch = await request(app)
        .get('/api/memes?limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      // 創建新迷因
      const newMeme = await createTestMeme(Meme, {
        title: 'Brand New Meme',
        author_id: testUser._id,
        created_at: new Date(),
      })

      // 重新獲取第一批
      const refreshedBatch = await request(app)
        .get('/api/memes?limit=5')
        .set('Authorization', `Bearer ${authToken}`)

      expect(refreshedBatch.status).toBe(200)
      
      // 新迷因應該出現在列表中
      const hasNewMeme = refreshedBatch.body.data.some(m => m._id === newMeme._id.toString())
      expect(hasNewMeme).toBe(true)
    })
  })

  describe('混合推薦滾動', () => {
    it('應該支援混合推薦的無限滾動', async () => {
      const response = await request(app)
        .get('/api/memes/mixed?limit=10')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      
      // 混合推薦應該包含不同類型的內容
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('recommendationType')
      }
    })

    it('應該在混合推薦中避免重複', async () => {
      const seenIds = new Set()
      let cursor = null
      
      // 獲取多批混合推薦
      for (let i = 0; i < 3; i++) {
        const url = cursor 
          ? `/api/memes/mixed?cursor=${cursor}&limit=10`
          : '/api/memes/mixed?limit=10'
        
        const response = await request(app)
          .get(url)
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        
        response.body.data.forEach(meme => {
          expect(seenIds.has(meme._id)).toBe(false)
          seenIds.add(meme._id)
        })
        
        cursor = response.body.nextCursor
        if (!response.body.hasMore) break
      }
    })
  })
})
