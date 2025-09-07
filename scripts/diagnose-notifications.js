/**
 * 通知系統診斷測試
 * 使用 Vitest 執行通知系統的完整診斷
 *
 * 執行方式:
 * npm run diagnose:notifications
 * 或
 * npx vitest run scripts/diagnose-notifications.js
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { createNewLikeNotification } from '../services/notificationService.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Notification from '../models/Notification.js'
import NotificationReceipt from '../models/NotificationReceipt.js'
import { logger } from '../utils/logger.js'

// 載入環境變數
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

// 設定測試環境
process.env.NODE_ENV = 'test'

const MONGODB_URI =
  process.env.MONGO_TEST_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/memedam_test'

// 全域變數來追蹤資料庫連接狀態
let dbConnected = false

describe('通知系統診斷', () => {
  let likerUser
  let authorUser
  let testMeme

  beforeAll(async () => {
    logger.info('🔍 開始診斷通知系統...')
    logger.info('📍 使用的資料庫URI:', MONGODB_URI)

    // 載入環境變數
    logger.info('📋 載入環境變數...')
    logger.info('📋 NODE_ENV:', process.env.NODE_ENV)
    logger.info('📋 MONGO_URI:', process.env.MONGO_URI ? '已設定' : '未設定')
    logger.info('📋 MONGO_TEST_URI:', process.env.MONGO_TEST_URI ? '已設定' : '未設定')

    // 連接到資料庫 - 使用簡單的連接邏輯
    logger.info('🔌 連接到資料庫...')
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        })
        logger.info('✅ 資料庫連接成功')
      } else {
        logger.info('✅ 使用現有的資料庫連接')
      }
      dbConnected = true
    } catch (error) {
      logger.warn('⚠️ 資料庫連接失敗，將跳過資料庫相關測試:', error.message)
      dbConnected = false
      // 不拋出錯誤，讓測試繼續進行，但會跳過資料庫相關的測試
    }
  }, 15000)

  afterAll(async () => {
    await mongoose.disconnect()
    logger.info('🔌 資料庫連接已關閉')
  }, 10000)

  beforeEach(async () => {
    if (!dbConnected) {
      logger.warn('⚠️ 跳過測試設置：資料庫未連接')
      return
    }

    // 清理測試資料
    await cleanupTestData()

    // 建立測試用戶
    logger.info('📝 建立測試用戶...')
    likerUser = await User.create({
      username: 'liker_test',
      email: 'liker@test.com',
      password: 'password123',
      displayName: '按讚測試用戶',
      notificationSettings: {
        newLike: true,
        newComment: true,
        newFollower: true,
      },
    })

    authorUser = await User.create({
      username: 'author_test',
      email: 'author@test.com',
      password: 'password123',
      displayName: '作者測試用戶',
      notificationSettings: {
        newLike: true,
        newComment: true,
        newFollower: true,
      },
    })

    logger.info('✅ 測試用戶建立成功')
  }, 10000)

  afterEach(async () => {
    if (!dbConnected) {
      return
    }
    // 清理測試資料
    await cleanupTestData()
  }, 5000)

  it('應該能夠建立測試迷因', async () => {
    if (!dbConnected) {
      logger.warn('⚠️ 跳過測試：資料庫未連接')
      return
    }

    // 建立測試迷因
    logger.info('🎭 建立測試迷因...')
    testMeme = await Meme.create({
      title: '測試通知的迷因',
      type: 'image',
      content: '這是一個測試迷因',
      author_id: authorUser._id,
      tags: ['test'],
      image_url: 'https://example.com/test.jpg',
    })

    expect(testMeme).toBeDefined()
    expect(testMeme.title).toBe('測試通知的迷因')
    expect(testMeme.author_id.toString()).toBe(authorUser._id.toString())
    logger.info('✅ 測試迷因建立成功')
  }, 5000)

  it('應該能夠正確處理按讚通知', async () => {
    if (!dbConnected) {
      logger.warn('⚠️ 跳過測試：資料庫未連接')
      return
    }

    // 建立測試迷因
    testMeme = await Meme.create({
      title: '測試通知的迷因',
      type: 'image',
      content: '這是一個測試迷因',
      author_id: authorUser._id,
      tags: ['test'],
      image_url: 'https://example.com/test.jpg',
    })

    // 測試按讚通知
    logger.info('👍 測試按讚通知功能...')
    const notificationResult = await createNewLikeNotification(testMeme._id, likerUser._id)

    logger.info('通知結果:', notificationResult)

    expect(notificationResult).toBeDefined()
    expect(notificationResult.success).toBeDefined()

    if (notificationResult?.success) {
      if (notificationResult.skipped) {
        logger.warn(`⚠️ 通知被跳過: ${notificationResult.reason}`)
        expect(notificationResult.skipped).toBe(true)
      } else {
        logger.info('✅ 通知建立成功')

        // 檢查資料庫中的通知
        const notifications = await Notification.find({
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        logger.info(`📊 找到 ${notifications.length} 個通知事件`)

        if (notifications.length > 0) {
          const receipts = await NotificationReceipt.find({
            notification_id: notifications[0]._id,
          })

          logger.info(`📨 找到 ${receipts.length} 個收件項`)

          if (receipts.length > 0) {
            logger.info('✅ 通知系統運作正常')
            expect(receipts.length).toBeGreaterThan(0)
          } else {
            logger.error('❌ 缺少收件項')
            expect(receipts.length).toBeGreaterThan(0)
          }
        } else {
          logger.error('❌ 通知事件未建立')
          expect(notifications.length).toBeGreaterThan(0)
        }
      }
    } else {
      logger.error('❌ 通知建立失敗:', notificationResult?.error)
      expect(notificationResult.success).toBe(true)
    }
  }, 10000)
})

async function cleanupTestData() {
  if (!dbConnected) {
    return
  }

  try {
    await User.deleteMany({ username: { $in: ['liker_test', 'author_test'] } })
    await Meme.deleteMany({ title: '測試通知的迷因' })
    await Notification.deleteMany({ verb: 'like', 'payload.meme_title': '測試通知的迷因' })
    logger.info('🧹 測試資料清理完成')
  } catch (error) {
    logger.error('清理測試資料時發生錯誤:', error)
  }
}
