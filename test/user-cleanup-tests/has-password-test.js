import mongoose from 'mongoose'
import User from '../../models/User.js'
import { updateHasPasswordField } from '../../utils/updateHasPassword.js'
import { logger } from '../../utils/logger.js'

// 測試 has_password 功能
const testHasPassword = async () => {
  try {
    logger.info('開始測試 has_password 功能...')

    // 清理測試資料
    await User.deleteMany({ username: { $regex: /^test_/ } })

    // 建立測試用戶 - 有密碼的用戶
    const userWithPassword = new User({
      username: 'test_user_with_password',
      email: 'test1@example.com',
      password: 'testpassword123',
      display_name: '測試用戶1'
    })
    await userWithPassword.save()
    logger.info('建立有密碼的測試用戶')

    // 建立測試用戶 - 社群登入用戶（沒有密碼）
    const socialUser = new User({
      username: 'test_social_user',
      email: 'test2@example.com',
      google_id: 'test_google_id_123',
      login_method: 'google',
      display_name: '測試社群用戶'
    })
    await socialUser.save()
    logger.info('建立社群登入測試用戶')

    // 檢查初始狀態
    const user1 = await User.findOne({ username: 'test_user_with_password' })
    const user2 = await User.findOne({ username: 'test_social_user' })
    
    logger.info(`用戶1 has_password: ${user1.has_password}`)
    logger.info(`用戶2 has_password: ${user2.has_password}`)

    // 執行更新腳本
    await updateHasPasswordField()

    // 檢查更新後的狀態
    const updatedUser1 = await User.findOne({ username: 'test_user_with_password' })
    const updatedUser2 = await User.findOne({ username: 'test_social_user' })
    
    logger.info(`更新後用戶1 has_password: ${updatedUser1.has_password}`)
    logger.info(`更新後用戶2 has_password: ${updatedUser2.has_password}`)

    // 驗證結果
    if (updatedUser1.has_password === true && updatedUser2.has_password === false) {
      logger.info('✅ has_password 功能測試通過')
    } else {
      logger.error('❌ has_password 功能測試失敗')
      logger.error(`預期: user1=true, user2=false`)
      logger.error(`實際: user1=${updatedUser1.has_password}, user2=${updatedUser2.has_password}`)
    }

    // 測試密碼變更功能
    logger.info('測試密碼變更功能...')
    
    // 為社群用戶設定密碼
    socialUser.password = 'newpassword123'
    await socialUser.save()
    
    const userAfterPasswordChange = await User.findOne({ username: 'test_social_user' })
    logger.info(`設定密碼後 has_password: ${userAfterPasswordChange.has_password}`)
    
    if (userAfterPasswordChange.has_password === true) {
      logger.info('✅ 密碼變更功能測試通過')
    } else {
      logger.error('❌ 密碼變更功能測試失敗')
    }

    // 清理測試資料
    await User.deleteMany({ username: { $regex: /^test_/ } })
    logger.info('測試資料清理完成')

  } catch (error) {
    logger.error('測試過程中發生錯誤:', error)
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  // 連接到資料庫
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam'
  
  mongoose.connect(mongoUri)
    .then(() => {
      logger.info('成功連接到資料庫')
      return testHasPassword()
    })
    .then(() => {
      logger.info('測試完成')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('測試失敗:', error)
      process.exit(1)
    })
    .finally(() => {
      mongoose.disconnect()
    })
}

export { testHasPassword }
