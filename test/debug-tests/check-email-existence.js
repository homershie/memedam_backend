import User from '../../models/User.js'
import { logger } from '../../utils/logger.js'

/**
 * 檢查特定 email 在資料庫中的存在情況
 */
const checkEmailExistence = async () => {
  try {
    const targetEmail = 'homershie@gmail.com'

    logger.info(`開始檢查 email: ${targetEmail}`)

    // 1. 檢查是否有任何狀態的用戶
    const allUsers = await User.find({ email: targetEmail })
    logger.info(`找到 ${allUsers.length} 個用戶記錄`)

    if (allUsers.length > 0) {
      allUsers.forEach((user, index) => {
        logger.info(`用戶 ${index + 1}:`)
        logger.info(`  - ID: ${user._id}`)
        logger.info(`  - Username: ${user.username}`)
        logger.info(`  - Email: ${user.email}`)
        logger.info(`  - Status: ${user.status}`)
        logger.info(`  - Email Verified: ${user.email_verified}`)
        logger.info(`  - Created At: ${user.createdAt}`)
        logger.info(`  - Updated At: ${user.updatedAt}`)
        if (user.deactivate_at) {
          logger.info(`  - Deactivate At: ${user.deactivate_at}`)
        }
        logger.info('---')
      })
    }

    // 2. 檢查活躍用戶（非刪除狀態）
    const activeUsers = await User.find({
      email: targetEmail,
      status: { $ne: 'deleted' },
    })
    logger.info(`找到 ${activeUsers.length} 個活躍用戶記錄`)

    // 3. 檢查已驗證的用戶
    const verifiedUsers = await User.find({
      email: targetEmail,
      email_verified: true,
    })
    logger.info(`找到 ${verifiedUsers.length} 個已驗證用戶記錄`)

    // 4. 檢查未驗證的用戶
    const unverifiedUsers = await User.find({
      email: targetEmail,
      email_verified: false,
    })
    logger.info(`找到 ${unverifiedUsers.length} 個未驗證用戶記錄`)

    // 5. 檢查被標記為刪除的用戶
    const deletedUsers = await User.find({
      email: targetEmail,
      status: 'deleted',
    })
    logger.info(`找到 ${deletedUsers.length} 個已刪除用戶記錄`)

    // 6. 檢查資料庫索引
    logger.info('檢查 email 索引...')
    const indexes = await User.collection.getIndexes()
    logger.info('User 集合的索引:')
    Object.keys(indexes).forEach((indexName) => {
      logger.info(`  - ${indexName}: ${JSON.stringify(indexes[indexName])}`)
    })

    // 7. 嘗試創建一個測試用戶（會失敗，但可以看到錯誤）
    logger.info('嘗試創建測試用戶...')
    try {
      await User.create({
        username: 'testuser_debug',
        email: targetEmail,
        password: 'testpassword123',
        display_name: '測試用戶',
      })
      logger.info('成功創建測試用戶（這不應該發生）')
    } catch (error) {
      logger.info('創建測試用戶失敗（預期行為）')
      logger.info(`錯誤代碼: ${error.code}`)
      logger.info(`錯誤訊息: ${error.message}`)
      if (error.keyValue) {
        logger.info(`衝突欄位: ${JSON.stringify(error.keyValue)}`)
      }
    }
  } catch (error) {
    logger.error('檢查 email 存在性時發生錯誤:', error)
  }
}

// 執行檢查
checkEmailExistence()
  .then(() => {
    logger.info('檢查完成')
    process.exit(0)
  })
  .catch((error) => {
    logger.error('檢查失敗:', error)
    process.exit(1)
  })
