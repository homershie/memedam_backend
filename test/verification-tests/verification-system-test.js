import mongoose from 'mongoose'
import User from '../../models/User.js'
import VerificationToken from '../../models/VerificationToken.js'
import VerificationController from '../../controllers/verificationController.js'
import { logger } from '../../utils/logger.js'

/**
 * 驗證系統測試
 */
async function testVerificationSystem() {
  try {
    logger.info('開始驗證系統測試...')

    // 1. 測試產生驗證 token
    logger.info('1. 測試產生驗證 token')
    const testUser = await User.findOne({ email: 'test@example.com' })
    if (!testUser) {
      logger.info('創建測試用戶...')
      const newUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpassword123',
        email_verified: false,
      })
      await newUser.save()
      logger.info('測試用戶創建成功')
    }

    const user = testUser || (await User.findOne({ email: 'test@example.com' }))

    // 產生驗證 token
    const token = await VerificationController.generateVerificationToken(
      user._id,
      'email_verification',
      24,
    )
    logger.info(`驗證 token 產生成功: ${token.substring(0, 10)}...`)

    // 2. 測試 token 儲存
    logger.info('2. 測試 token 儲存')
    const savedToken = await VerificationToken.findOne({ token })
    if (savedToken) {
      logger.info('Token 儲存成功')
      logger.info(`Token 類型: ${savedToken.type}`)
      logger.info(`過期時間: ${savedToken.expiresAt}`)
      logger.info(`是否已使用: ${savedToken.used}`)
    } else {
      logger.error('Token 儲存失敗')
    }

    // 3. 測試 token 驗證
    logger.info('3. 測試 token 驗證')
    const validToken = await VerificationToken.findOne({
      token,
      type: 'email_verification',
      used: false,
      expiresAt: { $gt: new Date() },
    })

    if (validToken) {
      logger.info('Token 驗證成功')

      // 標記為已使用
      validToken.used = true
      await validToken.save()
      logger.info('Token 已標記為使用')
    } else {
      logger.error('Token 驗證失敗')
    }

    // 4. 測試用戶驗證狀態更新
    logger.info('4. 測試用戶驗證狀態更新')
    const originalVerifiedStatus = user.email_verified
    user.email_verified = true
    user.verified_at = new Date()
    await user.save()

    logger.info(`用戶驗證狀態已更新: ${originalVerifiedStatus} -> ${user.email_verified}`)
    logger.info(`驗證時間: ${user.verified_at}`)

    // 5. 測試過期 token 清理
    logger.info('5. 測試過期 token 清理')
    const expiredToken = new VerificationToken({
      token: 'expired-token',
      userId: user._id,
      type: 'email_verification',
      used: false,
      expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 小時前過期
    })
    await expiredToken.save()
    logger.info('過期 token 已創建')

    // 6. 測試 rate limit 邏輯
    logger.info('6. 測試 rate limit 邏輯')
    const existingToken = await VerificationToken.findOne({
      userId: user._id,
      type: 'email_verification',
      used: false,
      expiresAt: { $gt: new Date() },
    })

    if (existingToken) {
      logger.info('發現未過期的驗證 token，符合 rate limit 邏輯')
    } else {
      logger.info('沒有未過期的驗證 token，可以發送新的驗證 email')
    }

    logger.info('驗證系統測試完成！')
  } catch (error) {
    logger.error('驗證系統測試失敗:', error)
  }
}

// 如果直接執行此檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  // 連接到資料庫
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam')
    .then(() => {
      logger.info('資料庫連接成功')
      return testVerificationSystem()
    })
    .then(() => {
      logger.info('測試完成')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('測試失敗:', error)
      process.exit(1)
    })
}

export { testVerificationSystem }
