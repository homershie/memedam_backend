/**
 * 測試推薦排序邏輯
 */

import {
  getMixedRecommendations,
  clearMixedRecommendationCache,
} from '../utils/mixedRecommendation.js'

const testSorting = async () => {
  try {
    console.log('🧪 開始測試推薦排序邏輯...')

    // 清除所有快取
    console.log('🗑️ 清除所有快取...')
    await clearMixedRecommendationCache()

    // 測試混合推薦
    console.log('📊 測試混合推薦排序...')
    const result = await getMixedRecommendations(null, {
      limit: 10,
      page: 1,
      useCache: false, // 不使用快取，直接計算
    })

    console.log('📋 推薦結果:')
    result.recommendations.forEach((rec, index) => {
      console.log(
        `${index + 1}. ID: ${rec._id}, 總分: ${rec.total_score}, 類型: ${rec.recommendation_type}`,
      )
    })

    // 檢查排序是否正確
    let isCorrectlySorted = true
    for (let i = 1; i < result.recommendations.length; i++) {
      if (result.recommendations[i].total_score > result.recommendations[i - 1].total_score) {
        isCorrectlySorted = false
        console.log(
          `❌ 排序錯誤: 第${i + 1}項分數(${result.recommendations[i].total_score}) > 第${i}項分數(${result.recommendations[i - 1].total_score})`,
        )
        break
      }
    }

    if (isCorrectlySorted) {
      console.log('✅ 排序正確！最高分的項目在最前面')
    } else {
      console.log('❌ 排序有問題！')
    }

    console.log('📊 測試結果摘要:')
    console.log(`- 總推薦數: ${result.recommendations.length}`)
    console.log(`- 最高分: ${result.recommendations[0]?.total_score || 'N/A'}`)
    console.log(
      `- 最低分: ${result.recommendations[result.recommendations.length - 1]?.total_score || 'N/A'}`,
    )
    console.log(`- 排序正確: ${isCorrectlySorted}`)
  } catch (error) {
    console.error('❌ 測試失敗:', error)
  }
}

// 執行測試
testSorting()
