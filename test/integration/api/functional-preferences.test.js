import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../../index.js'
import User from '../../../models/User.js'
import PrivacyConsent from '../../../models/PrivacyConsent.js'

// Mock dependencies
vi.mock('../../../models/User.js')
vi.mock('../../../models/PrivacyConsent.js')
vi.mock('../../../middleware/auth.js', () => ({
  token: vi.fn((req, res, next) => {
    req.user = { _id: 'user123', username: 'testuser' }
    next()
  }),
  isUser: vi.fn((req, res, next) => next()),
}))

describe('Functional Preferences API Integration Tests', () => {
  let mockUser, mockPrivacyConsent

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock User model
    mockUser = {
      _id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
      functionalPreferences: {
        theme: 'auto',
        language: 'zh-TW',
        personalization: {
          autoPlay: true,
          showNSFW: false,
          compactMode: false,
          infiniteScroll: true,
          notificationPreferences: {
            email: true,
            push: true,
            mentions: true,
            likes: true,
            comments: true,
          },
        },
        searchPreferences: {
          searchHistory: true,
          searchSuggestions: true,
          defaultSort: 'hot',
          defaultFilter: 'all',
        },
      },
    }

    // Mock PrivacyConsent model
    mockPrivacyConsent = {
      _id: 'consent123',
      userId: 'user123',
      necessary: true,
      functional: true,
      analytics: true,
      consentVersion: '1.0',
      consentSource: 'web',
      createdAt: new Date(),
    }

    User.findById = vi.fn()
    User.findByIdAndUpdate = vi.fn()
    PrivacyConsent.findOne = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/users/preferences/theme', () => {
    it('應該成功設定主題偏好', async () => {
      const updatedUser = {
        ...mockUser,
        functionalPreferences: {
          ...mockUser.functionalPreferences,
          theme: 'dark',
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(updatedUser),
      })

      const response = await request(app)
        .post('/api/users/preferences/theme')
        .send({ theme: 'dark' })
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '主題偏好已儲存',
        data: { theme: 'dark' },
      })

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { 'functionalPreferences.theme': 'dark' },
        { new: true, runValidators: true },
      )
    })

    it('應該拒絕無效的主題選項', async () => {
      const response = await request(app)
        .post('/api/users/preferences/theme')
        .send({ theme: 'invalid' })
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: '無效的主題選項',
        validOptions: ['light', 'dark', 'auto'],
      })
    })
  })

  describe('POST /api/users/preferences/language', () => {
    it('應該成功設定語言偏好', async () => {
      const updatedUser = {
        ...mockUser,
        functionalPreferences: {
          ...mockUser.functionalPreferences,
          language: 'en-US',
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(updatedUser),
      })

      const response = await request(app)
        .post('/api/users/preferences/language')
        .send({ language: 'en-US' })
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '語言偏好已儲存',
        data: { language: 'en-US' },
      })
    })

    it('應該拒絕無效的語言選項', async () => {
      const response = await request(app)
        .post('/api/users/preferences/language')
        .send({ language: 'invalid' })
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: '無效的語言選項',
        validOptions: ['zh-TW', 'en-US', 'ja-JP'],
      })
    })
  })

  describe('POST /api/users/preferences/personalization', () => {
    it('應該成功設定個人化偏好', async () => {
      const personalizationData = {
        autoPlay: false,
        showNSFW: true,
        compactMode: true,
        infiniteScroll: false,
        notificationPreferences: {
          email: false,
          push: true,
          mentions: false,
          likes: true,
          comments: false,
        },
      }

      const updatedUser = {
        ...mockUser,
        functionalPreferences: {
          ...mockUser.functionalPreferences,
          personalization: personalizationData,
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(updatedUser),
      })

      const response = await request(app)
        .post('/api/users/preferences/personalization')
        .send(personalizationData)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '個人化偏好已儲存',
        data: personalizationData,
      })
    })

    it('應該使用預設值當部分設定缺失時', async () => {
      const partialData = { autoPlay: false }
      const expectedData = {
        autoPlay: false,
        showNSFW: false,
        compactMode: false,
        infiniteScroll: true,
        notificationPreferences: {
          email: true,
          push: true,
          mentions: true,
          likes: true,
          comments: true,
        },
      }

      const updatedUser = {
        ...mockUser,
        functionalPreferences: {
          ...mockUser.functionalPreferences,
          personalization: expectedData,
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(updatedUser),
      })

      const response = await request(app)
        .post('/api/users/preferences/personalization')
        .send(partialData)
        .expect(200)

      expect(response.body.data).toEqual(expectedData)
    })
  })

  describe('POST /api/users/preferences/search', () => {
    it('應該成功設定搜尋偏好', async () => {
      const searchData = {
        searchHistory: false,
        searchSuggestions: true,
        defaultSort: 'new',
        defaultFilter: 'sfw',
      }

      const updatedUser = {
        ...mockUser,
        functionalPreferences: {
          ...mockUser.functionalPreferences,
          searchPreferences: searchData,
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(updatedUser),
      })

      const response = await request(app)
        .post('/api/users/preferences/search')
        .send(searchData)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '搜尋偏好已儲存',
        data: searchData,
      })
    })

    it('應該拒絕無效的排序選項', async () => {
      const response = await request(app)
        .post('/api/users/preferences/search')
        .send({ defaultSort: 'invalid' })
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: '無效的排序選項',
        validOptions: ['hot', 'new', 'top', 'rising'],
      })
    })

    it('應該拒絕無效的篩選選項', async () => {
      const response = await request(app)
        .post('/api/users/preferences/search')
        .send({ defaultFilter: 'invalid' })
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: '無效的篩選選項',
        validOptions: ['all', 'sfw', 'nsfw'],
      })
    })
  })

  describe('GET /api/users/preferences', () => {
    it('應該返回完整的偏好設定', async () => {
      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      const response = await request(app).get('/api/users/preferences').expect(200)

      expect(response.body).toEqual({
        success: true,
        data: mockUser.functionalPreferences,
        functionalCookiesEnabled: true,
      })
    })

    it('應該合併 Cookie 和資料庫設定', async () => {
      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      const response = await request(app)
        .get('/api/users/preferences')
        .set('Cookie', 'theme=light; language=ja-JP')
        .expect(200)

      expect(response.body.data.theme).toBe('light')
      expect(response.body.data.language).toBe('ja-JP')
      expect(response.body.data.personalization).toEqual(
        mockUser.functionalPreferences.personalization,
      )
    })

    it('應該處理用戶不存在的情況', async () => {
      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      })

      const response = await request(app).get('/api/users/preferences').expect(404)

      expect(response.body).toEqual({
        success: false,
        message: '用戶不存在',
      })
    })
  })

  describe('DELETE /api/users/preferences', () => {
    it('應該清除所有偏好設定', async () => {
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'user123' })

      const response = await request(app).delete('/api/users/preferences').expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '所有功能偏好設定已清除',
        clearedCookies: ['theme', 'language', 'personalization', 'searchPreferences'],
      })

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        $unset: {
          'functionalPreferences.theme': 1,
          'functionalPreferences.language': 1,
          'functionalPreferences.personalization': 1,
          'functionalPreferences.searchPreferences': 1,
        },
      })
    })
  })

  describe('GET /api/users/privacy-status', () => {
    it('應該返回隱私設定狀態', async () => {
      const response = await request(app).get('/api/users/privacy-status').expect(200)

      expect(response.body).toEqual({
        success: true,
        data: {
          hasPrivacyConsent: true,
          canUseFunctionalCookies: true,
          canTrackAnalytics: true,
          canUseNecessaryCookies: true,
          currentConsent: expect.objectContaining({
            necessary: true,
            functional: true,
            analytics: true,
            consentVersion: '1.0',
            consentSource: 'web',
          }),
        },
      })
    })
  })

  describe('隱私同意檢查', () => {
    it('應該在功能 Cookie 被禁用時跳過設定', async () => {
      // 模擬隱私同意被禁用
      PrivacyConsent.findOne.mockResolvedValue({
        ...mockPrivacyConsent,
        functional: false,
      })

      const response = await request(app)
        .post('/api/users/preferences/theme')
        .send({ theme: 'dark' })
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '主題設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled',
      })

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
    })

    it('應該在功能 Cookie 被禁用時返回預設設定', async () => {
      // 模擬隱私同意被禁用
      PrivacyConsent.findOne.mockResolvedValue({
        ...mockPrivacyConsent,
        functional: false,
      })

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      const response = await request(app).get('/api/users/preferences').expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '功能 Cookie 已停用，使用預設設定',
        data: expect.objectContaining({
          theme: 'auto',
          language: 'zh-TW',
        }),
        functionalCookiesEnabled: false,
      })
    })
  })

  describe('驗證和錯誤處理', () => {
    it('應該驗證主題選項', async () => {
      const invalidThemes = ['', null, undefined, 'invalid', 123]

      for (const invalidTheme of invalidThemes) {
        const response = await request(app)
          .post('/api/users/preferences/theme')
          .send({ theme: invalidTheme })
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('無效的主題選項')
      }
    })

    it('應該驗證語言選項', async () => {
      const invalidLanguages = ['', null, undefined, 'invalid', 123]

      for (const invalidLanguage of invalidLanguages) {
        const response = await request(app)
          .post('/api/users/preferences/language')
          .send({ language: invalidLanguage })
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toBe('無效的語言選項')
      }
    })

    it('應該處理資料庫錯誤', async () => {
      User.findByIdAndUpdate.mockRejectedValue(new Error('Database connection failed'))

      const response = await request(app)
        .post('/api/users/preferences/theme')
        .send({ theme: 'dark' })
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        message: '設定主題偏好失敗',
      })
    })

    it('應該處理用戶不存在的情況', async () => {
      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      })

      const response = await request(app)
        .post('/api/users/preferences/theme')
        .send({ theme: 'dark' })
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        message: '用戶不存在',
      })
    })
  })

  describe('Cookie 設定', () => {
    it('應該設定正確的 Cookie 屬性', async () => {
      const updatedUser = {
        ...mockUser,
        functionalPreferences: {
          ...mockUser.functionalPreferences,
          theme: 'dark',
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(updatedUser),
      })

      const response = await request(app)
        .post('/api/users/preferences/theme')
        .send({ theme: 'dark' })
        .expect(200)

      // 檢查 Cookie 設定
      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()

      const themeCookie = cookies.find((cookie) => cookie.includes('theme='))
      expect(themeCookie).toBeDefined()
      expect(themeCookie).toContain('HttpOnly')
      expect(themeCookie).toContain('SameSite=Lax')
      expect(themeCookie).toContain('Max-Age=31536000') // 1 year
    })

    it('應該在清除偏好時清除所有 Cookie', async () => {
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'user123' })

      const response = await request(app).delete('/api/users/preferences').expect(200)

      const cookies = response.headers['set-cookie']
      expect(cookies).toBeDefined()

      // 檢查是否清除了所有相關的 Cookie
      const clearedCookies = ['theme', 'language', 'personalization', 'searchPreferences']
      clearedCookies.forEach((cookieName) => {
        const cookie = cookies.find((c) => c.includes(`${cookieName}=`))
        expect(cookie).toBeDefined()
        expect(cookie).toContain('Max-Age=0') // 清除 Cookie
      })
    })
  })
})
