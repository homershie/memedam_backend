import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  validateKofiWebhook,
  getKofiVerificationToken,
  getClientIP,
  getProductInfo,
  clearProcessedMessage,
} from '../../../middleware/kofiWebhookValidation.js'
import integratedCache from '../../../config/cache.js'
import { logger } from '../../../utils/logger.js'

// Mock 依賴
vi.mock('../../../config/cache.js')
vi.mock('../../../utils/logger.js')

describe('Ko-fi Webhook 驗證中間件單元測試', () => {
  let mockReq
  let mockRes
  let mockNext

  beforeEach(() => {
    vi.clearAllMocks()

    // 設置測試環境變數
    process.env.NODE_ENV = 'test'
    process.env.KOFI_VERIFICATION_TOKEN = 'test_token_123'

    // 初始化快取 mock
    vi.mocked(integratedCache.get).mockResolvedValue(null)
    vi.mocked(integratedCache.set).mockResolvedValue(true)
    vi.mocked(integratedCache.del).mockResolvedValue(true)

    // 設置測試用的記憶體快取
    global.testProcessedMessages = {}

    mockReq = {
      body: {},
      ip: '127.0.0.1',
      headers: {
        'x-forwarded-for': '192.168.1.100',
        'x-real-ip': '10.0.0.1',
        'cf-connecting-ip': '203.0.113.1',
      },
      connection: {
        remoteAddress: '172.16.0.1',
      },
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }

    mockNext = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete global.testProcessedMessages
  })

  describe('getKofiVerificationToken', () => {
    test('應該在測試環境中返回測試 token', () => {
      process.env.NODE_ENV = 'test'
      process.env.KOFI_VERIFICATION_TOKEN = ''

      const token = getKofiVerificationToken()

      expect(token).toBe('test_token')
    })

    test('應該返回環境變數中的 token', () => {
      process.env.NODE_ENV = 'production'
      process.env.KOFI_VERIFICATION_TOKEN = 'production_token_123'

      const token = getKofiVerificationToken()

      expect(token).toBe('production_token_123')
    })

    test('應該返回備用 token 當環境變數未設置', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.KOFI_VERIFICATION_TOKEN

      const token = getKofiVerificationToken()

      expect(token).toBe('fallback_token')
    })
  })

  describe('getClientIP', () => {
    test('應該優先使用 X-Forwarded-For 標頭', () => {
      const ip = getClientIP(mockReq)

      expect(ip).toBe('192.168.1.100')
    })

    test('應該使用 X-Real-IP 當 X-Forwarded-For 不存在', () => {
      const reqWithoutForwarded = {
        ...mockReq,
        headers: {
          ...mockReq.headers,
          'x-forwarded-for': undefined,
        },
      }

      const ip = getClientIP(reqWithoutForwarded)

      expect(ip).toBe('10.0.0.1')
    })

    test('應該使用 CF-Connecting-IP 當其他標頭都不存在', () => {
      const reqWithoutStandardHeaders = {
        ...mockReq,
        headers: {
          'cf-connecting-ip': '203.0.113.1',
        },
      }

      const ip = getClientIP(reqWithoutStandardHeaders)

      expect(ip).toBe('203.0.113.1')
    })

    test('應該回退到 req.ip', () => {
      const reqMinimal = {
        ip: '127.0.0.1',
        headers: {},
      }

      const ip = getClientIP(reqMinimal)

      expect(ip).toBe('127.0.0.1')
    })

    test('應該回退到 req.connection.remoteAddress', () => {
      const reqMinimal = {
        headers: {},
        connection: {
          remoteAddress: '172.16.0.1',
        },
      }

      const ip = getClientIP(reqMinimal)

      expect(ip).toBe('172.16.0.1')
    })

    test('應該返回 unknown 當沒有 IP 資訊', () => {
      const reqEmpty = {
        headers: {},
      }

      const ip = getClientIP(reqEmpty)

      expect(ip).toBe('unknown')
    })

    test('應該處理 X-Forwarded-For 的多個 IP', () => {
      const reqMultipleIPs = {
        ...mockReq,
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1',
        },
      }

      const ip = getClientIP(reqMultipleIPs)

      expect(ip).toBe('192.168.1.100')
    })
  })

  describe('getProductInfo', () => {
    test('應該返回豆漿贊助的產品資訊', () => {
      const info = getProductInfo('c4043b71a4')

      expect(info).toEqual({
        level: 'soy',
        amount: 1,
      })
    })

    test('應該返回雞肉贊助的產品資訊', () => {
      const info = getProductInfo('b7e4575bf6')

      expect(info).toEqual({
        level: 'chicken',
        amount: 2,
      })
    })

    test('應該返回咖啡贊助的產品資訊', () => {
      const info = getProductInfo('25678099a7')

      expect(info).toEqual({
        level: 'coffee',
        amount: 5,
      })
    })

    test('應該處理大小寫不敏感的商品代碼', () => {
      const info = getProductInfo('C4043B71A4')

      expect(info).toEqual({
        level: 'soy',
        amount: 1,
      })
    })

    test('應該返回 null 給未知的商品代碼', () => {
      const info = getProductInfo('unknown_code')

      expect(info).toBeNull()
    })

    test('應該處理 null 或 undefined 輸入', () => {
      expect(getProductInfo(null)).toBeNull()
      expect(getProductInfo(undefined)).toBeNull()
      expect(getProductInfo('')).toBeNull()
    })
  })

  describe('clearProcessedMessage', () => {
    test('應該成功清除處理過的訊息標記', async () => {
      const messageId = 'test_message_123'

      await clearProcessedMessage(messageId)

      expect(integratedCache.del).toHaveBeenCalledWith(`kofi:processed:${messageId}`)
      expect(logger.info).toHaveBeenCalledWith('清除 Ko-fi 訊息處理標記', { messageId })
    })

    test('應該處理空的 messageId', async () => {
      await clearProcessedMessage(null)

      expect(integratedCache.del).not.toHaveBeenCalled()
      expect(logger.info).not.toHaveBeenCalled()
    })

    test('應該處理 undefined messageId', async () => {
      await clearProcessedMessage(undefined)

      expect(integratedCache.del).not.toHaveBeenCalled()
      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('validateKofiWebhook 中間件', () => {
    test('應該成功驗證有效的 Webhook 請求', async () => {
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'valid_message_123',
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: '1.00',
        currency: 'USD',
      }

      mockReq.kofiData = {
        productInfo: { level: 'soy', amount: 1 },
        clientIP: '127.0.0.1',
        message_id: 'valid_message_123',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockReq.kofiData).toBeDefined()
      expect(mockReq.kofiData.productInfo.level).toBe('soy')
    })

    test('應該拒絕無效的請求類型', async () => {
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'invalid_type_123',
        type: 'Donation', // 不支援的類型
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '不支援的請求類型，僅支援 Shop Order',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該拒絕無效的驗證 token', async () => {
      mockReq.body = {
        verification_token: 'invalid_token',
        message_id: 'invalid_token_123',
        type: 'Shop Order',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '驗證令牌無效',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該拒絕不支援的商品代碼', async () => {
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'invalid_product_123',
        type: 'Shop Order',
        direct_link_code: 'INVALID_PRODUCT',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '不支援的商品代碼: INVALID_PRODUCT',
        supported_products: expect.any(Array),
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該拒絕缺少必要參數的請求', async () => {
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'missing_params_123',
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        // 缺少 kofi_transaction_id, from_name, amount, currency
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '缺少必要參數: kofi_transaction_id, from_name, amount, currency',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該拒絕無效的金額格式', async () => {
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'invalid_amount_123',
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: 'invalid_amount',
        currency: 'USD',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '無效的金額',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該處理重複的訊息 ID', async () => {
      const messageId = 'duplicate_message_123'

      // 第一次請求 - 應該通過
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: messageId,
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: '1.00',
        currency: 'USD',
      }

      // 模擬訊息已被處理
      global.testProcessedMessages = {}
      global.testProcessedMessages[`kofi:processed:${messageId}`] = true

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '訊息已處理',
        message_id: messageId,
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該在生產環境中檢查 IP 白名單', async () => {
      process.env.NODE_ENV = 'production'
      mockReq.ip = '192.168.1.1' // 不允許的 IP

      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'production_ip_test_123',
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: '1.00',
        currency: 'USD',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '來自不允許的來源 IP',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該在生產環境中允許白名單 IP', async () => {
      process.env.NODE_ENV = 'production'
      // 清除所有標頭，讓 getClientIP 回退到 req.ip
      mockReq.headers = {}
      mockReq.ip = '172.16.31.10' // 白名單 IP

      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'production_allowed_ip_123',
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: '1.00',
        currency: 'USD',
      }

      mockReq.kofiData = {
        productInfo: { level: 'soy', amount: 1 },
        clientIP: '172.16.31.10',
        message_id: 'production_allowed_ip_123',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    test('應該處理缺少 direct_link_code 的請求', async () => {
      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'no_product_code_123',
        type: 'Shop Order',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: '1.00',
        currency: 'USD',
        // 缺少 direct_link_code
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '缺少商品代碼 (direct_link_code)',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    test('應該處理快取操作失敗', async () => {
      // 臨時設置為生產環境來測試快取失敗
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      vi.mocked(integratedCache.get).mockRejectedValue(new Error('Cache error'))
      vi.mocked(logger.warn).mockImplementation(() => {})

      // 設置白名單IP以通過IP檢查
      mockReq.headers = {}
      mockReq.ip = '172.16.31.10' // 白名單IP

      mockReq.body = {
        verification_token: 'test_token_123',
        message_id: 'cache_error_123',
        type: 'Shop Order',
        direct_link_code: 'c4043b71a4',
        kofi_transaction_id: 'txn_123',
        from_name: 'Test User',
        amount: '1.00',
        currency: 'USD',
      }

      mockReq.kofiData = {
        productInfo: { level: 'soy', amount: 1 },
        clientIP: '172.16.31.10',
        message_id: 'cache_error_123',
      }

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      // 恢復原始環境
      process.env.NODE_ENV = originalNodeEnv

      expect(logger.warn).toHaveBeenCalled()
      expect(mockNext).toHaveBeenCalled() // 應該繼續處理，因為快取失敗不應該阻擋請求
    })

    test('應該處理驗證過程中的異常', async () => {
      // 模擬內部錯誤
      mockReq.body = null

      await validateKofiWebhook(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: '驗證過程發生錯誤',
      })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})
