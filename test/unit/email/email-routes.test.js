import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'

describe('Email 路由', () => {
  it('GET /api/email/status 應可回傳狀態（允許 200 或 503）', async () => {
    const res = await request(app).get('/api/email/status')
    expect([200, 503]).toContain(res.status)
    expect(typeof res.body.success).toBe('boolean')
    expect(typeof res.body.message).toBe('string')
  })

  it('POST /api/email/test 應該成功（有效 email）', async () => {
    const res = await request(app)
      .post('/api/email/test')
      .send({ email: 'user@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /api/email/test 應該拒絕無效 email', async () => {
    const res = await request(app)
      .post('/api/email/test')
      .send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /api/email/verification 應該成功', async () => {
    const res = await request(app)
      .post('/api/email/verification')
      .send({ email: 'verify@example.com', username: 'verify_user', verificationToken: 'tok_123' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /api/email/password-reset 應該成功', async () => {
    const res = await request(app)
      .post('/api/email/password-reset')
      .send({ email: 'reset@example.com', username: 'reset_user', resetToken: 'tok_456' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})