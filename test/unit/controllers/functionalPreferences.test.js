import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  setTheme,
  setLanguage,
  setPersonalization,
  setSearchPreferences,
  getFunctionalPreferences,
  clearFunctionalPreferences,
  getPrivacyStatus,
} from '../../../controllers/userController.js'

// Mock dependencies
vi.mock('../../../models/User.js', () => ({
  default: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Functional Preferences Controller', () => {
  let req, res, User, logger

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks()

    // Import mocked modules
    const UserModule = await import('../../../models/User.js')
    const LoggerModule = await import('../../../utils/logger.js')

    User = UserModule.default
    logger = LoggerModule.logger

    // Setup request and response objects
    req = {
      body: {},
      user: { _id: 'user123' },
      cookies: {},
      skipFunctionalCookies: false,
      canUseFunctionalCookies: true,
      hasPrivacyConsent: true,
      canTrackAnalytics: true,
      canUseNecessaryCookies: true,
      privacyConsent: {
        necessary: true,
        functional: true,
        analytics: true,
        consentVersion: '1.0',
        consentSource: 'web',
        createdAt: new Date(),
      },
    }

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('setTheme', () => {
    it('應該成功設定主題偏好', async () => {
      req.body = { theme: 'dark' }

      const mockUpdatedUser = {
        _id: 'user123',
        functionalPreferences: {
          theme: 'dark',
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUpdatedUser),
      })

      await setTheme(req, res)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { 'functionalPreferences.theme': 'dark' },
        { new: true, runValidators: true },
      )
      expect(res.cookie).toHaveBeenCalledWith('theme', 'dark', {
        httpOnly: true,
        secure: false, // 非生產環境
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '主題偏好已儲存',
        data: { theme: 'dark' },
      })
    })

    it('應該拒絕無效的主題選項', async () => {
      req.body = { theme: 'invalid' }

      await setTheme(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '無效的主題選項',
        validOptions: ['light', 'dark', 'auto'],
      })
    })

    it('應該在功能 Cookie 被禁用時跳過設定', async () => {
      req.skipFunctionalCookies = true
      req.body = { theme: 'dark' }

      await setTheme(req, res)

      expect(logger.debug).toHaveBeenCalledWith('跳過主題設定：使用者未同意功能 Cookie')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '主題設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled',
      })
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
      expect(res.cookie).not.toHaveBeenCalled()
    })

    it('應該處理用戶不存在的情況', async () => {
      req.body = { theme: 'dark' }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      })

      await setTheme(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '用戶不存在',
      })
    })
  })

  describe('setLanguage', () => {
    it('應該成功設定語言偏好', async () => {
      req.body = { language: 'en-US' }

      const mockUpdatedUser = {
        _id: 'user123',
        functionalPreferences: {
          language: 'en-US',
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUpdatedUser),
      })

      await setLanguage(req, res)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { 'functionalPreferences.language': 'en-US' },
        { new: true, runValidators: true },
      )
      expect(res.cookie).toHaveBeenCalledWith('language', 'en-US', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '語言偏好已儲存',
        data: { language: 'en-US' },
      })
    })

    it('應該拒絕無效的語言選項', async () => {
      req.body = { language: 'invalid' }

      await setLanguage(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '無效的語言選項',
        validOptions: ['zh-TW', 'en-US', 'ja-JP'],
      })
    })
  })

  describe('setPersonalization', () => {
    it('應該成功設定個人化偏好', async () => {
      req.body = {
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

      const mockUpdatedUser = {
        _id: 'user123',
        functionalPreferences: {
          personalization: req.body,
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUpdatedUser),
      })

      await setPersonalization(req, res)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { 'functionalPreferences.personalization': req.body },
        { new: true, runValidators: true },
      )
      expect(res.cookie).toHaveBeenCalledWith('personalization', JSON.stringify(req.body), {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '個人化偏好已儲存',
        data: req.body,
      })
    })

    it('應該使用預設值當部分設定缺失時', async () => {
      req.body = { autoPlay: false }

      const expectedPersonalization = {
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

      const mockUpdatedUser = {
        _id: 'user123',
        functionalPreferences: {
          personalization: expectedPersonalization,
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUpdatedUser),
      })

      await setPersonalization(req, res)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { 'functionalPreferences.personalization': expectedPersonalization },
        { new: true, runValidators: true },
      )
    })
  })

  describe('setSearchPreferences', () => {
    it('應該成功設定搜尋偏好', async () => {
      req.body = {
        searchHistory: false,
        searchSuggestions: true,
        defaultSort: 'new',
        defaultFilter: 'sfw',
      }

      const mockUpdatedUser = {
        _id: 'user123',
        functionalPreferences: {
          searchPreferences: req.body,
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUpdatedUser),
      })

      await setSearchPreferences(req, res)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { 'functionalPreferences.searchPreferences': req.body },
        { new: true, runValidators: true },
      )
      expect(res.cookie).toHaveBeenCalledWith('searchPreferences', JSON.stringify(req.body), {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      })
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '搜尋偏好已儲存',
        data: req.body,
      })
    })

    it('應該拒絕無效的排序選項', async () => {
      req.body = { defaultSort: 'invalid' }

      await setSearchPreferences(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: '無效的排序選項',
        validOptions: ['hot', 'new', 'top', 'rising'],
      })
    })
  })

  describe('getFunctionalPreferences', () => {
    it('應該返回完整的偏好設定', async () => {
      const mockUser = {
        _id: 'user123',
        functionalPreferences: {
          theme: 'dark',
          language: 'en-US',
          personalization: {
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
          },
          searchPreferences: {
            searchHistory: false,
            searchSuggestions: true,
            defaultSort: 'new',
            defaultFilter: 'sfw',
          },
        },
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      await getFunctionalPreferences(req, res)

      expect(User.findById).toHaveBeenCalledWith('user123')
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser.functionalPreferences,
        functionalCookiesEnabled: true,
      })
    })

    it('應該合併 Cookie 和資料庫設定', async () => {
      req.cookies = {
        theme: 'light',
        language: 'ja-JP',
      }

      const mockUser = {
        _id: 'user123',
        functionalPreferences: {
          theme: 'dark',
          language: 'en-US',
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

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      await getFunctionalPreferences(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          theme: 'light', // 來自 Cookie
          language: 'ja-JP', // 來自 Cookie
          personalization: mockUser.functionalPreferences.personalization,
          searchPreferences: mockUser.functionalPreferences.searchPreferences,
        },
        functionalCookiesEnabled: true,
      })
    })

    it('應該在功能 Cookie 被禁用時返回預設值', async () => {
      req.skipFunctionalCookies = true
      req.canUseFunctionalCookies = false

      const mockUser = {
        _id: 'user123',
        functionalPreferences: {
          theme: 'dark',
          language: 'en-US',
        },
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      await getFunctionalPreferences(req, res)

      expect(res.json).toHaveBeenCalledWith({
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

  describe('clearFunctionalPreferences', () => {
    it('應該清除所有偏好設定', async () => {
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'user123' })

      await clearFunctionalPreferences(req, res)

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', {
        $unset: {
          'functionalPreferences.theme': 1,
          'functionalPreferences.language': 1,
          'functionalPreferences.personalization': 1,
          'functionalPreferences.searchPreferences': 1,
        },
      })

      // 檢查是否清除了所有 Cookie
      const expectedCookies = ['theme', 'language', 'personalization', 'searchPreferences']
      expectedCookies.forEach((cookieName) => {
        expect(res.clearCookie).toHaveBeenCalledWith(cookieName, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
        })
      })

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '所有功能偏好設定已清除',
        clearedCookies: expectedCookies,
      })
    })
  })

  describe('getPrivacyStatus', () => {
    it('應該返回完整的隱私設定狀態', async () => {
      await getPrivacyStatus(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          hasPrivacyConsent: true,
          canUseFunctionalCookies: true,
          canTrackAnalytics: true,
          canUseNecessaryCookies: true,
          currentConsent: {
            necessary: true,
            functional: true,
            analytics: true,
            consentVersion: '1.0',
            consentSource: 'web',
            createdAt: req.privacyConsent.createdAt,
          },
        },
      })
    })

    it('應該處理沒有隱私同意的情況', async () => {
      req.hasPrivacyConsent = false
      req.privacyConsent = null

      await getPrivacyStatus(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          hasPrivacyConsent: false,
          canUseFunctionalCookies: true,
          canTrackAnalytics: true,
          canUseNecessaryCookies: true,
          currentConsent: null,
        },
      })
    })
  })

  describe('錯誤處理', () => {
    it('應該處理資料庫錯誤', async () => {
      req.body = { theme: 'dark' }

      User.findByIdAndUpdate.mockRejectedValue(new Error('Database error'))

      await setTheme(req, res)

      expect(logger.error).toHaveBeenCalledWith('設定主題偏好失敗:', expect.any(Error))
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '設定主題偏好失敗',
      })
    })

    it('應該處理 JSON 解析錯誤', async () => {
      req.cookies = {
        personalization: 'invalid-json',
      }

      const mockUser = {
        _id: 'user123',
        functionalPreferences: {},
      }

      User.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      })

      await getFunctionalPreferences(req, res)

      expect(logger.error).toHaveBeenCalledWith('取得功能偏好設定失敗:', expect.any(Error))
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '取得功能偏好設定失敗',
      })
    })
  })

  describe('生產環境設定', () => {
    it('應該在生產環境中設定 secure cookie', async () => {
      // 模擬生產環境
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      req.body = { theme: 'dark' }

      const mockUpdatedUser = {
        _id: 'user123',
        functionalPreferences: {
          theme: 'dark',
        },
      }

      User.findByIdAndUpdate.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUpdatedUser),
      })

      await setTheme(req, res)

      expect(res.cookie).toHaveBeenCalledWith('theme', 'dark', {
        httpOnly: true,
        secure: true, // 生產環境中為 true
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      })

      // 恢復環境變數
      process.env.NODE_ENV = originalEnv
    })
  })
})
