import request from 'supertest'
import { app } from '../../../index.js'
import { clearProcessedMessage } from '../../../middleware/kofiWebhookValidation.js'
import { describe, beforeAll, beforeEach, test, expect } from 'vitest'
import User from '../../../models/User.js'

/**
 * Ko-fi Webhook 測試
 *
 * 測試前請確保：
 * 1. 設定環境變數 KOFI_VERIFICATION_TOKEN
 * 2. 確保資料庫連線正常
 * 3. 測試資料不會影響生產資料
 */

// 在測試中設置必要的環境變數
const TEST_KOFI_TOKEN = 'test_token'

// 設置測試環境變數
process.env.KOFI_VERIFICATION_TOKEN = TEST_KOFI_TOKEN
process.env.NODE_ENV = 'test'

// 確保中間件使用測試token（動態設置）
// import * as kofiValidation from '../../../middleware/kofiWebhookValidation.js'

describe('Ko-fi Shop Order Webhook', () => {
  const validShopOrderPayload = {
    verification_token: TEST_KOFI_TOKEN,
    message_id: 'test_message_123',
    kofi_transaction_id: 'test_txn_123',
    type: 'Shop Order',
    from_name: '測試贊助者',
    display_name: 'Test Sponsor',
    email: 'test@example.com',
    amount: '2.00', // 雞肉贊助的金額
    currency: 'USD', // 使用美元
    message: '測試贊助留言',
    direct_link_code: 'b7e4575bf6', // 雞肉贊助的代碼
    shop_items: [
      {
        direct_link_code: 'b7e4575bf6',
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
    discord_username: 'testuser#1234',
    discord_userid: '123456789012345678',
  }

  beforeAll(async () => {
    // 清理測試資料
    if (process.env.NODE_ENV === 'test') {
      await clearProcessedMessage('test_message_123')
      await clearProcessedMessage('test_invalid_amount')
      await clearProcessedMessage('test_missing_fields')
      await clearProcessedMessage('test_duplicate_123')
      await clearProcessedMessage('test_soy_123')
      await clearProcessedMessage('test_chicken_123')
      await clearProcessedMessage('test_coffee_123')

      // 清理測試用的記憶體快取
      global.testProcessedMessages = {}
    }
  })

  beforeEach(async () => {
    // 每個測試前清理快取，避免狀態干擾
    if (process.env.NODE_ENV === 'test') {
      await clearProcessedMessage('test_message_123')
      // 清理測試用的記憶體快取
      global.testProcessedMessages = {}
    }
  })

  describe('POST /api/sponsors/webhooks/kofi/shop-orders', () => {
    test('應該成功處理有效的 Shop Order Webhook', async () => {
      const payload = { ...validShopOrderPayload, message_id: 'test_success_123' }
      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Shop Order 處理成功')
      expect(response.body.data).toHaveProperty('kofi_transaction_id')
      expect(response.body.data).toHaveProperty('sponsor_id')
      expect(response.body.data.sponsor_level).toBe('chicken')
    })

    test('應該拒絕無效的驗證 token', async () => {
      const invalidPayload = {
        ...validShopOrderPayload,
        verification_token: 'invalid_token',
        message_id: 'test_invalid_token_123',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(invalidPayload)

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('驗證令牌無效')
    })

    test('應該拒絕不支援的請求類型', async () => {
      const invalidPayload = {
        ...validShopOrderPayload,
        type: 'Donation',
        message_id: 'test_invalid_type_123',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(invalidPayload)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('不支援的請求類型，僅支援 Shop Order')
    })

    test('應該拒絕不支援的商品代碼', async () => {
      const invalidPayload = {
        ...validShopOrderPayload,
        direct_link_code: 'INVALID_PRODUCT',
        message_id: 'test_invalid_product_123',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(invalidPayload)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('不支援的商品代碼')
    })

    test('應該處理重複的 message_id（防止重複處理）', async () => {
      const duplicatePayload = { ...validShopOrderPayload, message_id: 'test_duplicate_123' }

      // 第一次請求
      await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(duplicatePayload)

      // 第二次請求（相同的 message_id）
      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(duplicatePayload)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('訊息已處理')
    })

    test('應該處理缺少必要參數的情況', async () => {
      const invalidPayload = {
        verification_token: TEST_KOFI_TOKEN,
        message_id: 'test_missing_fields',
        type: 'Shop Order',
        direct_link_code: 'b7e4575bf6', // 提供有效的商品代碼來通過第一個檢查
        // 缺少其他必要字段如 kofi_transaction_id, from_name, amount, currency
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(invalidPayload)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('缺少必要參數')
    })

    test('應該處理無效的金額格式', async () => {
      const invalidPayload = {
        ...validShopOrderPayload,
        message_id: 'test_invalid_amount',
        amount: 'invalid_amount',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(invalidPayload)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('無效的金額')
    })
  })

  describe('用戶整合功能', () => {
    test('應該更新現有用戶的顯示名稱', async () => {
      // 創建測試用戶（沒有 display_name）
      const testUser = new User({
        username: 'test_user_profile_update',
        email: 'profile_test@example.com',
        password: 'hashed_password',
        display_name: '', // 空的顯示名稱
      })
      await testUser.save()

      const payload = {
        ...validShopOrderPayload,
        message_id: 'test_profile_update',
        kofi_transaction_id: `test_txn_profile_${Date.now()}`,
        email: 'profile_test@example.com',
        display_name: 'Ko-fi 測試用戶',
        from_name: 'Test User from Ko-fi',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 驗證用戶的 display_name 是否被更新
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.display_name).toBe('Ko-fi 測試用戶')

      // 清理測試數據
      await User.findByIdAndDelete(testUser._id)
    })

    test('不應該覆蓋已有的顯示名稱', async () => {
      // 創建測試用戶（已有 display_name）
      const testUser = new User({
        username: 'test_user_existing_display',
        email: 'existing_display_test@example.com',
        password: 'hashed_password',
        display_name: '現有顯示名稱',
      })
      await testUser.save()

      const payload = {
        ...validShopOrderPayload,
        message_id: 'test_existing_display',
        kofi_transaction_id: `test_txn_existing_${Date.now()}`,
        email: 'existing_display_test@example.com',
        display_name: 'Ko-fi 新名稱',
        from_name: 'Test User from Ko-fi',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 驗證用戶的 display_name 不應該被改變
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.display_name).toBe('現有顯示名稱') // 應該保持原有的

      // 清理測試數據
      await User.findByIdAndDelete(testUser._id)
    })
  })

  describe('不同的贊助等級', () => {
    test.each([
      ['c4043b71a4', 'soy', 1], // 豆漿贊助 (1 USD)
      ['b7e4575bf6', 'chicken', 2], // 雞肉贊助 (2 USD)
      ['25678099a7', 'coffee', 5], // 咖啡贊助 (5 USD)
    ])('應該正確處理 %s 贊助等級', async (directLinkCode, expectedLevel, expectedAmount) => {
      const payload = {
        ...validShopOrderPayload,
        message_id: `test_${expectedLevel}`,
        kofi_transaction_id: `test_txn_${expectedLevel}_${Date.now()}`, // 修復：使用唯一的交易ID
        direct_link_code: directLinkCode,
        amount: expectedAmount.toString(),
        shop_items: [
          {
            direct_link_code: directLinkCode, // 修復：使用相同的 direct_link_code
            variation_name: '標準',
            quantity: 1,
          },
        ],
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.sponsor_level).toBe(expectedLevel)
    })
  })
})
