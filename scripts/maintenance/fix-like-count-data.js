/**
 * 修復 like_count 數據錯誤腳本
 * 檢查並修復數據庫中 like_count 字段被錯誤設置為查詢物件的問題
 */

import mongoose from 'mongoose'
import Meme from '../../models/Meme.js'
import Like from '../../models/Like.js'
import { loadEnv } from '../../config/loadEnv.js'
import { logger } from '../../utils/logger.js'

// 加載環境變數
loadEnv()

/**
 * 檢查 like_count 字段的數據類型
 */
const checkLikeCountDataTypes = async () => {
  try {
    console.log('🔍 檢查 like_count 字段數據類型...')

    // 查詢所有 like_count 不是數值的記錄
    const invalidMemes = await Meme.find({
      like_count: { $type: ['object', 'string'] }, // 物件或字串類型
      status: { $ne: 'deleted' },
    })
      .select('_id title like_count')
      .limit(50)

    console.log(`找到 ${invalidMemes.length} 個 like_count 類型不正確的迷因`)

    if (invalidMemes.length > 0) {
      console.log('\n📋 問題記錄範例:')
      invalidMemes.slice(0, 5).forEach((meme, index) => {
        console.log(
          `  ${index + 1}. ID: ${meme._id}, 標題: ${meme.title}, like_count: ${JSON.stringify(meme.like_count)} (類型: ${typeof meme.like_count})`,
        )
      })
    }

    return invalidMemes
  } catch (error) {
    console.error('檢查 like_count 數據類型失敗:', error)
    throw error
  }
}

/**
 * 計算迷因的實際按讚數量
 * @param {string} memeId - 迷因ID
 * @returns {number} 實際按讚數量
 */
const calculateActualLikeCount = async (memeId) => {
  try {
    const actualCount = await Like.countDocuments({
      meme_id: memeId,
      status: { $ne: 'deleted' },
    })
    return actualCount
  } catch (error) {
    console.error(`計算迷因 ${memeId} 的實際按讚數失敗:`, error)
    return 0
  }
}

/**
 * 修復單個迷因的 like_count
 * @param {Object} meme - 迷因文件
 */
const fixMemeLikeCount = async (meme) => {
  try {
    const actualCount = await calculateActualLikeCount(meme._id)

    // 更新迷因的 like_count
    await Meme.updateOne({ _id: meme._id }, { $set: { like_count: actualCount } })

    console.log(`✅ 修復迷因 ${meme._id}: ${meme.like_count} → ${actualCount}`)
    return { success: true, memeId: meme._id, oldCount: meme.like_count, newCount: actualCount }
  } catch (error) {
    console.error(`❌ 修復迷因 ${meme._id} 失敗:`, error)
    return { success: false, memeId: meme._id, error: error.message }
  }
}

/**
 * 批量修復 like_count 錯誤的記錄
 * @param {Array} invalidMemes - 包含錯誤 like_count 的迷因陣列
 * @param {number} batchSize - 批次大小
 */
const batchFixLikeCountData = async (invalidMemes, batchSize = 10) => {
  console.log(`\n🔧 開始批量修復 ${invalidMemes.length} 個記錄...`)

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  }

  // 分批處理
  for (let i = 0; i < invalidMemes.length; i += batchSize) {
    const batch = invalidMemes.slice(i, i + batchSize)
    console.log(
      `\n📦 處理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(invalidMemes.length / batchSize)}`,
    )

    const batchPromises = batch.map((meme) => fixMemeLikeCount(meme))
    const batchResults = await Promise.allSettled(batchPromises)

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.success++
        } else {
          results.failed++
          results.errors.push(result.value)
        }
      } else {
        results.failed++
        results.errors.push({
          memeId: batch[index]._id,
          error: result.reason.message,
        })
      }
    })

    // 批次間稍作休息，避免數據庫壓力過大
    if (i + batchSize < invalidMemes.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return results
}

/**
 * 檢查所有計數字段的數據完整性
 */
const checkAllCountFields = async () => {
  try {
    console.log('\n🔍 檢查所有計數字段的數據類型...')

    const countFields = [
      'like_count',
      'dislike_count',
      'comment_count',
      'view_count',
      'collection_count',
      'share_count',
    ]
    const issues = {}

    for (const field of countFields) {
      const invalidRecords = await Meme.find({
        [field]: { $type: ['object', 'string'] },
        status: { $ne: 'deleted' },
      })
        .select(`_id title ${field}`)
        .limit(10)

      if (invalidRecords.length > 0) {
        issues[field] = invalidRecords.length
        console.log(`⚠️  ${field}: 找到 ${invalidRecords.length} 個類型錯誤的記錄`)
      } else {
        console.log(`✅ ${field}: 數據類型正常`)
      }
    }

    return issues
  } catch (error) {
    console.error('檢查計數字段失敗:', error)
    throw error
  }
}

/**
 * 主要執行函數
 */
const main = async () => {
  try {
    console.log('🚀 開始 like_count 數據修復任務...\n')
    console.log('📊 環境變數檢查:')
    const envVarsToCheck = ['MONGO_URI', 'MONGODB_URI', 'MONGO_DEV_URI', 'MONGO_PROD_URI']
    envVarsToCheck.forEach((envVar) => {
      console.log(`${envVar}: ${process.env[envVar] ? '已設定' : '未設定'}`)
    })

    // 連接到數據庫
    // 檢查多個可能的環境變數名稱
    let mongoUri = null

    for (const envVar of envVarsToCheck) {
      if (process.env[envVar]) {
        mongoUri = process.env[envVar]
        console.log(`✅ 使用環境變數: ${envVar}`)
        break
      }
    }

    // 如果沒有找到任何 MongoDB 環境變數，使用本地
    if (!mongoUri) {
      mongoUri = 'mongodb://localhost:27017/memedam'
      console.log('⚠️  未找到 MongoDB 環境變數，使用本地 MongoDB')
    }

    // 顯示連接信息（隱藏密碼）
    const displayUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
    console.log(`🔗 嘗試連接到: ${displayUri}`)

    const connectionOptions = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }

    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000, // 5秒超時
        socketTimeoutMS: 45000, // 45秒超時
      })
      console.log('✅ 數據庫連接成功')
    } catch (error) {
      console.error('❌ 數據庫連接失敗:', error.message)
      console.log('\n💡 請檢查:')
      console.log('1. MongoDB 服務器是否運行')
      console.log('2. MONGODB_URI 環境變數是否正確設定')
      console.log('3. 網路連接是否正常')
      throw error
    }

    // 1. 檢查 like_count 數據類型
    const invalidMemes = await checkLikeCountDataTypes()

    if (invalidMemes.length === 0) {
      console.log('\n🎉 沒有發現 like_count 數據類型問題！')
      await mongoose.connection.close()
      return
    }

    // 2. 檢查所有計數字段
    const allIssues = await checkAllCountFields()

    // 3. 修復 like_count 問題
    console.log('\n' + '='.repeat(50))
    const fixResults = await batchFixLikeCountData(invalidMemes, 20)

    // 4. 輸出修復結果
    console.log('\n' + '='.repeat(50))
    console.log('📊 修復結果總結:')
    console.log(`✅ 成功修復: ${fixResults.success} 個記錄`)
    console.log(`❌ 修復失敗: ${fixResults.failed} 個記錄`)

    if (fixResults.errors.length > 0) {
      console.log('\n❌ 失敗詳情:')
      fixResults.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. 迷因 ${error.memeId}: ${error.error}`)
      })
    }

    // 5. 再次檢查修復結果
    console.log('\n🔍 驗證修復結果...')
    const remainingIssues = await checkLikeCountDataTypes()

    if (remainingIssues.length === 0) {
      console.log('🎉 所有 like_count 問題已修復！')
    } else {
      console.log(`⚠️  仍有 ${remainingIssues.length} 個問題需要手動處理`)
    }

    console.log('\n✅ 數據修復任務完成')
  } catch (error) {
    console.error('❌ 數據修復任務失敗:', error)
  } finally {
    // 關閉數據庫連接
    try {
      await mongoose.connection.close()
      console.log('🔌 數據庫連接已關閉')
    } catch (error) {
      console.error('關閉數據庫連接失敗:', error)
    }
  }
}

// 調試信息
console.log('🔍 調試信息:')
console.log(`process.argv[1]: ${process.argv[1]}`)
console.log(`import.meta.url: ${import.meta.url}`)
console.log(`__filename: ${import.meta.filename || 'undefined'}`)

// 只有在直接執行時才運行主函數
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
  process.argv[1] === import.meta.url.replace('file://', '') ||
  (process.argv[1] && process.argv[1].includes('fix-like-count-data.js'))

console.log(`isMainModule: ${isMainModule}`)

if (isMainModule) {
  console.log('🚀 執行主函數...')
  main().catch(console.error)
} else {
  console.log('⚠️  腳本作為模塊載入，跳過主函數執行')
}

export {
  checkLikeCountDataTypes,
  calculateActualLikeCount,
  fixMemeLikeCount,
  batchFixLikeCountData,
  checkAllCountFields,
  main,
}
