import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import RecaptchaService from '../../../services/recaptchaService.js'

// Mock axios
vi.mock('axios')

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('RecaptchaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清除環境變數
    delete process.env.RECAPTCHA_SECRET_KEY
    delete process.env.RECAPTCHA_SITE_KEY
    delete process.env.NODE_ENV
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verify', () => {
    it('應該在沒有 SECRET_KEY 時返回 false (生產環境)', async () => {
      process.env.NODE_ENV = 'production'

      const result = await RecaptchaService.verify('test-token')

      expect(result).toBe(false)
    })

    it('應該在沒有 SECRET_KEY 時允許通過 (開發環境)', async () => {
      process.env.NODE_ENV = 'development'

      const result = await RecaptchaService.verify('test-token')

      expect(result).toBe(true)
    })

    it('應該在沒有 token 時返回 false (requireToken=true)', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'

      const result = await RecaptchaService.verify(null)

      expect(result).toBe(false)
    })

    it('應該在沒有 token 時允許通過 (requireToken=false)', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'

      const result = await RecaptchaService.verify(null, { requireToken: false })

      expect(result).toBe(true)
    })

    it('應該成功驗證有效的 token', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'

      // Mock axios response
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.8,
        },
      })

      const result = await RecaptchaService.verify('valid-token')

      expect(result).toBe(true)
      expect(axios.post).toHaveBeenCalledWith(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: 'test-secret',
            response: 'valid-token',
          },
          timeout: 10000,
        },
      )
    })

    it('應該在 API 失敗時返回 false', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'

      // Mock axios response
      axios.post.mockResolvedValue({
        data: {
          success: false,
          'error-codes': ['invalid-input-secret'],
        },
      })

      const result = await RecaptchaService.verify('invalid-token')

      expect(result).toBe(false)
    })

    it('應該在網路錯誤時返回 false (生產環境)', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'
      process.env.NODE_ENV = 'production'

      // Mock axios error
      axios.post.mockRejectedValue(new Error('Network error'))

      const result = await RecaptchaService.verify('test-token')

      expect(result).toBe(false)
    })

    it('應該在網路錯誤時允許通過 (開發環境)', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'
      process.env.NODE_ENV = 'development'

      // Mock axios error
      axios.post.mockRejectedValue(new Error('Network error'))

      const result = await RecaptchaService.verify('test-token')

      expect(result).toBe(true)
    })

    it('應該檢查 v3 分數', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'

      // Mock axios response with low score
      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.3,
        },
      })

      const result = await RecaptchaService.verify('test-token', { minScore: 0.5 })

      expect(result).toBe(false)
    })
  })

  describe('quickVerify', () => {
    it('應該使用預設設定進行驗證', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'

      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.8,
        },
      })

      const result = await RecaptchaService.quickVerify('test-token')

      expect(result).toBe(true)
    })
  })

  describe('strictVerify', () => {
    it('應該使用嚴格設定進行驗證', async () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'
      process.env.NODE_ENV = 'development'

      axios.post.mockResolvedValue({
        data: {
          success: true,
          score: 0.8,
        },
      })

      const result = await RecaptchaService.strictVerify('test-token', 0.7)

      expect(result).toBe(true)
    })

    it('應該在開發環境中仍然要求驗證', async () => {
      process.env.NODE_ENV = 'development'

      const result = await RecaptchaService.strictVerify('test-token')

      expect(result).toBe(false)
    })
  })

  describe('lenientVerify', () => {
    it('應該允許開發環境通過且不要求 token', async () => {
      process.env.NODE_ENV = 'development'

      const result = await RecaptchaService.lenientVerify(null)

      expect(result).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('應該返回正確的設定狀態', () => {
      process.env.RECAPTCHA_SECRET_KEY = 'test-secret'
      process.env.RECAPTCHA_SITE_KEY = 'test-site-key'
      process.env.NODE_ENV = 'test'

      const status = RecaptchaService.getStatus()

      expect(status).toEqual({
        hasSecretKey: true,
        hasSiteKey: true,
        environment: 'test',
        timestamp: expect.any(String),
      })
    })

    it('應該在沒有設定時返回正確狀態', () => {
      const status = RecaptchaService.getStatus()

      expect(status).toEqual({
        hasSecretKey: false,
        hasSiteKey: false,
        environment: 'development',
        timestamp: expect.any(String),
      })
    })
  })
})
