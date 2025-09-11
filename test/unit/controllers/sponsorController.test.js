import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  createSponsor,
  getSponsors,
  getSponsorById,
  updateSponsor,
  deleteSponsor,
  handleBuyMeACoffeeCallback,
  getSponsorByTransactionId,
  logSponsorPageAccess,
  getSupportedCurrencies,
  convertCurrency,
  getExchangeRateCacheStats,
  clearExchangeRateCache,
  updateExchangeRate,
} from '../../../controllers/sponsorController.js'
import Sponsor from '../../../models/Sponsor.js'
import kofiService from '../../../services/kofiService.js'
import exchangeRateService from '../../../services/exchangeRateService.js'

// Mock 依賴
vi.mock('../../../models/Sponsor.js')
vi.mock('../../../utils/logger.js')
vi.mock('../../../services/kofiService.js')
vi.mock('../../../services/exchangeRateService.js')

describe('贊助控制器單元測試', () => {
  let mockReq
  let mockRes
  let mockSession

  beforeEach(() => {
    vi.clearAllMocks()

    // 設置測試環境
    process.env.NODE_ENV = 'test'

    // Mock session
    mockSession = {
      startTransaction: vi.fn().mockResolvedValue(),
      commitTransaction: vi.fn().mockResolvedValue(),
      abortTransaction: vi.fn().mockResolvedValue(),
      endSession: vi.fn().mockResolvedValue(),
    }

    // Mock mongoose startSession
    vi.mocked(Sponsor.startSession).mockResolvedValue(mockSession)

    mockReq = {
      body: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      headers: {},
      user: {
        _id: 'user_123',
        role: 'user',
      },
      kofiData: {
        productInfo: { level: 'soy', amount: 1 },
        clientIP: '127.0.0.1',
      },
    }

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createSponsor', () => {
    test('應該成功建立贊助', async () => {
      const sponsorData = {
        user_id: 'user_123',
        amount: 100,
        message: '測試贊助',
      }

      const mockSponsor = {
        _id: 'sponsor_123',
        ...sponsorData,
        created_ip: '127.0.0.1',
      }

      mockReq.body = sponsorData
      const mockSponsorInstance = {
        ...mockSponsor,
        save: vi.fn().mockResolvedValue({
          _id: 'sponsor_123',
          user_id: 'user_123',
          amount: 100,
          message: '測試贊助',
          created_ip: '127.0.0.1',
        }),
      }
      vi.mocked(Sponsor).mockImplementation(() => mockSponsorInstance)

      await createSponsor(mockReq, mockRes)

      expect(Sponsor).toHaveBeenCalledWith({
        ...sponsorData,
        created_ip: '127.0.0.1',
      })
      expect(mockSession.commitTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(201)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'sponsor_123',
          user_id: 'user_123',
          amount: 100,
          message: '測試贊助',
          created_ip: '127.0.0.1',
        }),
        error: null,
      })
    })

    test('應該處理重複鍵錯誤', async () => {
      const duplicateError = new Error('Duplicate key error')
      duplicateError.code = 11000

      mockReq.body = { user_id: 'user_123', amount: 100 }
      vi.mocked(Sponsor).mockImplementation(() => ({
        save: vi.fn().mockRejectedValue(duplicateError),
      }))

      await createSponsor(mockReq, mockRes)

      expect(mockSession.abortTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '贊助記錄重複，請檢查是否已存在相同記錄',
      })
    })

    test('應該處理驗證錯誤', async () => {
      const validationError = new Error('Validation failed')
      validationError.name = 'ValidationError'

      mockReq.body = { amount: 'invalid' }
      vi.mocked(Sponsor).mockImplementation(() => ({
        save: vi.fn().mockRejectedValue(validationError),
      }))

      await createSponsor(mockReq, mockRes)

      expect(mockSession.abortTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: 'Validation failed',
      })
    })

    test('應該處理一般錯誤', async () => {
      const generalError = new Error('Database error')

      mockReq.body = { amount: 100 }
      vi.mocked(Sponsor).mockImplementation(() => ({
        save: vi.fn().mockRejectedValue(generalError),
      }))

      await createSponsor(mockReq, mockRes)

      expect(mockSession.abortTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: 'Database error',
      })
    })
  })

  describe('getSponsors', () => {
    test('應該成功取得贊助列表', async () => {
      const mockSponsors = [
        { _id: 'sponsor_1', amount: 100, user_id: { username: 'user1', display_name: 'User1' } },
        { _id: 'sponsor_2', amount: 200, user_id: { username: 'user2', display_name: 'User2' } },
      ]

      const mockQuery = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockSponsors),
      }

      vi.mocked(Sponsor.find).mockReturnValue(mockQuery)
      vi.mocked(Sponsor.countDocuments).mockResolvedValue(2)

      await getSponsors(mockReq, mockRes)

      expect(Sponsor.find).toHaveBeenCalledWith({})
      expect(mockQuery.populate).toHaveBeenCalledWith('user_id', 'username display_name avatar')
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 })
      expect(mockQuery.skip).toHaveBeenCalledWith(0)
      expect(mockQuery.limit).toHaveBeenCalledWith(20)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSponsors,
        error: null,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1,
        },
      })
    })

    test('應該處理查詢參數', async () => {
      mockReq.query = {
        user_id: 'user_123',
        status: 'success',
        q: '測試',
        min_amount: '50',
        max_amount: '500',
        page: '2',
        limit: '10',
        sort_by: 'amount',
        sort_dir: 'asc',
      }

      const mockQuery = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }

      vi.mocked(Sponsor.find).mockReturnValue(mockQuery)
      vi.mocked(Sponsor.countDocuments).mockResolvedValue(0)

      await getSponsors(mockReq, mockRes)

      expect(Sponsor.find).toHaveBeenCalledWith({
        user_id: 'user_123',
        status: 'success',
        message: expect.any(RegExp),
        amount: { $gte: 50, $lte: 500 },
      })
      expect(mockQuery.sort).toHaveBeenCalledWith({ amount: 1 })
      expect(mockQuery.skip).toHaveBeenCalledWith(10)
      expect(mockQuery.limit).toHaveBeenCalledWith(10)
    })

    test('應該處理查詢錯誤', async () => {
      const queryError = new Error('Query failed')
      const mockQuery = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(queryError),
      }

      vi.mocked(Sponsor.find).mockReturnValue(mockQuery)

      await getSponsors(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: 'Query failed',
      })
    })
  })

  describe('getSponsorById', () => {
    test('應該成功取得單一贊助', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        user_id: { _id: 'user_123', username: 'testuser', display_name: 'TestUser' },
        amount: 100,
      }

      mockReq.params.id = 'sponsor_123'
      vi.mocked(Sponsor.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockSponsor),
      })

      await getSponsorById(mockReq, mockRes)

      expect(Sponsor.findById).toHaveBeenCalledWith('sponsor_123')
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSponsor,
        error: null,
      })
    })

    test('應該返回 404 當贊助不存在', async () => {
      mockReq.params.id = 'nonexistent_id'
      vi.mocked(Sponsor.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      })

      await getSponsorById(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到贊助',
      })
    })

    test('應該拒絕無權限的用戶', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        user_id: { _id: 'different_user', username: 'otheruser', display_name: 'OtherUser' },
        amount: 100,
      }

      mockReq.params.id = 'sponsor_123'
      mockReq.user._id = 'current_user'
      mockReq.user.role = 'user'
      vi.mocked(Sponsor.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockSponsor),
      })

      await getSponsorById(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '無權限查詢此贊助',
      })
    })

    test('應該允許管理員查詢任何贊助', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        user_id: { _id: 'different_user', username: 'otheruser', display_name: 'OtherUser' },
        amount: 100,
      }

      mockReq.params.id = 'sponsor_123'
      mockReq.user.role = 'admin'
      vi.mocked(Sponsor.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockSponsor),
      })

      await getSponsorById(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSponsor,
        error: null,
      })
    })
  })

  describe('updateSponsor', () => {
    test('應該成功更新贊助', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        user_id: 'user_123',
        amount: 100,
        save: vi.fn().mockResolvedValue(),
      }

      mockReq.params.id = 'sponsor_123'
      mockReq.body = { amount: 150, message: '更新訊息' }
      vi.mocked(Sponsor.findById).mockReturnValue({
        session: vi.fn().mockResolvedValue(mockSponsor),
      })

      await updateSponsor(mockReq, mockRes)

      expect(Sponsor.findById).toHaveBeenCalledWith('sponsor_123')
      expect(mockSponsor.save).toHaveBeenCalled()
      expect(mockSession.commitTransaction).toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSponsor,
        error: null,
      })
    })

    test('應該返回 404 當贊助不存在', async () => {
      mockReq.params.id = 'nonexistent_id'
      vi.mocked(Sponsor.findById).mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      })

      await updateSponsor(mockReq, mockRes)

      expect(mockSession.abortTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到贊助',
      })
    })

    test('應該拒絕無權限的用戶更新', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        user_id: 'different_user',
      }

      mockReq.params.id = 'sponsor_123'
      mockReq.user._id = 'current_user'
      mockReq.user.role = 'user'
      vi.mocked(Sponsor.findById).mockReturnValue({
        session: vi.fn().mockResolvedValue(mockSponsor),
      })

      await updateSponsor(mockReq, mockRes)

      expect(mockSession.abortTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '無權限修改此贊助',
      })
    })
  })

  describe('deleteSponsor', () => {
    test('應該成功刪除贊助', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        user_id: 'user_123',
        deleteOne: vi.fn().mockResolvedValue(),
      }

      mockReq.params.id = 'sponsor_123'
      vi.mocked(Sponsor.findById).mockReturnValue({
        session: vi.fn().mockResolvedValue(mockSponsor),
      })

      await deleteSponsor(mockReq, mockRes)

      expect(mockSponsor.deleteOne).toHaveBeenCalled()
      expect(mockSession.commitTransaction).toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        error: null,
        message: '贊助已刪除',
      })
    })

    test('應該返回 404 當贊助不存在', async () => {
      mockReq.params.id = 'nonexistent_id'
      vi.mocked(Sponsor.findById).mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      })

      await deleteSponsor(mockReq, mockRes)

      expect(mockSession.abortTransaction).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到贊助',
      })
    })
  })

  describe('handleBuyMeACoffeeCallback', () => {
    test('應該成功處理 Buy Me a Coffee 回調', async () => {
      const callbackData = {
        transaction_id: 'bmc_txn_123',
        amount: '50.00',
        message: '感謝支持',
        user_id: 'user_123',
      }

      const mockSponsor = {
        _id: 'sponsor_123',
        ...callbackData,
        amount: 50.0,
        save: vi.fn().mockResolvedValue(),
      }

      mockReq.body = callbackData
      vi.mocked(Sponsor.findOne).mockResolvedValue(null)
      vi.mocked(Sponsor).mockImplementation(() => mockSponsor)

      await handleBuyMeACoffeeCallback(mockReq, mockRes)

      expect(Sponsor.findOne).toHaveBeenCalledWith({ transaction_id: 'bmc_txn_123' })
      expect(mockSponsor.save).toHaveBeenCalled()
      expect(mockRes.redirect).toHaveBeenCalledWith('/sponsor/success?transaction_id=bmc_txn_123')
    })

    test('應該拒絕重複的交易 ID', async () => {
      const existingSponsor = { _id: 'existing_sponsor', transaction_id: 'bmc_txn_123' }

      mockReq.body = {
        transaction_id: 'bmc_txn_123',
        amount: '50.00',
        user_id: 'user_123',
      }

      vi.mocked(Sponsor.findOne).mockResolvedValue(existingSponsor)

      await handleBuyMeACoffeeCallback(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(409)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '此交易已存在',
      })
    })

    test('應該處理缺少必要參數的情況', async () => {
      mockReq.body = {
        transaction_id: 'bmc_txn_123',
        // 缺少 amount 和 user_id
      }

      await handleBuyMeACoffeeCallback(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '缺少必要參數',
      })
    })
  })

  describe('getSponsorByTransactionId', () => {
    test('應該成功根據交易ID取得贊助資訊', async () => {
      const mockSponsor = {
        _id: 'sponsor_123',
        transaction_id: 'txn_123',
        amount: 100,
        user_id: { username: 'testuser', display_name: 'TestUser' },
      }

      mockReq.params.transaction_id = 'txn_123'
      vi.mocked(Sponsor.findOne).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockSponsor),
      })

      await getSponsorByTransactionId(mockReq, mockRes)

      expect(Sponsor.findOne).toHaveBeenCalledWith({ transaction_id: 'txn_123' })
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSponsor,
        error: null,
      })
    })

    test('應該返回 404 當交易記錄不存在', async () => {
      mockReq.params.transaction_id = 'nonexistent_txn'
      vi.mocked(Sponsor.findOne).mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      })

      await getSponsorByTransactionId(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '找不到此交易記錄',
      })
    })

    test('應該處理缺少交易ID的請求', async () => {
      mockReq.params.transaction_id = ''

      await getSponsorByTransactionId(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '缺少交易ID',
      })
    })
  })

  describe('logSponsorPageAccess', () => {
    test('應該成功記錄贊助頁面訪問', async () => {
      const accessData = {
        pageType: 'success',
        transactionId: 'txn_123',
        message: '頁面訪問測試',
        userAgent: 'Test Browser',
        referrer: 'https://example.com',
      }

      mockReq.body = accessData

      await logSponsorPageAccess(mockReq, mockRes)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '訪問記錄已記錄',
        error: null,
      })
    })

    test('應該處理錯誤情況', async () => {
      // 模擬某種錯誤情況
      mockReq.body = null

      await logSponsorPageAccess(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: expect.any(String),
      })
    })
  })

  describe('getSupportedCurrencies', () => {
    test('應該成功取得支援的幣別列表', async () => {
      const mockCurrencies = ['USD', 'TWD', 'EUR']
      vi.mocked(kofiService.getSupportedCurrencies).mockReturnValue(mockCurrencies)

      await getSupportedCurrencies(mockReq, mockRes)

      expect(kofiService.getSupportedCurrencies).toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        error: null,
      })
    })
  })

  describe('convertCurrency', () => {
    test('應該成功進行幣別轉換', async () => {
      const conversionData = {
        amount: 100,
        from_currency: 'USD',
        to_currency: 'TWD',
      }

      const mockResult = {
        success: true,
        converted_amount: 3100,
        exchange_rate: 31,
      }

      mockReq.body = conversionData
      vi.mocked(kofiService.convertCurrency).mockReturnValue(mockResult)
      vi.mocked(kofiService.formatCurrency).mockReturnValue('$100.00')

      await convertCurrency(mockReq, mockRes)

      expect(kofiService.convertCurrency).toHaveBeenCalledWith(100, 'USD', 'TWD')
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          conversion: mockResult,
          formatted_original: expect.any(String),
          formatted_converted: expect.any(String),
        },
        error: null,
      })
    })

    test('應該處理轉換失敗的情況', async () => {
      const conversionData = {
        amount: 100,
        from_currency: 'USD',
        to_currency: 'INVALID',
      }

      mockReq.body = conversionData
      vi.mocked(kofiService.convertCurrency).mockReturnValue({
        success: false,
        error: '不支援的幣別',
      })

      await convertCurrency(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '不支援的幣別',
      })
    })

    test('應該處理缺少參數的情況', async () => {
      mockReq.body = { amount: 100 } // 缺少 from_currency 和 to_currency

      await convertCurrency(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '缺少必要參數：amount, from_currency, to_currency',
      })
    })
  })

  describe('getExchangeRateCacheStats', () => {
    test('應該成功取得匯率快取統計', async () => {
      const mockStats = {
        total_entries: 10,
        cache_size: '2.5MB',
        last_updated: new Date().toISOString(),
      }

      vi.mocked(exchangeRateService.getCacheStats).mockResolvedValue(mockStats)

      await getExchangeRateCacheStats(mockReq, mockRes)

      expect(exchangeRateService.getCacheStats).toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
        error: null,
      })
    })
  })

  describe('clearExchangeRateCache', () => {
    test('應該成功清除特定幣別對的快取', async () => {
      mockReq.query = { from: 'USD', to: 'TWD' }

      vi.mocked(exchangeRateService.clearCache).mockResolvedValue(true)

      await clearExchangeRateCache(mockReq, mockRes)

      expect(exchangeRateService.clearCache).toHaveBeenCalledWith('USD', 'TWD')
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '已清除 USD/TWD 匯率快取',
        error: null,
      })
    })

    test('應該成功清除所有匯率快取', async () => {
      mockReq.query = {}

      vi.mocked(exchangeRateService.clearAllCache).mockResolvedValue(true)

      await clearExchangeRateCache(mockReq, mockRes)

      expect(exchangeRateService.clearAllCache).toHaveBeenCalled()
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '已清除所有匯率快取',
        error: null,
      })
    })

    test('應該處理清除快取失敗的情況', async () => {
      mockReq.query = { from: 'USD', to: 'TWD' }

      vi.mocked(exchangeRateService.clearCache).mockResolvedValue(false)

      await clearExchangeRateCache(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '清除快取失敗',
        error: null,
      })
    })
  })

  describe('updateExchangeRate', () => {
    test('應該成功更新匯率', async () => {
      mockReq.params = { from: 'USD', to: 'TWD' }
      mockReq.body = { rate: 31.5, ttl: 3600 }

      vi.mocked(exchangeRateService.updateExchangeRate).mockResolvedValue(true)

      await updateExchangeRate(mockReq, mockRes)

      expect(exchangeRateService.updateExchangeRate).toHaveBeenCalledWith('USD', 'TWD', 31.5, 3600)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '已更新 USD/TWD 匯率為 31.5',
        data: expect.any(Object),
        error: null,
      })
    })

    test('應該拒絕無效的匯率值', async () => {
      mockReq.params = { from: 'USD', to: 'TWD' }
      mockReq.body = { rate: 0 } // 無效的匯率

      await updateExchangeRate(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: '請提供有效的匯率值',
      })
    })

    test('應該處理更新失敗的情況', async () => {
      mockReq.params = { from: 'USD', to: 'TWD' }
      mockReq.body = { rate: 31.5 }

      vi.mocked(exchangeRateService.updateExchangeRate).mockResolvedValue(false)

      await updateExchangeRate(mockReq, mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: '更新匯率失敗',
        error: null,
      })
    })
  })
})
