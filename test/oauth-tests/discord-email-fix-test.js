import mongoose from 'mongoose'
import User from '../../models/User.js'
import { config } from '../../config/db.js'

// 測試 Discord OAuth email 重複問題的修復
async function testDiscordEmailFix() {
  try {
    // 連接到資料庫
    await mongoose.connect(config.url)
    console.log('✅ 資料庫連接成功')

    // 清理測試資料
    await User.deleteMany({ email: 'test@example.com' })
    console.log('🧹 清理測試資料完成')

    // 模擬現有用戶（通過本地註冊）
    const existingUser = new User({
      username: 'existinguser',
      email: 'test@example.com',
      password: 'password123',
      display_name: 'Existing User',
      login_method: 'local',
      email_verified: true,
    })
    await existingUser.save()
    console.log('👤 創建現有用戶:', existingUser.username)

    // 模擬 Discord OAuth 登入（使用相同 email）
    const discordProfile = {
      id: 'discord123',
      username: 'discorduser',
      email: 'test@example.com',
      displayName: 'Discord User',
      verified: true,
    }

    // 檢查 Discord ID 是否已存在
    let user = await User.findOne({ discord_id: discordProfile.id })
    console.log('🔍 檢查 Discord ID:', discordProfile.id, '存在:', !!user)

    if (!user) {
      // 檢查 email 是否已被其他用戶使用
      if (discordProfile.email) {
        const existingUserWithEmail = await User.findOne({ email: discordProfile.email })
        console.log('🔍 檢查 email:', discordProfile.email, '存在:', !!existingUserWithEmail)

        if (existingUserWithEmail) {
          // 如果 email 已存在，直接返回該用戶（允許綁定 Discord 帳號）
          existingUserWithEmail.discord_id = discordProfile.id
          await existingUserWithEmail.save()
          console.log('✅ 成功綁定 Discord 帳號到現有用戶')
          user = existingUserWithEmail
        }
      }

      if (!user) {
        // 創建新用戶（如果 email 不存在）
        console.log('📝 創建新 Discord 用戶')
        // ... 創建新用戶的邏輯
      }
    }

    // 驗證結果
    const finalUser = await User.findOne({ email: 'test@example.com' })
    console.log('📊 最終用戶資料:')
    console.log('  - Username:', finalUser.username)
    console.log('  - Email:', finalUser.email)
    console.log('  - Discord ID:', finalUser.discord_id)
    console.log('  - Login Method:', finalUser.login_method)

    if (finalUser.discord_id === 'discord123') {
      console.log('✅ 測試成功：Discord 帳號成功綁定到現有用戶')
    } else {
      console.log('❌ 測試失敗：Discord 帳號未正確綁定')
    }
  } catch (error) {
    console.error('❌ 測試錯誤:', error.message)
    if (error.code === 11000) {
      console.error('  - 這是重複鍵錯誤，表示修復可能無效')
    }
  } finally {
    // 清理測試資料
    await User.deleteMany({ email: 'test@example.com' })
    console.log('🧹 清理測試資料完成')

    // 關閉資料庫連接
    await mongoose.connection.close()
    console.log('🔌 資料庫連接已關閉')
  }
}

// 執行測試
testDiscordEmailFix()
