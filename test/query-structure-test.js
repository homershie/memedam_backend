import mongoose from 'mongoose'

const testUserId = new mongoose.Types.ObjectId('687f444578307472f73aeffa')

function testQueryStructure() {
  try {
    console.log('開始測試查詢結構...')

    // 測試 ObjectId 數組
    const targetUserIds = [testUserId]
    console.log('targetUserIds:', targetUserIds)
    console.log('targetUserIds 類型:', typeof targetUserIds)
    console.log('targetUserIds[0] 類型:', typeof targetUserIds[0])
    console.log(
      'targetUserIds[0] 是 ObjectId:',
      targetUserIds[0] instanceof mongoose.Types.ObjectId,
    )

    // 構建查詢對象（不實際執行）
    const query = {
      $or: [{ follower_id: { $in: targetUserIds } }, { following_id: { $in: targetUserIds } }],
      status: 'active',
    }

    console.log('查詢對象:', JSON.stringify(query, null, 2))

    // 驗證查詢結構
    if (!Array.isArray(query.$or)) {
      throw new Error('$or 不是數組')
    }

    if (query.$or.length !== 2) {
      throw new Error('$or 應該包含 2 個條件')
    }

    for (const condition of query.$or) {
      if (!condition.follower_id && !condition.following_id) {
        throw new Error('條件缺少 follower_id 或 following_id')
      }

      const field = condition.follower_id || condition.following_id
      if (!field.$in) {
        throw new Error('缺少 $in 操作符')
      }

      if (!Array.isArray(field.$in)) {
        throw new Error('$in 值不是數組')
      }

      for (const id of field.$in) {
        if (!(id instanceof mongoose.Types.ObjectId)) {
          throw new Error(`$in 數組中的元素不是 ObjectId: ${typeof id}`)
        }
      }
    }

    console.log('✅ 查詢結構測試通過')
    return true
  } catch (error) {
    console.error('測試失敗:', error.message)
    console.error('錯誤堆疊:', error.stack)
    return false
  }
}

testQueryStructure()
console.log('✅ 查詢結構驗證成功')
