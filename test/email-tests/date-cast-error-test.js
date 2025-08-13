import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 載入環境變數
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import VerificationToken from '../../models/VerificationToken.js'
import { logger } from '../../utils/logger.js'

/**
 * 測試日期 CastError 修復
 */
async function testDateCastErrorFix() {
  try {
    logger.info('開始測試日期 CastError 修復...')

    // 測試 1: 使用 mongoose.trusted 的查詢
    logger.info('測試 1: 使用 mongoose.trusted 的查詢')
    try {
      await VerificationToken.findOne({
        expiresAt: mongoose.trusted({ $gt: new Date() }),
      })
      logger.info('✅ mongoose.trusted 查詢成功')
    } catch (error) {
      logger.error('❌ mongoose.trusted 查詢失敗:', error.message)
    }

    // 測試 2: 測試原始查詢（應該會失敗）
    logger.info('測試 2: 原始查詢（預期會失敗）')
    try {
      await VerificationToken.findOne({
        expiresAt: { $gt: new Date() },
      })
      logger.info('⚠️ 原始查詢沒有失敗（可能是環境問題）')
    } catch (error) {
      logger.info('✅ 原始查詢如預期失敗:', error.message)
    }

    // 測試 3: 創建測試 token 並驗證查詢
    logger.info('測試 3: 創建測試 token 並驗證查詢')
    const testToken = new VerificationToken({
      token: 'test-cast-error-token',
      userId: new mongoose.Types.ObjectId(),
      type: 'email_verification',
      used: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小時後過期
    })
    await testToken.save()
    logger.info('✅ 測試 token 創建成功')

    // 測試查詢
    const foundToken = await VerificationToken.findOne({
      token: 'test-cast-error-token',
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    })

    if (foundToken) {
      logger.info('✅ 使用 mongoose.trusted 的查詢成功找到 token')
    } else {
      logger.error('❌ 查詢失敗，沒有找到 token')
    }

    // 清理測試資料
    await VerificationToken.deleteOne({ token: 'test-cast-error-token' })
    logger.info('✅ 測試資料清理完成')

    logger.info('日期 CastError 修復測試完成！')
  } catch (error) {
    logger.error('測試失敗:', error)
  }
}

// 連接到資料庫並執行測試
async function runTest() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam'
    logger.info(`連接到資料庫: ${mongoUri}`)

    await mongoose.connect(mongoUri)
    logger.info('資料庫連接成功')

    await testDateCastErrorFix()

    logger.info('測試完成')
    process.exit(0)
  } catch (error) {
    logger.error('測試失敗:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

// 直接執行測試
runTest()
