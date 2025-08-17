import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import { createTestUser, cleanupTestData } from '../../setup.js'
import Redis from 'ioredis-mock'

// Mock Redis
vi.mock('../../../config/redis.js', () => ({
  default: new Redis(),
}))

describe('Rate Limit 測試', () => {
  let testUser
  let authToken
  let redis

  beforeAll(async () => {
    // 初始化 mock Redis
    redis = new Redis()
    
    // 創建測試用戶
    testUser = await createTestUser(User, {
      username: `ratelimit_${Date.now()}`,
      email: `ratelimit_${Date.now()}@example.com`,
    })

    // 登入取得 token
    const loginResponse = await request(app)
      .post('/api/users/login')
      .send({
        email: testUser.email,
        password: 'testpassword123',
      })

    authToken = loginResponse.body.token
  })

  beforeEach(async () => {
    // 清理 Redis
    await redis.flushall()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupTestData({ User })
    await redis.quit()
  })

  describe('IP 基礎限流', () => {
    it('應該限制同一 IP 的請求頻率', async () => {
      const endpoint = '/api/memes'
      const maxRequests = 100 // 假設限制為每分鐘 100 次
      const requests = []

      // 發送多個請求
      for (let i = 0; i < maxRequests + 5; i++) {
        const response = await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.1')
        
        requests.push(response.status)
      }

      // 前 maxRequests 個請求應該成功
      const successCount = requests.slice(0, maxRequests).filter(status => status < 429).length
      expect(successCount).toBeGreaterThan(maxRequests * 0.9) // 允許一些誤差

      // 超過限制的請求應該被拒絕
      const blockedCount = requests.slice(maxRequests).filter(status => status === 429).length
      expect(blockedCount).toBeGreaterThan(0)
    })

    it('應該區分不同 IP 的限流', async () => {
      const endpoint = '/api/memes'
      
      // IP 1 發送請求
      const response1 = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.1')
      
      expect(response1.status).toBeLessThan(429)

      // IP 2 發送請求（不應受 IP 1 影響）
      const response2 = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.2')
      
      expect(response2.status).toBeLessThan(429)
    })

    it('應該在 headers 中返回限流資訊', async () => {
      const response = await request(app)
        .get('/api/memes')
        .set('X-Forwarded-For', '192.168.1.1')

      expect(response.headers['x-ratelimit-limit']).toBeDefined()
      expect(response.headers['x-ratelimit-remaining']).toBeDefined()
      expect(response.headers['x-ratelimit-reset']).toBeDefined()
    })
  })

  describe('用戶基礎限流', () => {
    it('應該限制同一用戶的請求頻率', async () => {
      const endpoint = '/api/users/profile'
      const maxRequests = 50 // 假設用戶限制為每分鐘 50 次
      const requests = []

      // 發送多個請求
      for (let i = 0; i < maxRequests + 5; i++) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
        
        requests.push(response.status)
      }

      // 檢查是否有請求被限流
      const blockedCount = requests.filter(status => status === 429).length
      expect(blockedCount).toBeGreaterThan(0)
    })

    it('應該區分不同用戶的限流', async () => {
      // 創建第二個用戶
      const user2 = await createTestUser(User, {
        username: `ratelimit2_${Date.now()}`,
        email: `ratelimit2_${Date.now()}@example.com`,
      })

      const loginResponse2 = await request(app)
        .post('/api/users/login')
        .send({
          email: user2.email,
          password: 'testpassword123',
        })

      const authToken2 = loginResponse2.body.token

      // 用戶 1 發送請求
      const response1 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
      
      expect(response1.status).toBeLessThan(429)

      // 用戶 2 發送請求（不應受用戶 1 影響）
      const response2 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken2}`)
      
      expect(response2.status).toBeLessThan(429)
    })
  })

  describe('端點特定限流', () => {
    it('應該對敏感端點有更嚴格的限制', async () => {
      const loginEndpoint = '/api/users/login'
      const maxAttempts = 5 // 登入端點通常限制更嚴格
      const requests = []

      // 發送多個登入請求
      for (let i = 0; i < maxAttempts + 2; i++) {
        const response = await request(app)
          .post(loginEndpoint)
          .set('X-Forwarded-For', '192.168.1.100')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          })
        
        requests.push(response.status)
      }

      // 超過限制後應該被封鎖
      const lastRequests = requests.slice(-2)
      expect(lastRequests.some(status => status === 429)).toBe(true)
    })

    it('應該對不同端點有獨立的限流計數', async () => {
      // 對端點 A 發送請求
      await request(app)
        .get('/api/memes')
        .set('X-Forwarded-For', '192.168.1.50')

      // 對端點 B 發送請求（不應受端點 A 影響）
      const response = await request(app)
        .get('/api/users')
        .set('X-Forwarded-For', '192.168.1.50')
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).not.toBe(429)
    })
  })

  describe('滑動視窗演算法', () => {
    it('應該實現滑動視窗限流', async () => {
      vi.useFakeTimers()
      const now = new Date('2024-01-01T00:00:00Z')
      vi.setSystemTime(now)

      const endpoint = '/api/memes'
      const windowSize = 60000 // 60 秒視窗
      const limit = 10

      // 在視窗開始發送一半請求
      for (let i = 0; i < limit / 2; i++) {
        await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.200')
      }

      // 移動到視窗中間
      vi.advanceTimersByTime(windowSize / 2)

      // 發送另一半請求
      for (let i = 0; i < limit / 2; i++) {
        await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.200')
      }

      // 此時應該還能發送請求（因為最早的請求已經在半個視窗外）
      vi.advanceTimersByTime(windowSize / 2 + 1000)
      
      const response = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.200')

      expect(response.status).toBeLessThan(429)

      vi.useRealTimers()
    })

    it('應該正確計算剩餘配額', async () => {
      const endpoint = '/api/memes'
      const limit = 100
      const used = 30

      // 發送一些請求
      for (let i = 0; i < used; i++) {
        await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.201')
      }

      // 檢查剩餘配額
      const response = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.201')

      const remaining = parseInt(response.headers['x-ratelimit-remaining'])
      expect(remaining).toBeLessThanOrEqual(limit - used)
      expect(remaining).toBeGreaterThan(0)
    })
  })

  describe('封鎖與解除', () => {
    it('應該在達到限制後封鎖請求', async () => {
      const endpoint = '/api/memes'
      const limit = 10

      // 快速發送超過限制的請求
      const responses = []
      for (let i = 0; i < limit + 5; i++) {
        const response = await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.203')
        responses.push(response)
      }

      // 最後的請求應該被封鎖
      const lastResponse = responses[responses.length - 1]
      expect(lastResponse.status).toBe(429)
      expect(lastResponse.body.message).toContain('請求過於頻繁')
    })

    it('應該在時間窗口過後自動解除封鎖', async () => {
      vi.useFakeTimers()
      const now = new Date('2024-01-01T00:00:00Z')
      vi.setSystemTime(now)

      const endpoint = '/api/memes'
      const blockDuration = 60000 // 60 秒封鎖時間

      // 觸發封鎖
      for (let i = 0; i < 200; i++) {
        await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.204')
      }

      // 確認被封鎖
      const blockedResponse = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.204')

      expect(blockedResponse.status).toBe(429)

      // 等待封鎖時間過去
      vi.advanceTimersByTime(blockDuration + 1000)

      // 應該可以再次發送請求
      const unblockedResponse = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.204')

      expect(unblockedResponse.status).not.toBe(429)

      vi.useRealTimers()
    })

    it('應該返回 Retry-After header', async () => {
      const endpoint = '/api/memes'

      // 觸發限流
      for (let i = 0; i < 200; i++) {
        await request(app)
          .get(endpoint)
          .set('X-Forwarded-For', '192.168.1.205')
      }

      const response = await request(app)
        .get(endpoint)
        .set('X-Forwarded-For', '192.168.1.205')

      expect(response.status).toBe(429)
      expect(response.headers['retry-after']).toBeDefined()
      
      const retryAfter = parseInt(response.headers['retry-after'])
      expect(retryAfter).toBeGreaterThan(0)
    })
  })

  describe('分散式限流', () => {
    it('應該在多個實例間共享限流狀態', async () => {
      // 模擬第一個實例的請求
      const instance1Key = 'ratelimit:192.168.1.206'
      await redis.incr(instance1Key)
      await redis.expire(instance1Key, 60)

      // 模擬第二個實例檢查限流
      const count = await redis.get(instance1Key)
      expect(parseInt(count)).toBe(1)

      // 第二個實例增加計數
      await redis.incr(instance1Key)
      const newCount = await redis.get(instance1Key)
      expect(parseInt(newCount)).toBe(2)
    })

    it('應該處理 Redis 連接失敗的降級策略', async () => {
      // 模擬 Redis 連接失敗
      vi.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis connection failed'))

      // 即使 Redis 失敗，請求也應該通過（降級策略）
      const response = await request(app)
        .get('/api/memes')
        .set('X-Forwarded-For', '192.168.1.207')

      expect(response.status).not.toBe(429)
    })
  })
})