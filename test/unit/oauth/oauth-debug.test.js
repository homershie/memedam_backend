import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'

describe('OAuth 調試端點', () => {
  it('GET /api/test/oauth-debug 應回傳成功與調試資訊', async () => {
    const res = await request(app).get('/api/test/oauth-debug')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.debug).toBeDefined()
  })

  it('GET /api/test/oauth-bind-test/google 應回傳成功', async () => {
    const res = await request(app).get('/api/test/oauth-bind-test/google')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.provider).toBe('google')
  })

  it('GET /api/test/oauth-bind-test/invalid 應回傳 400', async () => {
    const res = await request(app).get('/api/test/oauth-bind-test/invalid')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})