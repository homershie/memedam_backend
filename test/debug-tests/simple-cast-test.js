import mongoose from 'mongoose'

const testUserId = new mongoose.Types.ObjectId('687f444578307472f73aeffa')

async function testObjectIdHandling() {
  try {
    console.log('開始測試 ObjectId 處理...')

    // 測試 ObjectId 數組處理
    console.log('測試 ObjectId 數組處理...')

    // 創建測試用的 ObjectId 數組
    const testUserIds = [testUserId]

    // 測試這些 ObjectId 是否可以被正確處理
    for (const userId of testUserIds) {
      console.log(`測試 ObjectId: ${userId} (類型: ${typeof userId})`)

      if (!(userId instanceof mongoose.Types.ObjectId)) {
        throw new Error(`userId 不是 ObjectId 實例: ${typeof userId}`)
      }

      // 測試 toString 方法
      const userIdStr = userId.toString()
      console.log(`轉換為字符串: ${userIdStr}`)

      // 測試從字符串創建 ObjectId
      const newObjectId = new mongoose.Types.ObjectId(userIdStr)
      console.log(`從字符串創建 ObjectId: ${newObjectId}`)

      if (!newObjectId.equals(userId)) {
        throw new Error('ObjectId 轉換不一致')
      }
    }

    console.log('✅ ObjectId 處理測試通過')
    return true
  } catch (error) {
    console.error('測試失敗:', error.message)
    console.error('錯誤堆疊:', error.stack)
    return false
  }
}

testObjectIdHandling().then((success) => {
  if (success) {
    console.log('✅ ObjectId 處理驗證成功')
  } else {
    console.log('❌ ObjectId 處理驗證失敗')
  }
  process.exit(success ? 0 : 1)
})
