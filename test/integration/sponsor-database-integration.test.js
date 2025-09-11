import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import mongoose from 'mongoose'
import User from '@/models/User.js'
import Sponsor from '@/models/Sponsor.js'

/**
 * 贊助系統資料庫操作整合測試
 *
 * 測試資料庫相關功能：
 * 1. 事務處理
 * 2. 索引效能
 * 3. 聚合查詢
 * 4. 資料完整性
 * 5. 並發處理
 */

describe('贊助系統資料庫操作整合測試', () => {
  beforeAll(async () => {
    console.log('✅ 資料庫整合測試使用全局測試資料庫連接')
  })

  afterAll(async () => {
    console.log('✅ 資料庫整合測試完成')
  })

  beforeEach(async () => {
    // 清空測試數據
    await User.deleteMany({})
    await Sponsor.deleteMany({})
  })

  describe('事務處理測試', () => {
    test.skip('應該在事務中正確處理贊助建立 - 跳過：記憶體 MongoDB 不支持事務', async () => {
      // 此測試需要在 replica set 環境中運行
      // 記憶體 MongoDB 不支持事務操作
    })

    test.skip('應該在事務失敗時正確回滾 - 跳過：記憶體 MongoDB 不支持事務', async () => {
      // 此測試需要在 replica set 環境中運行
      // 記憶體 MongoDB 不支持事務操作
    })
  })

  describe('唯一索引測試', () => {
    test('應該防止重複的 kofi_transaction_id', async () => {
      const sponsorData = {
        user_id: new mongoose.Types.ObjectId(),
        amount: 5,
        status: 'success',
        payment_method: 'ko-fi',
        kofi_transaction_id: 'unique_test_txn_123',
        from_name: '唯一性測試用戶',
      }

      // 第一次儲存應該成功
      const sponsor1 = new Sponsor(sponsorData)
      await sponsor1.save()

      // 第二次儲存應該失敗
      const sponsor2 = new Sponsor(sponsorData)
      await expect(sponsor2.save()).rejects.toThrow(/duplicate key/)

      // 驗證只有一條記錄
      const sponsors = await Sponsor.find({
        kofi_transaction_id: 'unique_test_txn_123',
      })
      expect(sponsors).toHaveLength(1)
    })
  })

  describe('索引效能測試', () => {
    beforeEach(async () => {
      // 創建大量測試數據
      const sponsors = []
      for (let i = 0; i < 100; i++) {
        sponsors.push({
          user_id: new mongoose.Types.ObjectId(),
          amount: Math.floor(Math.random() * 10) + 1,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: `performance_test_txn_${i}`,
          from_name: `效能測試用戶${i}`,
          email: `performance_test${i}@example.com`,
          sponsor_level: ['soy', 'chicken', 'coffee'][Math.floor(Math.random() * 3)],
          is_public: Math.random() > 0.5,
          createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // 隨機過去一年內的日期
        })
      }

      await Sponsor.insertMany(sponsors)
    })

    test('應該有效使用 user_id 索引', async () => {
      const testUserId = new mongoose.Types.ObjectId()

      // 創建該用戶的多個贊助記錄
      const userSponsors = []
      for (let i = 0; i < 5; i++) {
        userSponsors.push({
          user_id: testUserId,
          amount: 5,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: `user_index_test_txn_${i}`,
          from_name: `用戶索引測試${i}`,
        })
      }
      await Sponsor.insertMany(userSponsors)

      // 查詢該用戶的所有贊助
      const startTime = Date.now()
      const userSponsorsFound = await Sponsor.find({ user_id: testUserId })
      const queryTime = Date.now() - startTime

      expect(userSponsorsFound).toHaveLength(5)
      expect(queryTime).toBeLessThan(100) // 應該在100ms內完成
    })

    test('應該有效使用 email 索引', async () => {
      const testEmail = 'index_test@example.com'

      // 創建多個相同email的贊助記錄
      const emailSponsors = []
      for (let i = 0; i < 3; i++) {
        emailSponsors.push({
          user_id: new mongoose.Types.ObjectId(),
          amount: 5,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: `email_index_test_txn_${i}`,
          from_name: `Email索引測試${i}`,
          email: testEmail,
        })
      }
      await Sponsor.insertMany(emailSponsors)

      const startTime = Date.now()
      const emailSponsorsFound = await Sponsor.find({ email: testEmail })
      const queryTime = Date.now() - startTime

      expect(emailSponsorsFound).toHaveLength(3)
      expect(queryTime).toBeLessThan(100)
    })

    test('應該有效使用複合索引', async () => {
      const startTime = Date.now()
      await Sponsor.find({
        is_public: true,
        sponsor_level: 'coffee',
      })
        .sort({ createdAt: -1 })
        .limit(10)
      const queryTime = Date.now() - startTime

      expect(queryTime).toBeLessThan(100)
    })
  })

  describe('聚合查詢測試', () => {
    beforeEach(async () => {
      // 創建測試數據
      const testUser = new User({
        username: 'agg_test_user',
        email: 'agg_test@example.com',
        password: 'hashed_password',
        display_name: '聚合測試用戶',
      })
      await testUser.save()

      const sponsors = [
        {
          user_id: testUser._id,
          amount: 5,
          status: 'success',
          sponsor_level: 'coffee',
          kofi_transaction_id: 'agg_test_txn_1',
          currency: 'USD',
        },
        {
          user_id: testUser._id,
          amount: 2,
          status: 'success',
          sponsor_level: 'chicken',
          kofi_transaction_id: 'agg_test_txn_2',
          currency: 'USD',
        },
        {
          user_id: testUser._id,
          amount: 1,
          status: 'success',
          sponsor_level: 'soy',
          kofi_transaction_id: 'agg_test_txn_3',
          currency: 'USD',
        },
        {
          user_id: testUser._id,
          amount: 3,
          status: 'failed', // 失敗的贊助
          sponsor_level: 'chicken',
          kofi_transaction_id: 'agg_test_txn_4',
          currency: 'USD',
        },
      ]

      await Sponsor.insertMany(sponsors)
    })

    test('應該正確計算總贊助金額', async () => {
      const pipeline = [
        { $match: { status: 'success' } },
        {
          $group: {
            _id: null,
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]

      const result = await Sponsor.aggregate(pipeline)

      expect(result).toHaveLength(1)
      expect(result[0].total_amount).toBe(8) // 5 + 2 + 1
      expect(result[0].count).toBe(3)
    })

    test('應該正確按等級統計贊助', async () => {
      const pipeline = [
        { $match: { status: 'success' } },
        {
          $group: {
            _id: '$sponsor_level',
            count: { $sum: 1 },
            total_amount: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]

      const result = await Sponsor.aggregate(pipeline)

      expect(result).toHaveLength(3)

      const coffeeStats = result.find((r) => r._id === 'coffee')
      const chickenStats = result.find((r) => r._id === 'chicken')
      const soyStats = result.find((r) => r._id === 'soy')

      expect(coffeeStats.count).toBe(1)
      expect(coffeeStats.total_amount).toBe(5)
      expect(chickenStats.count).toBe(1)
      expect(chickenStats.total_amount).toBe(2)
      expect(soyStats.count).toBe(1)
      expect(soyStats.total_amount).toBe(1)
    })

    test('應該正確計算用戶統計', async () => {
      const testUser = await User.findOne({ username: 'agg_test_user' })

      const pipeline = [
        {
          $match: {
            user_id: testUser._id,
            status: 'success',
          },
        },
        {
          $group: {
            _id: '$user_id',
            total_amount: { $sum: '$amount' },
            count: { $sum: 1 },
            avg_amount: { $avg: '$amount' },
            max_amount: { $max: '$amount' },
            min_amount: { $min: '$amount' },
          },
        },
      ]

      const result = await Sponsor.aggregate(pipeline)

      expect(result).toHaveLength(1)
      expect(result[0].total_amount).toBe(8)
      expect(result[0].count).toBe(3)
      expect(result[0].avg_amount).toBe(8 / 3)
      expect(result[0].max_amount).toBe(5)
      expect(result[0].min_amount).toBe(1)
    })

    test('應該正確按月份統計贊助趨勢', async () => {
      const pipeline = [
        { $match: { status: 'success' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
            total_amount: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]

      const result = await Sponsor.aggregate(pipeline)

      expect(result).toHaveLength(1)
      expect(result[0].count).toBe(3)
      expect(result[0].total_amount).toBe(8)
      expect(result[0]._id).toHaveProperty('year')
      expect(result[0]._id).toHaveProperty('month')
    })
  })

  describe('資料完整性測試', () => {
    test('應該維持用戶和贊助記錄的參考完整性', async () => {
      const testUser = new User({
        username: 'integrity_test_user',
        email: 'integrity_test@example.com',
        password: 'hashed_password',
        display_name: '完整性測試用戶',
      })
      await testUser.save()

      // 創建該用戶的贊助記錄
      const sponsor = new Sponsor({
        user_id: testUser._id,
        amount: 5,
        status: 'success',
        kofi_transaction_id: 'integrity_test_txn_123',
        from_name: '完整性測試贊助',
      })
      await sponsor.save()

      // 驗證 populate 功能正常
      const populatedSponsor = await Sponsor.findById(sponsor._id).populate(
        'user_id',
        'username email display_name',
      )

      expect(populatedSponsor.user_id).toBeTruthy()
      expect(populatedSponsor.user_id.username).toBe('integrity_test_user')
      expect(populatedSponsor.user_id.email).toBe('integrity_test@example.com')
    })

    test('應該處理被刪除用戶的贊助記錄', async () => {
      const tempUser = new User({
        username: 'temp_user',
        email: 'temp@example.com',
        password: 'hashed_password',
        display_name: '臨時用戶',
      })
      await tempUser.save()

      const sponsor = new Sponsor({
        user_id: tempUser._id,
        amount: 5,
        status: 'success',
        kofi_transaction_id: 'temp_user_test_txn_123',
        from_name: '臨時用戶贊助',
      })
      await sponsor.save()

      // 刪除用戶
      await User.findByIdAndDelete(tempUser._id)

      // 驗證贊助記錄仍然存在
      const existingSponsor = await Sponsor.findById(sponsor._id)
      expect(existingSponsor).toBeTruthy()
      expect(existingSponsor.user_id).toEqual(tempUser._id) // 參考仍然存在

      // 但是 populate 會返回 null
      const populatedSponsor = await Sponsor.findById(sponsor._id).populate('user_id')
      expect(populatedSponsor.user_id).toBeNull()
    })
  })

  describe('並發處理測試', () => {
    test('應該正確處理並發的贊助建立', async () => {
      const concurrentOperations = []
      const transactionIds = []

      // 準備10個並發操作（不使用事務，因為記憶體 MongoDB 不支持）
      for (let i = 0; i < 10; i++) {
        const transactionId = `concurrent_test_txn_${i}_${Date.now()}`
        transactionIds.push(transactionId)

        concurrentOperations.push(
          (async () => {
            const sponsor = new Sponsor({
              user_id: new mongoose.Types.ObjectId(),
              amount: 5,
              status: 'success',
              payment_method: 'ko-fi',
              kofi_transaction_id: transactionId,
              from_name: `並發測試用戶${i}`,
            })

            return await sponsor.save()
          })(),
        )
      }

      // 執行所有並發操作
      const results = await Promise.allSettled(concurrentOperations)

      // 驗證所有操作都成功
      const successfulResults = results.filter((result) => result.status === 'fulfilled')
      expect(successfulResults).toHaveLength(10)

      // 驗證所有贊助記錄都已儲存
      for (const transactionId of transactionIds) {
        const sponsor = await Sponsor.findOne({ kofi_transaction_id: transactionId })
        expect(sponsor).toBeTruthy()
      }
    })

    test('應該防止並發的相同交易ID', async () => {
      const transactionId = `duplicate_concurrent_txn_${Date.now()}`
      const concurrentOperations = []

      // 準備多個使用相同交易ID的操作
      for (let i = 0; i < 5; i++) {
        concurrentOperations.push(
          (async () => {
            try {
              const sponsor = new Sponsor({
                user_id: new mongoose.Types.ObjectId(),
                amount: 5,
                status: 'success',
                payment_method: 'ko-fi',
                kofi_transaction_id: transactionId,
                from_name: `重複測試用戶${i}`,
              })

              return await sponsor.save()
            } catch (error) {
              if (error.code === 11000) {
                // 重複鍵錯誤，預期內的
                return null
              }
              throw error
            }
          })(),
        )
      }

      // 執行所有並發操作
      const results = await Promise.allSettled(concurrentOperations)

      // 應該只有一個成功，其他都失敗
      const successfulResults = results.filter(
        (result) => result.status === 'fulfilled' && result.value !== null,
      )
      const failedResults = results.filter(
        (result) =>
          result.status === 'rejected' || (result.status === 'fulfilled' && result.value === null),
      )

      expect(successfulResults).toHaveLength(1)
      expect(failedResults.length).toBeGreaterThanOrEqual(4)

      // 驗證資料庫中只有一條記錄
      const sponsors = await Sponsor.find({ kofi_transaction_id: transactionId })
      expect(sponsors).toHaveLength(1)
    })
  })

  describe('資料清理和維護測試', () => {
    test('應該能夠批量刪除測試數據', async () => {
      // 創建測試數據
      const testSponsors = []
      for (let i = 0; i < 20; i++) {
        testSponsors.push({
          user_id: new mongoose.Types.ObjectId(),
          amount: 5,
          status: 'success',
          payment_method: 'ko-fi',
          kofi_transaction_id: `cleanup_test_txn_${i}`,
          from_name: `清理測試用戶${i}`,
          email: `cleanup_test${i}@example.com`,
        })
      }
      await Sponsor.insertMany(testSponsors)

      // 驗證數據已創建
      const beforeCount = await Sponsor.countDocuments({
        kofi_transaction_id: { $regex: /^cleanup_test/ },
      })
      expect(beforeCount).toBe(20)

      // 批量刪除
      const deleteResult = await Sponsor.deleteMany({
        kofi_transaction_id: { $regex: /^cleanup_test/ },
      })

      expect(deleteResult.deletedCount).toBe(20)

      // 驗證數據已刪除
      const afterCount = await Sponsor.countDocuments({
        kofi_transaction_id: { $regex: /^cleanup_test/ },
      })
      expect(afterCount).toBe(0)
    })

    test('應該能夠更新多個記錄', async () => {
      // 創建測試數據
      const testSponsors = []
      for (let i = 0; i < 10; i++) {
        testSponsors.push({
          user_id: new mongoose.Types.ObjectId(),
          amount: 5,
          status: 'pending',
          payment_method: 'ko-fi',
          kofi_transaction_id: `bulk_update_test_txn_${i}`,
          from_name: `批量更新測試用戶${i}`,
        })
      }
      await Sponsor.insertMany(testSponsors)

      // 批量更新狀態
      const updateResult = await Sponsor.updateMany(
        { kofi_transaction_id: { $regex: /^bulk_update_test/ } },
        { $set: { status: 'success' } },
      )

      expect(updateResult.modifiedCount).toBe(10)

      // 驗證更新結果
      const updatedSponsors = await Sponsor.find({
        kofi_transaction_id: { $regex: /^bulk_update_test/ },
        status: 'success',
      })

      expect(updatedSponsors).toHaveLength(10)
    })
  })
})
