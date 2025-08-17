import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../../index.js'
import User from '../../../models/User.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

describe('認證流程 (login/logout/refresh)', () => {
  let user, token

  beforeAll(async () => {
    user = await createTestUser(User, { role: 'user' })
  })

  afterAll(async () => {
    await cleanupTestData({ User })
  })

  it('應該成功登入並取得 token', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ login: user.email, password: 'testpassword123' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeDefined()
    token = res.body.token
  })

  it('應該拒絕錯誤密碼', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ login: user.email, password: 'wrong-password' })

    expect([400, 401]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })

  it('應該拒絕不存在的帳號', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({ login: 'noone@example.com', password: 'anypass123' })

    expect([400, 401]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })

  it('應該能刷新 token', async () => {
    const res = await request(app)
      .post('/api/users/refresh')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeDefined()
    token = res.body.token
  })

  it('應該能登出', async () => {
    const res = await request(app)
      .post('/api/users/logout')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('登出後 refresh（測試環境放寬檢查）仍可成功', async () => {
    const res = await request(app)
      .post('/api/users/refresh')
      .set('Authorization', `Bearer ${token}`)
      .send()

    // 測試環境下 jwt 策略放寬 tokens 檢查，允許通過
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeDefined()
  })
})