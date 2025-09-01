/**
 * 測試熱門分數更新功能
 * 用於驗證修復後的熱門分數更新是否正常工作
 */

import { batchUpdateHotScores } from '../utils/hotScoreScheduler.js'
import { checkDatabaseConnection } from '../utils/dbHealthCheck.js'

/**
 * 測試熱門分數更新
 */
async function testHotScoreUpdate() {
  try {
    console.log('🧪 開始測試熱門分數更新功能...')

    // 1. 檢查資料庫連線
    console.log('📊 檢查資料庫連線狀態...')
    const dbStatus = await checkDatabaseConnection()
    if (!dbStatus.success) {
      console.error('❌ 資料庫連線檢查失敗:', dbStatus.message)
      return
    }
    console.log('✅ 資料庫連線正常')

    // 2. 測試小批次更新
    console.log('🔄 測試小批次熱門分數更新...')
    const smallBatchResult = await batchUpdateHotScores({
      limit: 10,
      force: false,
      batchSize: 5,
    })

    console.log('📈 小批次更新結果:', {
      success: smallBatchResult.success,
      updated_count: smallBatchResult.updated_count,
      error_count: smallBatchResult.error_count,
      message: smallBatchResult.message,
    })

    if (smallBatchResult.success) {
      console.log('✅ 小批次更新測試成功')
    } else {
      console.error('❌ 小批次更新測試失敗')
    }

    // 3. 如果有錯誤，顯示詳細資訊
    if (smallBatchResult.error_count > 0) {
      console.log('⚠️ 發現錯誤，詳細資訊:')
      smallBatchResult.errors.forEach((error, index) => {
        console.log(`  錯誤 ${index + 1}:`, {
          meme_id: error.meme_id,
          error: error.error,
          batch_error: error.batch_error,
        })
      })
    }

    // 4. 測試強制更新（如果小批次成功）
    if (smallBatchResult.success && smallBatchResult.error_count === 0) {
      console.log('🔄 測試強制更新模式...')
      const forceUpdateResult = await batchUpdateHotScores({
        limit: 5,
        force: true,
        batchSize: 3,
      })

      console.log('📈 強制更新結果:', {
        success: forceUpdateResult.success,
        updated_count: forceUpdateResult.updated_count,
        error_count: forceUpdateResult.error_count,
        message: forceUpdateResult.message,
      })

      if (forceUpdateResult.success) {
        console.log('✅ 強制更新測試成功')
      } else {
        console.error('❌ 強制更新測試失敗')
      }
    }

    console.log('🎉 熱門分數更新功能測試完成')
  } catch (error) {
    console.error('💥 測試過程中發生錯誤:', {
      message: error.message,
      stack: error.stack,
    })
  }
}

/**
 * 主函數
 */
async function main() {
  try {
    await testHotScoreUpdate()
  } catch (error) {
    console.error('主程式執行失敗:', error)
    process.exit(1)
  } finally {
    // 等待日誌輸出完成後退出
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { testHotScoreUpdate }
