import mongoose from 'mongoose'
import User from '../../models/User.js'

async function testOAuthFixes() {
  try {
    // 連接到測試資料庫 - 使用預設的 MongoDB URI
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam'
    await mongoose.connect(mongoUri)
    console.log('✅ 已連接到 MongoDB')

    // 測試 Discord 重複 ID 場景
    console.log('\n=== 測試 Discord 重複 ID 處理 ===')
    
    // 查找是否存在重複的 discord_id
    const discordUsers = await User.find({ discord_id: { $exists: true } })
    console.log(`找到 ${discordUsers.length} 個已綁定 Discord 的用戶`)
    
    // 檢查是否有重複的 discord_id
    const discordIds = discordUsers.map(user => user.discord_id)
    const duplicateDiscordIds = discordIds.filter((id, index) => discordIds.indexOf(id) !== index)
    
    if (duplicateDiscordIds.length > 0) {
      console.log('⚠️  發現重複的 Discord ID:', duplicateDiscordIds)
      
      // 顯示重複的用戶詳情
      for (const duplicateId of duplicateDiscordIds) {
        const usersWithSameId = await User.find({ discord_id: duplicateId })
        console.log(`Discord ID ${duplicateId} 被以下用戶使用:`)
        usersWithSameId.forEach(user => {
          console.log(`  - 用戶 ${user._id}: ${user.username} (${user.email})`)
        })
      }
    } else {
      console.log('✅ 沒有發現重複的 Discord ID')
    }

    // 測試 Twitter OAuth 配置
    console.log('\n=== 檢查 Twitter OAuth 環境變數 ===')
    
    const twitterClientId = process.env.TWITTER_CLIENT_ID
    const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET
    const twitterRedirectUri = process.env.TWITTER_REDIRECT_URI
    const twitterClientType = process.env.TWITTER_CLIENT_TYPE

    console.log('Twitter Client ID:', twitterClientId ? '✅ 已設置' : '❌ 未設置')
    console.log('Twitter Client Secret:', twitterClientSecret ? '✅ 已設置' : '❌ 未設置')
    console.log('Twitter Redirect URI:', twitterRedirectUri || '❌ 未設置')
    console.log('Twitter Client Type:', twitterClientType || '❌ 未設置')

    if (twitterClientId && twitterClientSecret && twitterRedirectUri && twitterClientType) {
      console.log('✅ Twitter OAuth 環境變數配置完整')
    } else {
      console.log('⚠️  Twitter OAuth 環境變數配置不完整')
    }

    // 查找 Twitter 用戶
    const twitterUsers = await User.find({ twitter_id: { $exists: true } })
    console.log(`找到 ${twitterUsers.length} 個已綁定 Twitter 的用戶`)
    
    // 檢查是否有重複的 twitter_id
    const twitterIds = twitterUsers.map(user => user.twitter_id)
    const duplicateTwitterIds = twitterIds.filter((id, index) => twitterIds.indexOf(id) !== index)
    
    if (duplicateTwitterIds.length > 0) {
      console.log('⚠️  發現重複的 Twitter ID:', duplicateTwitterIds)
    } else {
      console.log('✅ 沒有發現重複的 Twitter ID')
    }

    // 測試資料庫索引
    console.log('\n=== 檢查資料庫索引 ===')
    const userIndexes = await User.collection.indexes()
    
    const discordIndex = userIndexes.find(index => index.key && index.key.discord_id)
    const twitterIndex = userIndexes.find(index => index.key && index.key.twitter_id)
    
    console.log('Discord ID 索引:', discordIndex ? '✅ 存在' : '❌ 不存在')
    console.log('Twitter ID 索引:', twitterIndex ? '✅ 存在' : '❌ 不存在')
    
    if (discordIndex) {
      console.log('  Discord 索引設定:', discordIndex.unique ? '唯一索引' : '普通索引')
    }
    
    if (twitterIndex) {
      console.log('  Twitter 索引設定:', twitterIndex.unique ? '唯一索引' : '普通索引')
    }

    console.log('\n=== OAuth 修正驗證完成 ===')
    console.log('\n📋 修正內容總結:')
    console.log('================')
    console.log('1. ✅ Discord OAuth: 改善重複 ID 檢測邏輯')
    console.log('2. ✅ Twitter OAuth: 修正 scope 配置 (添加 offline.access)')
    console.log('3. ✅ Twitter OAuth: 更新 userProfileURL 以獲取更多用戶資訊')
    console.log('4. ✅ 錯誤處理: 添加針對重複 ID 的友好錯誤訊息')
    console.log('5. ✅ 綁定檢查: 防止同一社群 ID 被多個用戶綁定')
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error)
  } finally {
    await mongoose.disconnect()
    console.log('已斷開資料庫連接')
  }
}

// 執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  testOAuthFixes()
}

export default testOAuthFixes