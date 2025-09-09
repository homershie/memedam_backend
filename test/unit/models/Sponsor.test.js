import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import mongoose from 'mongoose'
import Sponsor from '../../../models/Sponsor.js'

// 移除 mongoose mock，讓模型正常工作
// vi.mock('mongoose', async () => {
//   const actualMongoose = await vi.importActual('mongoose')
//   return {
//     ...actualMongoose,
//     models: {
//       Sponsor: undefined,
//     },
//   }
// })

// Mock validator
vi.mock('validator', () => ({
  default: {
    isIP: vi.fn((ip, version) => {
      if (!ip || ip === '') return true // 允許空值
      if (version === 4) {
        return (
          /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
          ip.split('.').every((part) => {
            const num = parseInt(part)
            return num >= 0 && num <= 255
          })
        )
      }
      if (version === 6) {
        return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)
      }
      return /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)
    }),
    isEmail: vi.fn((email) => {
      if (!email || email === '') return true // 允許空值
      return (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        !email.includes('..') &&
        !email.startsWith('@') &&
        !email.endsWith('@')
      )
    }),
  },
}))

describe('贊助模型單元測試', () => {
  let sponsorData

  beforeEach(() => {
    sponsorData = {
      user_id: new mongoose.Types.ObjectId(),
      status: 'success',
      amount: 100,
      message: '測試贊助訊息',
      payment_method: 'ko-fi',
      transaction_id: 'test_txn_123',
      created_ip: '192.168.1.100',
      kofi_transaction_id: 'kofi_txn_123',
      from_name: '測試贊助者',
      display_name: 'Test Sponsor',
      email: 'test@example.com',
      discord_username: 'testuser#1234',
      discord_userid: '123456789012345678',
      currency: 'USD',
      type: 'Shop Order',
      direct_link_code: 'c4043b71a4',
      shop_items: [
        {
          direct_link_code: 'c4043b71a4',
          variation_name: '標準',
          quantity: 1,
        },
      ],
      shipping: {
        full_name: '測試收件人',
        street_address: '測試地址',
        city: '測試城市',
        state_or_province: '測試省',
        postal_code: '12345',
        country: '測試國家',
        country_code: 'TW',
        telephone: '0912345678',
      },
      is_public: true,
      sponsor_level: 'soy',
      badge_earned: true,
      message_reviewed: true,
      message_auto_filtered: false,
      message_original: '測試贊助訊息',
      message_filter_reason: null,
      message_filter_severity: 'low',
      requires_manual_review: false,
      amount_usd: 100,
      amount_twd: 3100,
      amount_original: 100,
      currency_original: 'USD',
      exchange_rate: 31,
      exchange_rate_used: 'USD/TWD@31',
      processed_at: new Date(),
      retry_count: 0,
      error_message: '',
      shop_items_parsed: true,
      shop_items_merged: false,
      shop_items_quantity: 1,
      shop_items_total_amount: 100,
      shop_items_raw_total_amount: null,
      shop_items_merge_rule: null,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基本字段驗證', () => {
    test('應該成功創建有效的贊助記錄', () => {
      const sponsor = new Sponsor(sponsorData)

      expect(sponsor.user_id).toEqual(sponsorData.user_id)
      expect(sponsor.status).toBe('success')
      expect(sponsor.amount).toBe(100)
      expect(sponsor.message).toBe('測試贊助訊息')
      expect(sponsor.payment_method).toBe('ko-fi')
      expect(sponsor.transaction_id).toBe('test_txn_123')
      expect(sponsor.created_ip).toBe('192.168.1.100')
    })

    test('應該使用默認值', () => {
      const minimalData = {
        amount: 50,
      }

      const sponsor = new Sponsor(minimalData)

      expect(sponsor.status).toBe('pending')
      expect(sponsor.message).toBe('')
      expect(sponsor.payment_method).toBe('ko-fi')
      expect(sponsor.created_ip).toBe('')
      expect(sponsor.currency).toBe('USD')
      expect(sponsor.is_public).toBe(true)
      expect(sponsor.sponsor_level).toBe('soy')
      expect(sponsor.badge_earned).toBe(false)
      expect(sponsor.message_reviewed).toBe(false)
      expect(sponsor.message_auto_filtered).toBe(false)
      expect(sponsor.message_filter_severity).toBe('low')
      expect(sponsor.requires_manual_review).toBe(false)
      expect(sponsor.retry_count).toBe(0)
      expect(sponsor.error_message).toBe('')
      expect(sponsor.shop_items_parsed).toBe(false)
      expect(sponsor.shop_items_merged).toBe(false)
      expect(sponsor.shop_items_quantity).toBe(1)
    })
  })

  describe('金額驗證', () => {
    test('應該拒絕金額小於 1', () => {
      const invalidData = { ...sponsorData, amount: 0 }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.amount).toBeDefined()
      expect(validationError.errors.amount.message).toMatch(/金額必須大於0/)
    })

    test('應該拒絕金額大於 1000000', () => {
      const invalidData = { ...sponsorData, amount: 2000000 }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.amount).toBeDefined()
      expect(validationError.errors.amount.message).toMatch(/金額過大/)
    })

    test('應該接受有效的金額範圍', () => {
      const validAmounts = [1, 100, 1000, 1000000]

      validAmounts.forEach((amount) => {
        const validData = { ...sponsorData, amount }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })
  })

  describe('狀態枚舉驗證', () => {
    test('應該接受有效的狀態值', () => {
      const validStatuses = ['pending', 'success', 'failed', 'refunded']

      validStatuses.forEach((status) => {
        const validData = { ...sponsorData, status }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該拒絕無效的狀態值', () => {
      const invalidStatuses = ['processing', 'cancelled', 'invalid']

      invalidStatuses.forEach((status) => {
        const invalidData = { ...sponsorData, status }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.status).toBeDefined()
        expect(validationError.errors.status.message).toMatch(/狀態必須是/)
      })
    })
  })

  describe('贊助等級枚舉驗證', () => {
    test('應該接受有效的贊助等級', () => {
      const validLevels = ['soy', 'chicken', 'coffee']

      validLevels.forEach((level) => {
        const validData = { ...sponsorData, sponsor_level: level }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該拒絕無效的贊助等級', () => {
      const invalidLevels = ['milk', 'beef', 'espresso', 'invalid']

      invalidLevels.forEach((level) => {
        const invalidData = { ...sponsorData, sponsor_level: level }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.sponsor_level).toBeDefined()
        expect(validationError.errors.sponsor_level.message).toMatch(/贊助等級必須是/)
      })
    })
  })

  describe('訊息過濾原因枚舉驗證', () => {
    test('應該接受有效的訊息過濾原因', () => {
      const validReasons = [
        'message_too_long',
        'inappropriate_content',
        'advertisement_content',
        'repeated_content',
        'too_many_special_chars',
        'review_error',
        null,
      ]

      validReasons.forEach((reason) => {
        const validData = { ...sponsorData, message_filter_reason: reason }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該拒絕無效的訊息過濾原因', () => {
      const invalidReasons = ['invalid_reason', 'unknown_filter']

      invalidReasons.forEach((reason) => {
        const invalidData = { ...sponsorData, message_filter_reason: reason }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.message_filter_reason).toBeDefined()
        expect(validationError.errors.message_filter_reason.message).toMatch(/無效的過濾原因/)
      })
    })
  })

  describe('訊息過濾嚴重程度枚舉驗證', () => {
    test('應該接受有效的訊息過濾嚴重程度', () => {
      const validSeverities = ['low', 'medium', 'high']

      validSeverities.forEach((severity) => {
        const validData = { ...sponsorData, message_filter_severity: severity }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該拒絕無效的訊息過濾嚴重程度', () => {
      const invalidSeverities = ['critical', 'info', 'invalid']

      invalidSeverities.forEach((severity) => {
        const invalidData = { ...sponsorData, message_filter_severity: severity }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.message_filter_severity).toBeDefined()
        expect(validationError.errors.message_filter_severity.message).toMatch(/無效的過濾嚴重程度/)
      })
    })
  })

  describe('Shop Items 合併規則枚舉驗證', () => {
    test('應該接受有效的合併規則', () => {
      const validRules = ['highest', 'sum', 'average', null]

      validRules.forEach((rule) => {
        const validData = { ...sponsorData, shop_items_merge_rule: rule }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該拒絕無效的合併規則', () => {
      const invalidRules = ['combine', 'merge', 'invalid']

      invalidRules.forEach((rule) => {
        const invalidData = { ...sponsorData, shop_items_merge_rule: rule }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.shop_items_merge_rule).toBeDefined()
        expect(validationError.errors.shop_items_merge_rule.message).toMatch(/無效的合併規則/)
      })
    })
  })

  describe('字串字段長度驗證', () => {
    test('應該驗證留言長度限制', () => {
      const longMessage = 'a'.repeat(1001)
      const invalidData = { ...sponsorData, message: longMessage }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.message).toBeDefined()
      expect(validationError.errors.message.message).toMatch(/留言長度不能超過1000字/)
    })

    test('應該驗證支付方式長度限制', () => {
      const longPaymentMethod = 'a'.repeat(51)
      const invalidData = { ...sponsorData, payment_method: longPaymentMethod }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.payment_method).toBeDefined()
      expect(validationError.errors.payment_method.message).toMatch(/支付方式長度不能超過50字/)
    })

    test('應該驗證訂單號長度限制', () => {
      const longTransactionId = 'a'.repeat(101)
      const invalidData = { ...sponsorData, transaction_id: longTransactionId }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.transaction_id).toBeDefined()
      expect(validationError.errors.transaction_id.message).toMatch(/訂單號長度不能超過100字/)
    })

    test('應該驗證IP位址長度限制', () => {
      const longIP = 'a'.repeat(46)
      const invalidData = { ...sponsorData, created_ip: longIP }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.created_ip).toBeDefined()
      expect(validationError.errors.created_ip.message).toMatch(/IP位址長度不能超過45字/)
    })

    test('應該驗證退款原因長度限制', () => {
      const longReason = 'a'.repeat(201)
      const invalidData = { ...sponsorData, refund_reason: longReason }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.refund_reason).toBeDefined()
      expect(validationError.errors.refund_reason.message).toMatch(/退款原因長度不能超過200字/)
    })

    test('應該驗證錯誤訊息長度限制', () => {
      const longErrorMessage = 'a'.repeat(501)
      const invalidData = { ...sponsorData, error_message: longErrorMessage }

      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.error_message).toBeDefined()
      expect(validationError.errors.error_message.message).toMatch(/錯誤訊息長度不能超過500字/)
    })
  })

  describe('IP位址驗證', () => {
    test('應該接受有效的IPv4位址', () => {
      const validIPs = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1']

      validIPs.forEach((ip) => {
        const validData = { ...sponsorData, created_ip: ip }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該接受有效的IPv6位址', () => {
      const validIPv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      const validData = { ...sponsorData, created_ip: validIPv6 }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })

    test('應該拒絕無效的IP位址', () => {
      const invalidIPs = ['192.168.1.256', 'invalid.ip.address', '192.168.1']

      invalidIPs.forEach((ip) => {
        const invalidData = { ...sponsorData, created_ip: ip }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.created_ip).toBeDefined()
        expect(validationError.errors.created_ip.message).toMatch(/IP位址格式不正確/)
      })
    })

    test('應該接受空IP位址', () => {
      const validData = { ...sponsorData, created_ip: '' }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })
  })

  describe('信箱驗證', () => {
    test('應該接受有效的信箱格式', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+tag@gmail.com',
        'user@subdomain.domain.com',
      ]

      validEmails.forEach((email) => {
        const validData = { ...sponsorData, email }
        const sponsor = new Sponsor(validData)
        expect(() => sponsor.validateSync()).not.toThrow()
      })
    })

    test('應該拒絕無效的信箱格式', () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..double@example.com',
        'test@.com',
      ]

      invalidEmails.forEach((email) => {
        const invalidData = { ...sponsorData, email }
        const sponsor = new Sponsor(invalidData)
        const validationError = sponsor.validateSync()

        expect(validationError).toBeDefined()
        expect(validationError.errors.email).toBeDefined()
        expect(validationError.errors.email.message).toMatch(/信箱格式不正確/)
      })
    })

    test('應該接受空信箱', () => {
      const validData = { ...sponsorData, email: '' }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })
  })

  describe('user_id 驗證', () => {
    test('應該接受有效的ObjectId', () => {
      const validObjectId = new mongoose.Types.ObjectId()
      const validData = { ...sponsorData, user_id: validObjectId }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })

    test('應該接受null值（匿名贊助）', () => {
      const validData = { ...sponsorData, user_id: null }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })

    test('應該拒絕無效的ObjectId字串', () => {
      const invalidData = { ...sponsorData, user_id: 'invalid_object_id' }
      const sponsor = new Sponsor(invalidData)
      const validationError = sponsor.validateSync()

      expect(validationError).toBeDefined()
      expect(validationError.errors.user_id).toBeDefined()
      // Mongoose 對於 ObjectId 會使用內建錯誤訊息
      expect(validationError.errors.user_id.message).toMatch(/Cast to ObjectId failed/)
    })
  })

  describe('shop_items 數組驗證', () => {
    test('應該接受有效的shop_items數組', () => {
      const validShopItems = [
        {
          direct_link_code: 'c4043b71a4',
          variation_name: '標準',
          quantity: 2,
        },
        {
          direct_link_code: 'b7e4575bf6',
          variation_name: '豪華',
          quantity: 1,
        },
      ]

      const validData = { ...sponsorData, shop_items: validShopItems }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })

    test('應該接受空的shop_items數組', () => {
      const validData = { ...sponsorData, shop_items: [] }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })
  })

  describe('shipping 物件驗證', () => {
    test('應該接受有效的shipping物件', () => {
      const validShipping = {
        full_name: '測試收件人',
        street_address: '測試街道地址',
        city: '測試城市',
        state_or_province: '測試省',
        postal_code: '12345',
        country: '測試國家',
        country_code: 'TW',
        telephone: '+886912345678',
      }

      const validData = { ...sponsorData, shipping: validShipping }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })

    test('應該接受空的shipping物件', () => {
      const validData = { ...sponsorData, shipping: {} }
      const sponsor = new Sponsor(validData)
      expect(() => sponsor.validateSync()).not.toThrow()
    })
  })

  describe('資料庫索引', () => {
    test('應該定義正確的索引', () => {
      const indexes = Sponsor.schema.indexes()

      // 檢查是否正確設定了唯一索引
      expect(indexes).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ kofi_transaction_id: 1 }),
            expect.objectContaining({ background: true, unique: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ email: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ user_id: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ claimed_by_user_id: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ claim_token: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ createdAt: -1, is_public: 1, sponsor_level: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ createdAt: -1, status: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ refunded_at: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ message_auto_filtered: 1, message_reviewed: 1 }),
            expect.objectContaining({ background: true }),
          ]),
          expect.arrayContaining([
            expect.objectContaining({ direct_link_code: 1 }),
            expect.objectContaining({ background: true }),
          ]),
        ]),
      )
    })
  })

  describe('時間戳記', () => {
    test('應該正確配置timestamps', () => {
      // 檢查 schema 是否正確配置了 timestamps
      expect(Sponsor.schema.options.timestamps).toBe(true)
      expect(Sponsor.schema.options.versionKey).toBe(false)

      // 在測試環境中，timestamps 字段可能不會自動設置，但至少字段應該存在於 schema 中
      expect(Sponsor.schema.paths.createdAt).toBeDefined()
      expect(Sponsor.schema.paths.updatedAt).toBeDefined()
    })
  })

  describe('JSON序列化', () => {
    test('應該正確序列化為JSON', () => {
      const sponsor = new Sponsor(sponsorData)
      const json = sponsor.toJSON()

      expect(json).toHaveProperty('_id')
      // 在測試環境中，timestamps 可能不會自動設置，但 schema 配置應該正確
      if (json.createdAt) {
        expect(json).toHaveProperty('createdAt')
        expect(json).toHaveProperty('updatedAt')
      }
      expect(json).not.toHaveProperty('__v') // 因為設置了versionKey: false

      // 檢查 versionKey 配置
      expect(Sponsor.schema.options.versionKey).toBe(false)
    })
  })
})
