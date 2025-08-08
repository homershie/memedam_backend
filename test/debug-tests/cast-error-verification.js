import mongoose from 'mongoose'
import { buildSocialGraph } from '../utils/collaborativeFiltering.js'
import { buildSocialGraph as buildSocialGraph2 } from '../utils/socialScoreCalculator.js'

// 連接到資料庫
await import('../config/db.js')

const testUserId = new mongoose.Types.ObjectId('687f444578307472f73aeffa')

async function testCastErrorFix() {
  try {
    console.log('開始測試 CastError 修復...')

    // 測試協同過濾模組的 buildSocialGraph
    console.log('測試協同過濾模組的 buildSocialGraph...')
    const socialGraph1 = await buildSocialGraph([testUserId])
    console.log('協同過濾模組 buildSocialGraph 測試成功')
    console.log('返回的社交圖譜:', Object.keys(socialGraph1).length, '個用戶')

    // 測試社交分數計算器模組的 buildSocialGraph
    console.log('測試社交分數計算器模組的 buildSocialGraph...')
    const socialGraph2 = await buildSocialGraph2([testUserId])
    console.log('社交分數計算器模組 buildSocialGraph 測試成功')
    console.log('返回的社交圖譜:', Object.keys(socialGraph2).length, '個用戶')

    console.log('所有 CastError 修復測試通過！')
    return true
  } catch (error) {
    console.error('測試失敗:', error.message)
    console.error('錯誤堆疊:', error.stack)
    return false
  } finally {
    // 關閉資料庫連接
    await mongoose.connection.close()
  }
}

testCastErrorFix().then((success) => {
  if (success) {
    console.log('✅ CastError 修復驗證成功')
  } else {
    console.log('❌ CastError 修復驗證失敗')
  }
  process.exit(success ? 0 : 1)
})
