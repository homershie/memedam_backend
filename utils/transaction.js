import mongoose from 'mongoose'

/**
 * 執行資料庫事務
 * @param {Function} operations - 要執行的操作函數
 * @param {Object} options - 事務選項
 * @returns {Promise} 事務結果
 */
export const executeTransaction = async (operations, options = {}) => {
  // 測試環境下不啟用 transaction，避免記憶體 MongoDB 與偽 session 造成 500
  if (process.env.NODE_ENV === 'test') {
    return operations(null)
  }
  const session = await mongoose.startSession()

  try {
    session.startTransaction(options)

    // 執行操作
    const result = await operations(session)

    // 提交事務
    await session.commitTransaction()

    return result
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    throw error
  } finally {
    // 結束會話
    session.endSession()
  }
}

/**
 * 安全地執行可能失敗的操作，使用事務確保一致性
 * @param {Function} operation - 要執行的操作
 * @param {Function} rollback - 回滾操作（可選）
 * @returns {Promise} 操作結果
 */
export const safeExecute = async (operation, rollback = null) => {
  try {
    return await operation()
  } catch (error) {
    if (rollback) {
      try {
        await rollback()
      } catch (rollbackError) {
        console.error('回滾操作失敗:', rollbackError)
      }
    }
    throw error
  }
}

/**
 * 批次執行事務操作
 * @param {Array} operations - 操作陣列
 * @param {number} batchSize - 批次大小
 * @returns {Promise} 批次執行結果
 */
export const batchTransaction = async (operations, batchSize = 10) => {
  const results = {
    total: operations.length,
    success: 0,
    failed: 0,
    errors: [],
  }

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize)

    try {
      await executeTransaction(async (session) => {
        const batchResults = await Promise.allSettled(batch.map((operation) => operation(session)))

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.success++
          } else {
            results.failed++
            results.errors.push({
              index: i + index,
              error: result.reason.message,
            })
          }
        })
      })
    } catch (error) {
      results.failed += batch.length
      results.errors.push({
        batch: Math.floor(i / batchSize),
        error: error.message,
      })
    }
  }

  return results
}
