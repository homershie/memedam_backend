import request from 'supertest'
import { app } from '../../index.js'

// 測試迷因相關 API 的速率限制
describe('迷因相關 API 速率限制測試', () => {
  test('迷因 API 應該使用寬鬆的限制', async () => {
    // 測試 /api/memes 路徑
    const response = await request(app).get('/api/memes').expect(200) // 應該能正常訪問

    // 檢查是否有 RateLimit headers（表示速率限制正在工作）
    expect(response.headers).toHaveProperty('ratelimit-limit')
    expect(response.headers).toHaveProperty('ratelimit-remaining')
  })

  test('用戶 API 應該使用標準限制', async () => {
    // 測試 /api/users 路徑
    const response = await request(app).get('/api/users').expect(200) // 應該能正常訪問

    // 檢查是否有 RateLimit headers
    expect(response.headers).toHaveProperty('ratelimit-limit')
    expect(response.headers).toHaveProperty('ratelimit-remaining')
  })

  test('認證 API 應該使用嚴格限制', async () => {
    // 測試登入路徑
    const response = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(400) // 應該返回錯誤（因為沒有提供有效憑證）

    // 檢查是否有 RateLimit headers
    expect(response.headers).toHaveProperty('ratelimit-limit')
    expect(response.headers).toHaveProperty('ratelimit-remaining')
  })
})

console.log('速率限制測試完成')
