import mongoose from 'mongoose'
import User from '../../models/User.js'
import {
  manualSendDeletionReminders,
  manualDeleteUnverifiedUsers,
  getUsersNeedingReminder,
  getUsersToDelete,
} from '../../utils/userCleanupScheduler.js'
import { logger } from '../../utils/logger.js'

/**
 * 用戶清理功能測試
 */
const testUserCleanup = async () => {
  try {
    logger.info('開始測試用戶清理功能...')

    // 測試 1: 獲取需要提醒的用戶
    logger.info('測試 1: 獲取需要提醒的用戶')
    const usersNeedingReminder = await getUsersNeedingReminder()
    logger.info(`找到 ${usersNeedingReminder.length} 個需要提醒的用戶`)

    // 測試 2: 獲取需要刪除的用戶
    logger.info('測試 2: 獲取需要刪除的用戶')
    const usersToDelete = await getUsersToDelete()
    logger.info(`找到 ${usersToDelete.length} 個需要刪除的用戶`)

    // 測試 3: 手動執行刪除提醒任務
    logger.info('測試 3: 手動執行刪除提醒任務')
    await manualSendDeletionReminders()

    // 測試 4: 手動執行刪除未驗證用戶任務
    logger.info('測試 4: 手動執行刪除未驗證用戶任務')
    await manualDeleteUnverifiedUsers()

    // 測試 5: 創建測試用戶（用於驗證功能）
    logger.info('測試 5: 創建測試用戶')
    const testUser = await User.create({
      username: 'testuser_cleanup',
      email: 'test.cleanup@example.com',
      password: 'testpassword123',
      email_verified: false,
      createdAt: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 12個月前
    })
    logger.info(`創建測試用戶: ${testUser.username}`)

    // 測試 6: 驗證測試用戶是否被正確識別
    logger.info('測試 6: 驗證測試用戶是否被正確識別')
    const testUsersToDelete = await getUsersToDelete()
    const foundTestUser = testUsersToDelete.find((user) => user.username === 'testuser_cleanup')
    if (foundTestUser) {
      logger.info('測試用戶被正確識別為需要刪除的用戶')
    } else {
      logger.warn('測試用戶未被識別為需要刪除的用戶')
    }

    // 清理測試用戶
    await User.findByIdAndDelete(testUser._id)
    logger.info('已清理測試用戶')

    logger.info('用戶清理功能測試完成')
  } catch (error) {
    logger.error('用戶清理功能測試失敗:', error)
  }
}

/**
 * 測試統計資訊
 */
const testStats = async () => {
  try {
    logger.info('開始測試統計資訊...')

    const elevenMonthsAgo = new Date()
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    // 獲取各種統計
    const totalUnverified = await User.countDocuments({
      email_verified: false,
      status: { $ne: 'deleted' },
    })

    const usersNeedingReminder = await User.countDocuments({
      email_verified: false,
      createdAt: { $lte: elevenMonthsAgo },
      status: { $ne: 'deleted' },
    })

    const usersToDelete = await User.countDocuments({
      email_verified: false,
      createdAt: { $lte: oneYearAgo },
      status: { $ne: 'deleted' },
    })

    logger.info('統計資訊:')
    logger.info(`- 總未驗證用戶: ${totalUnverified}`)
    logger.info(`- 需要提醒的用戶: ${usersNeedingReminder}`)
    logger.info(`- 需要刪除的用戶: ${usersToDelete}`)
  } catch (error) {
    logger.error('統計資訊測試失敗:', error)
  }
}

/**
 * 測試 email 發送功能
 */
const testEmailSending = async () => {
  try {
    logger.info('開始測試 email 發送功能...')

    // 創建一個測試用戶
    const testUser = await User.create({
      username: 'emailtest',
      email: 'test.email@example.com',
      password: 'testpassword123',
      email_verified: false,
      createdAt: new Date(Date.now() - 11 * 30 * 24 * 60 * 60 * 1000), // 11個月前
    })

    // 測試發送提醒 email
    logger.info('測試發送提醒 email...')
    await manualSendDeletionReminders()

    // 清理測試用戶
    await User.findByIdAndDelete(testUser._id)
    logger.info('email 發送功能測試完成')
  } catch (error) {
    logger.error('email 發送功能測試失敗:', error)
  }
}

// 執行測試
const runTests = async () => {
  try {
    // 連接到資料庫
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam')
    logger.info('已連接到資料庫')

    // 執行各種測試
    await testStats()
    await testUserCleanup()
    await testEmailSending()

    logger.info('所有測試完成')
  } catch (error) {
    logger.error('測試執行失敗:', error)
  } finally {
    await mongoose.disconnect()
    logger.info('已斷開資料庫連接')
  }
}

// 如果直接執行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
}

export { testUserCleanup, testStats, testEmailSending }
