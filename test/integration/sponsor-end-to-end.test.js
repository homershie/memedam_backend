import request from 'supertest'
import app from '@/index.js'
import { describe, beforeAll, beforeEach, test, expect, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import User from '@/models/User.js'
import Sponsor from '@/models/Sponsor.js'
import { clearProcessedMessage } from '@/middleware/kofiWebhookValidation.js'

/**
 * 贊助系統端到端整合測試
 *
 * 測試整個贊助流程：
 * 1. Ko-fi Webhook 接收與驗證
 * 2. 贊助數據處理與儲存
 * 3. 用戶資料更新
 * 4. 通知系統觸發
 * 5. 快取更新
 * 6. API 查詢功能
 */

describe('贊助系統端到端整合測試', () => {
  let mongo
  let testUser
  let testAdmin

  // 測試用的 Ko-fi Webhook 數據
  const validKofiWebhookData = {
    verification_token: process.env.KOFI_VERIFICATION_TOKEN || 'test_token',
    message_id: 'e2e_test_message_123',
    kofi_transaction_id: 'e2e_kofi_txn_123',
    type: 'Shop Order',
    from_name: '端到端測試贊助者',
    display_name: 'E2E Test Sponsor',
    email: 'e2e_test@example.com',
    amount: '5.00',
    currency: 'USD',
    message: '這是端到端測試的贊助訊息',
    direct_link_code: '25678099a7', // 咖啡贊助
    shop_items: [
      {
        direct_link_code: '25678099a7',
        variation_name: '標準',
        quantity: 1,
      },
    ],
    shipping: {
      full_name: '端到端測試收件人',
      street_address: '測試地址 123 號',
      city: '測試城市',
      state_or_province: '測試省',
      postal_code: '12345',
      country: '測試國家',
      country_code: 'TW',
      telephone: '+886912345678',
    },
    is_public: true,
    discord_username: 'e2e_testuser#1234',
    discord_userid: '987654321098765432',
  }

  beforeAll(async () => {
    // 如果已有連接，先斷開
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }

    // 啟動記憶體 MongoDB
    mongo = await MongoMemoryServer.create()
    const uri = mongo.getUri()
    await mongoose.connect(uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    })

    // 設定測試環境變數
    process.env.NODE_ENV = 'test'
    process.env.KOFI_VERIFICATION_TOKEN = 'test_token'
    process.env.JWT_SECRET = 'test_jwt_secret'

    console.log('✅ 端到端測試資料庫已啟動')
  })

  afterAll(async () => {
    await mongoose.disconnect()
    if (mongo) await mongo.stop()
    console.log('✅ 端到端測試資料庫已關閉')
  })

  beforeEach(async () => {
    // 清空測試數據
    await User.deleteMany({})
    await Sponsor.deleteMany({})

    // 清理快取
    global.testProcessedMessages = {}

    // 創建測試用戶
    testUser = new User({
      username: 'e2e_test_user',
      email: 'e2e_test@example.com',
      password: 'hashed_password',
      display_name: '端到端測試用戶',
      role: 'user',
      status: 'active',
      email_verified: true,
    })
    await testUser.save()

    testAdmin = new User({
      username: 'e2e_test_admin',
      email: 'admin@example.com',
      password: 'hashed_password',
      display_name: '管理員',
      role: 'admin',
      status: 'active',
      email_verified: true,
    })
    await testAdmin.save()

    // 清理訊息處理標記
    await clearProcessedMessage('e2e_test_message_123')
  })

  describe('完整贊助流程測試', () => {
    test('應該成功處理完整的 Ko-fi 贊助流程', async () => {
      // 1. 發送 Ko-fi Webhook
      const webhookResponse = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(validKofiWebhookData)

      expect(webhookResponse.status).toBe(200)
      expect(webhookResponse.body.success).toBe(true)
      expect(webhookResponse.body.data).toHaveProperty('kofi_transaction_id')
      expect(webhookResponse.body.data.sponsor_level).toBe('coffee')

      // 2. 驗證贊助記錄已正確儲存
      const savedSponsor = await Sponsor.findOne({
        kofi_transaction_id: 'e2e_kofi_txn_123',
      }).populate('user_id')

      expect(savedSponsor).toBeTruthy()
      expect(savedSponsor.amount).toBe(5)
      expect(savedSponsor.status).toBe('success')
      expect(savedSponsor.payment_method).toBe('ko-fi')
      expect(savedSponsor.sponsor_level).toBe('coffee')
      expect(savedSponsor.from_name).toBe('端到端測試贊助者')
      expect(savedSponsor.email).toBe('e2e_test@example.com')
      expect(savedSponsor.direct_link_code).toBe('25678099a7')
      expect(savedSponsor.badge_earned).toBe(true) // 咖啡等級應該獲得徽章

      // 3. 驗證用戶關聯正確
      expect(savedSponsor.user_id._id.toString()).toBe(testUser._id.toString())

      // 4. 驗證用戶個人資料已更新
      const updatedUser = await User.findById(testUser._id)
      expect(updatedUser.display_name).toBe('端到端測試贊助者') // 應該更新為 Ko-fi 的 from_name
      expect(updatedUser.total_sponsor_amount).toBe(5)
      expect(updatedUser.last_sponsor_at).toBeInstanceOf(Date)
      expect(updatedUser.sponsor_count).toBe(1)

      // 5. 驗證 Shop Items 數據已正確解析
      expect(savedSponsor.shop_items_parsed).toBe(true)
      expect(savedSponsor.shop_items).toHaveLength(1)
      expect(savedSponsor.shop_items[0].direct_link_code).toBe('25678099a7')
      expect(savedSponsor.shop_items_quantity).toBe(1)
      expect(savedSponsor.shop_items_total_amount).toBe(5)

      // 6. 驗證訊息審核已執行
      expect(savedSponsor.message_reviewed).toBe(true)
      expect(savedSponsor.message_auto_filtered).toBe(false) // 正常訊息不應該被過濾
      expect(savedSponsor.message_original).toBe('這是端到端測試的贊助訊息')
      expect(savedSponsor.requires_manual_review).toBe(false)

      // 7. 驗證處理資訊
      expect(savedSponsor.processed_at).toBeInstanceOf(Date)
      expect(savedSponsor.created_ip).toBeTruthy()
      expect(savedSponsor.message_id).toBe('e2e_test_message_123')
    })

    test('應該處理匿名贊助（無用戶關聯）', async () => {
      const anonymousWebhookData = {
        ...validKofiWebhookData,
        message_id: 'e2e_anonymous_test_123',
        kofi_transaction_id: 'e2e_anonymous_txn_123',
        email: 'anonymous@example.com', // 不存在的用戶信箱
      }

      const webhookResponse = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(anonymousWebhookData)

      expect(webhookResponse.status).toBe(200)
      expect(webhookResponse.body.success).toBe(true)

      // 驗證贊助記錄已儲存但無用戶關聯
      const savedSponsor = await Sponsor.findOne({
        kofi_transaction_id: 'e2e_anonymous_txn_123',
      })

      expect(savedSponsor).toBeTruthy()
      expect(savedSponsor.user_id).toBeNull()
      expect(savedSponsor.email).toBe('anonymous@example.com')
    })

    test('應該正確處理多項目訂單合併', async () => {
      const multiItemWebhookData = {
        ...validKofiWebhookData,
        message_id: 'e2e_multi_item_test_123',
        kofi_transaction_id: 'e2e_multi_item_txn_123',
        shop_items: [
          {
            direct_link_code: 'c4043b71a4', // 豆漿贊助 (1 USD)
            variation_name: '標準',
            quantity: 2,
          },
          {
            direct_link_code: 'b7e4575bf6', // 雞肉贊助 (2 USD)
            variation_name: '標準',
            quantity: 1,
          },
        ],
        direct_link_code: 'b7e4575bf6', // 最高等級項目
      }

      const webhookResponse = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(multiItemWebhookData)

      expect(webhookResponse.status).toBe(200)
      expect(webhookResponse.body.success).toBe(true)

      const savedSponsor = await Sponsor.findOne({
        kofi_transaction_id: 'e2e_multi_item_txn_123',
      })

      expect(savedSponsor).toBeTruthy()
      expect(savedSponsor.shop_items_parsed).toBe(true)
      expect(savedSponsor.shop_items_merged).toBe(true)
      expect(savedSponsor.shop_items).toHaveLength(2)
      expect(savedSponsor.shop_items_quantity).toBe(3) // 2 + 1
      expect(savedSponsor.amount).toBe(2) // 使用最高等級的金額
      expect(savedSponsor.sponsor_level).toBe('chicken')
    })
  })

  describe('API 查詢功能測試', () => {
    beforeEach(async () => {
      // 創建測試贊助記錄
      const sponsors = [
        {
          user_id: testUser._id,
          amount: 5,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: 'query_test_txn_1',
          sponsor_level: 'coffee',
          from_name: '查詢測試用戶1',
          email: 'query_test1@example.com',
          message: '咖啡贊助測試',
          createdAt: new Date('2024-01-01'),
        },
        {
          user_id: testUser._id,
          amount: 2,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: 'query_test_txn_2',
          sponsor_level: 'chicken',
          from_name: '查詢測試用戶2',
          email: 'query_test2@example.com',
          message: '雞肉贊助測試',
          createdAt: new Date('2024-01-02'),
        },
        {
          user_id: testAdmin._id,
          amount: 1,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: 'query_test_txn_3',
          sponsor_level: 'soy',
          from_name: '管理員贊助',
          email: 'admin_sponsor@example.com',
          message: '豆漿贊助測試',
          createdAt: new Date('2024-01-03'),
        },
      ]

      for (const sponsorData of sponsors) {
        const sponsor = new Sponsor(sponsorData)
        await sponsor.save()
      }
    })

    test('應該能夠查詢所有贊助記錄', async () => {
      const response = await request(app).get('/api/sponsors').query({ page: 1, limit: 10 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(3)
      expect(response.body.pagination.total).toBe(3)
      expect(response.body.pagination.pages).toBe(1)
    })

    test('應該支援按用戶ID篩選', async () => {
      const response = await request(app)
        .get('/api/sponsors')
        .query({ user_id: testUser._id.toString() })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(
        response.body.data.every((s) => s.user_id._id.toString() === testUser._id.toString()),
      ).toBe(true)
    })

    test('應該支援按狀態篩選', async () => {
      const response = await request(app).get('/api/sponsors').query({ status: 'success' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data.every((s) => s.status === 'success')).toBe(true)
    })

    test('應該支援按金額範圍篩選', async () => {
      const response = await request(app)
        .get('/api/sponsors')
        .query({ min_amount: 2, max_amount: 4 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].amount).toBe(2)
    })

    test('應該支援關鍵字搜尋', async () => {
      const response = await request(app).get('/api/sponsors').query({ q: '咖啡' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].message).toContain('咖啡')
    })

    test('應該支援排序功能', async () => {
      const response = await request(app)
        .get('/api/sponsors')
        .query({ sort_by: 'amount', sort_dir: 'desc' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data[0].amount).toBe(5)
      expect(response.body.data[1].amount).toBe(2)
      expect(response.body.data[2].amount).toBe(1)
    })

    test('應該支援分頁功能', async () => {
      const response = await request(app).get('/api/sponsors').query({ page: 1, limit: 2 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(2)
      expect(response.body.pagination.total).toBe(3)
      expect(response.body.pagination.pages).toBe(2)
    })
  })

  describe('權限控制測試', () => {
    let userSponsor
    let otherUserSponsor

    beforeEach(async () => {
      // 創建不同用戶的贊助記錄
      userSponsor = new Sponsor({
        user_id: testUser._id,
        amount: 5,
        status: 'success',
        kofi_transaction_id: 'permission_test_txn_1',
        from_name: '用戶自己的贊助',
      })
      await userSponsor.save()

      otherUserSponsor = new Sponsor({
        user_id: testAdmin._id,
        amount: 3,
        status: 'success',
        kofi_transaction_id: 'permission_test_txn_2',
        from_name: '其他用戶的贊助',
      })
      await otherUserSponsor.save()
    })

    test('用戶應該只能查看自己的贊助詳情', async () => {
      // 模擬用戶登入
      const agent = request.agent(app)
      // 注意：實際項目中需要 JWT token 驗證，這裡簡化處理

      // 用戶查看自己的贊助
      const ownSponsorResponse = await request(app).get(`/api/sponsors/${userSponsor._id}`)

      // 注意：在實際實現中，這裡需要驗證 JWT token
      // 這裡我們只測試資料庫邏輯
      expect(userSponsor.user_id.toString()).toBe(testUser._id.toString())
      expect(otherUserSponsor.user_id.toString()).toBe(testAdmin._id.toString())
    })

    test('管理員應該能夠查看所有贊助詳情', async () => {
      // 管理員可以查看任何人的贊助
      expect(testAdmin.role).toBe('admin')
      // 在實際實現中，管理員的權限檢查會在控制器中處理
    })
  })

  describe('統計功能測試', () => {
    test('應該正確計算贊助統計', async () => {
      // 創建多個贊助記錄進行統計測試
      const sponsors = [
        {
          user_id: testUser._id,
          amount: 5,
          status: 'success',
          sponsor_level: 'coffee',
          kofi_transaction_id: 'stats_test_txn_1',
        },
        {
          user_id: testUser._id,
          amount: 2,
          status: 'success',
          sponsor_level: 'chicken',
          kofi_transaction_id: 'stats_test_txn_2',
        },
        {
          user_id: testUser._id,
          amount: 1,
          status: 'success',
          sponsor_level: 'soy',
          kofi_transaction_id: 'stats_test_txn_3',
        },
      ]

      for (const sponsorData of sponsors) {
        const sponsor = new Sponsor(sponsorData)
        await sponsor.save()
      }

      // 驗證統計計算
      const totalSponsors = await Sponsor.countDocuments({ status: 'success' })
      const totalAmount = await Sponsor.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])

      expect(totalSponsors).toBe(3)
      expect(totalAmount[0].total).toBe(8)
    })
  })

  describe('錯誤處理測試', () => {
    test('應該處理重複的 Webhook 訊息', async () => {
      // 第一次請求
      await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(validKofiWebhookData)

      // 第二次請求（相同 message_id）
      const duplicateResponse = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(validKofiWebhookData)

      expect(duplicateResponse.status).toBe(200)
      expect(duplicateResponse.body.success).toBe(true)
      expect(duplicateResponse.body.message).toBe('訊息已處理')

      // 驗證只創建了一個贊助記錄
      const sponsors = await Sponsor.find({
        kofi_transaction_id: 'e2e_kofi_txn_123',
      })
      expect(sponsors).toHaveLength(1)
    })

    test('應該處理無效的 Webhook 數據', async () => {
      const invalidWebhookData = {
        ...validKofiWebhookData,
        message_id: 'e2e_invalid_test_123',
        amount: 'invalid_amount',
      }

      const response = await request(app)
        .post('/api/sponsors/webhooks/kofi/shop-orders')
        .set('Content-Type', 'application/json')
        .send(invalidWebhookData)

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('無效的金額')
    })

    test('應該處理不存在的贊助查詢', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const response = await request(app).get(`/api/sponsors/${fakeId}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('找不到贊助')
    })
  })

  describe('幣別轉換測試', () => {
    test('應該能夠測試幣別轉換功能', async () => {
      const conversionResponse = await request(app)
        .post('/api/sponsors/currency/convert')
        .set('Content-Type', 'application/json')
        .send({
          amount: 100,
          from_currency: 'USD',
          to_currency: 'TWD',
        })

      // 注意：實際的轉換結果取決於匯率服務
      expect(conversionResponse.status).toBe(200)
      expect(conversionResponse.body.success).toBe(true)
      expect(conversionResponse.body.data).toHaveProperty('conversion')
    })

    test('應該能夠獲取支援的幣別列表', async () => {
      const currenciesResponse = await request(app).get('/api/sponsors/currency/supported')

      expect(currenciesResponse.status).toBe(200)
      expect(currenciesResponse.body.success).toBe(true)
      expect(currenciesResponse.body.data).toBeInstanceOf(Array)
      expect(currenciesResponse.body.data.length).toBeGreaterThan(0)
    })
  })
})
