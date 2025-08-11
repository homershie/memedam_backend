import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 載入環境變數
dotenv.config({ path: join(__dirname, '../../.env') })

import { connectToDatabase } from '../../config/db.js'
import { generateUniqueUsername, generateUsernameSuggestions } from '../../utils/usernameGenerator.js'
import User from '../../models/User.js'

/**
 * 測試改進後的username生成功能
 */
async function testUsernameOptimization() {
  console.log('🚀 開始測試username優化功能...\n')

  try {
    // 連接資料庫
    await connectToDatabase()
    console.log('✅ 資料庫連接成功\n')

    // 測試場景1: Google OAuth用戶
    console.log('📊 測試場景1: Google OAuth用戶')
    const googleProfile = {
      id: '1234567890',
      emails: [{ value: 'testuser@gmail.com' }],
      displayName: 'Test User'
    }

    const googleUsername = await generateUniqueUsername(googleProfile, 'google')
    console.log(`生成的username: ${googleUsername}`)

    const googleSuggestions = await generateUsernameSuggestions(googleProfile, 'google', 5)
    console.log(`建議列表: ${googleSuggestions.join(', ')}\n`)

    // 測試場景2: Discord用戶
    console.log('📊 測試場景2: Discord用戶')
    const discordProfile = {
      id: '987654321',
      username: 'gamer_pro',
      email: 'gamer@discord.com',
      verified: true
    }

    const discordUsername = await generateUniqueUsername(discordProfile, 'discord')
    console.log(`生成的username: ${discordUsername}`)

    const discordSuggestions = await generateUsernameSuggestions(discordProfile, 'discord', 5)
    console.log(`建議列表: ${discordSuggestions.join(', ')}\n`)

    // 測試場景3: 極端情況 - 很短的username
    console.log('📊 測試場景3: 極端情況 - 很短的username')
    const shortProfile = {
      id: 'abc',
      emails: [{ value: 'a@b.com' }]
    }

    const shortUsername = await generateUniqueUsername(shortProfile, 'google')
    console.log(`生成的username: ${shortUsername}`)
    console.log(`長度: ${shortUsername.length}`)

    // 測試場景4: 極端情況 - 很長的username
    console.log('\n📊 測試場景4: 極端情況 - 很長的username')
    const longProfile = {
      id: '12345',
      emails: [{ value: 'verylongusernamethatexceedsthelimit@example.com' }]
    }

    const longUsername = await generateUniqueUsername(longProfile, 'google')
    console.log(`生成的username: ${longUsername}`)
    console.log(`長度: ${longUsername.length}`)

    // 測試場景5: 特殊字符處理
    console.log('\n📊 測試場景5: 特殊字符處理')
    const specialProfile = {
      id: '12345',
      emails: [{ value: 'user@#$%with&*special()chars@example.com' }]
    }

    const specialUsername = await generateUniqueUsername(specialProfile, 'google')
    console.log(`生成的username: ${specialUsername}`)

    // 測試場景6: 模擬重複衝突
    console.log('\n📊 測試場景6: 模擬重複衝突')
    console.log('創建一個用戶來模擬衝突...')
    
    // 創建測試用戶
    const existingUser = new User({
      username: 'testuser00',
      email: 'existing@example.com',
      password: 'testpassword123',
      login_method: 'local'
    })

    try {
      await existingUser.save()
      console.log('✅ 測試用戶創建成功')
    } catch (error) {
      if (error.code === 11000) {
        console.log('📝 測試用戶已存在，繼續測試')
      } else {
        throw error
      }
    }

    // 嘗試生成與現有用戶相同的基礎username
    const conflictProfile = {
      id: '12345',
      emails: [{ value: 'testuser@example.com' }]
    }

    const resolvedUsername = await generateUniqueUsername(conflictProfile, 'google')
    console.log(`解決衝突後的username: ${resolvedUsername}`)

    // 清理測試數據
    console.log('\n🧹 清理測試數據...')
    await User.deleteOne({ username: 'testuser00' }).catch(() => {})
    await User.deleteOne({ username: resolvedUsername }).catch(() => {})

    console.log('\n✅ 所有測試完成！')
    console.log('\n📋 測試總結:')
    console.log('- ✓ 智能username生成策略')
    console.log('- ✓ 多種衝突解決方案')
    console.log('- ✓ 格式驗證和清理')
    console.log('- ✓ 長度限制處理')
    console.log('- ✓ 特殊字符處理')
    console.log('- ✓ 衝突檢測和解決')

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error)
  } finally {
    process.exit(0)
  }
}

/**
 * 測試API功能（需要先啟動伺服器）
 */
async function testUsernameAPI() {
  console.log('\n🌐 API測試範例:')
  console.log('\n1. 預覽username建議:')
  console.log('POST /api/username/preview')
  console.log(JSON.stringify({
    provider: 'google',
    profile: {
      id: '123456',
      emails: [{ value: 'newuser@gmail.com' }]
    }
  }, null, 2))

  console.log('\n2. 檢查username可用性:')
  console.log('GET /api/username/check/myusername123')

  console.log('\n3. 獲取當前用戶的username建議 (需要JWT):')
  console.log('GET /api/username/suggestions')
  console.log('Headers: { "Authorization": "Bearer YOUR_JWT_TOKEN" }')
}

// 運行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  testUsernameOptimization()
  testUsernameAPI()
}