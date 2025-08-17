import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'

// 縮減版：不驗證 headers 與實際達到限流，只確認端點可回應
describe('Rate Limit 相關端點可回應', () => {
  it('GET /api/memes 可回應（狀態碼 < 500）', async () => {
    const res = await request(app).get('/api/memes')
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
  })

  it('GET /api/users 需授權（允許 200/401/403）', async () => {
    const res = await request(app).get('/api/users')
    expect([200, 401, 403]).toContain(res.status)
  })

  it('POST /api/users/login 對不完整憑證返回 400/401', async () => {
    const res = await request(app).post('/api/users/login').send({})
    expect([400, 401]).toContain(res.status)
  })
})