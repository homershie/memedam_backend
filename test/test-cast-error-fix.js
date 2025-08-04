import mongoose from 'mongoose'
import { buildSocialGraph } from '../utils/collaborativeFiltering.js'
import { buildSocialGraph as buildSocialGraph2 } from '../utils/socialScoreCalculator.js'

// 測試用的 ObjectId
const testUserId = new mongoose.Types.ObjectId('687f444578307472f73aeffa')

async function testCastErrorFix() {
  try {
    console.log('開始測試 CastError 修復...')

    // 測試協同過濾模組的 buildSocialGraph
    console.log('測試協同過濾模組的 buildSocialGraph...')
    await buildSocialGraph([testUserId])
    console.log('協同過濾模組 buildSocialGraph 測試成功')

    // 測試社交分數計算器模組的 buildSocialGraph
    console.log('測試社交分數計算器模組的 buildSocialGraph...')
    await buildSocialGraph2([testUserId])
    console.log('社交分數計算器模組 buildSocialGraph 測試成功')

    console.log('所有 CastError 修復測試通過！')
    return true
  } catch (error) {
    console.error('測試失敗:', error.message)
    console.error('錯誤堆疊:', error.stack)
    return false
  }
}

// 執行測試
testCastErrorFix().then((success) => {
  if (success) {
    console.log('✅ CastError 修復驗證成功')
  } else {
    console.log('❌ CastError 修復驗證失敗')
  }
  process.exit(success ? 0 : 1)
})
