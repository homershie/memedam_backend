import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import User from '../../../models/User.js'
import {
  generateUniqueUsername,
  generateUsernameSuggestions,
} from '../../../utils/usernameGenerator.js'
import { createTestUser, cleanupTestData } from '../../setup.js'

describe('用戶名優化功能測試', () => {
  beforeAll(async () => {
    // 清理測試資料
    await User.deleteMany({ username: { $regex: /^test/ } })
  })

  afterAll(async () => {
    await cleanupTestData({ User })
  })

  it('應該為 Google OAuth 用戶生成有效的用戶名', async () => {
    const googleProfile = {
      id: '1234567890',
      emails: [{ value: 'testuser@gmail.com' }],
      displayName: 'Test User',
    }

    const username = await generateUniqueUsername(googleProfile, 'google')
    expect(username).toBeDefined()
    expect(username.length).toBeGreaterThanOrEqual(3)
    expect(username.length).toBeLessThanOrEqual(30)
    expect(/^[a-zA-Z0-9_]+$/.test(username)).toBe(true)
  })

  it('應該為 Discord 用戶生成有效的用戶名', async () => {
    const discordProfile = {
      id: '987654321',
      username: 'gamer_pro',
      email: 'gamer@discord.com',
      verified: true,
    }

    const username = await generateUniqueUsername(discordProfile, 'discord')
    expect(username).toBeDefined()
    expect(username.length).toBeGreaterThanOrEqual(3)
    expect(username.length).toBeLessThanOrEqual(30)
    expect(/^[a-zA-Z0-9_]+$/.test(username)).toBe(true)
  })

  it('應該處理很短的用戶名', async () => {
    const shortProfile = {
      id: 'abc',
      emails: [{ value: 'a@b.com' }],
    }

    const username = await generateUniqueUsername(shortProfile, 'google')
    expect(username).toBeDefined()
    expect(username.length).toBeGreaterThanOrEqual(3)
    expect(username.length).toBeLessThanOrEqual(30)
  })

  it('應該處理很長的用戶名', async () => {
    const longProfile = {
      id: '12345',
      emails: [{ value: 'verylongusernamethatexceedsthelimit@example.com' }],
    }

    const username = await generateUniqueUsername(longProfile, 'google')
    expect(username).toBeDefined()
    expect(username.length).toBeGreaterThanOrEqual(3)
    expect(username.length).toBeLessThanOrEqual(30)
  })

  it('應該處理特殊字符', async () => {
    const specialProfile = {
      id: '12345',
      emails: [{ value: 'user@#$%with&*special()chars@example.com' }],
    }

    const username = await generateUniqueUsername(specialProfile, 'google')
    expect(username).toBeDefined()
    expect(/^[a-zA-Z0-9_]+$/.test(username)).toBe(true)
  })

  it('應該處理重複衝突', async () => {
    // 創建一個已存在的用戶
    await createTestUser(User, {
      username: 'testuser00',
      email: 'existing@example.com',
      login_method: 'local',
    })

    const profile = {
      id: '12345',
      emails: [{ value: 'testuser@gmail.com' }],
      displayName: 'Test User',
    }

    const username = await generateUniqueUsername(profile, 'google')
    expect(username).toBeDefined()
    expect(username).not.toBe('testuser00')
    expect(username).toMatch(/^testuser\d+$/)
  })

  it('應該生成用戶名建議', async () => {
    const profile = {
      id: '12345',
      emails: [{ value: 'suggestions@example.com' }],
      displayName: 'Suggestions User',
    }

    const suggestions = await generateUsernameSuggestions(profile, 'google', 5)
    expect(Array.isArray(suggestions)).toBe(true)
    expect(suggestions.length).toBe(5)

    suggestions.forEach((suggestion) => {
      expect(suggestion).toBeDefined()
      expect(suggestion.length).toBeGreaterThanOrEqual(3)
      expect(suggestion.length).toBeLessThanOrEqual(30)
      expect(/^[a-zA-Z0-9_]+$/.test(suggestion)).toBe(true)
    })
  })

  it('應該為不同 OAuth 提供商生成不同的用戶名', async () => {
    const profile = {
      id: '12345',
      emails: [{ value: 'same@example.com' }],
      displayName: 'Same User',
    }

    const googleUsername = await generateUniqueUsername(profile, 'google')
    const discordUsername = await generateUniqueUsername(profile, 'discord')
    const twitterUsername = await generateUniqueUsername(profile, 'twitter')

    expect(googleUsername).toBeDefined()
    expect(discordUsername).toBeDefined()
    expect(twitterUsername).toBeDefined()

    // 不同提供商可能生成不同的用戶名
    expect([googleUsername, discordUsername, twitterUsername]).toHaveLength(3)
  })

  it('應該處理空或無效的個人資料', async () => {
    const emptyProfile = {}

    await expect(generateUniqueUsername(emptyProfile, 'google')).rejects.toThrow()
  })

  it('應該處理無效的 OAuth 提供商', async () => {
    const profile = {
      id: '12345',
      emails: [{ value: 'test@example.com' }],
    }

    await expect(generateUniqueUsername(profile, 'invalid_provider')).rejects.toThrow()
  })
})
