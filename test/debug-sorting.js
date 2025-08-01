const fetch = require('node-fetch')

async function debugSorting() {
  const baseUrl = 'http://localhost:3000'

  console.log('=== 開始調試推薦排序問題 ===\n')

  try {
    // 1. 清除快取並獲取第一頁
    console.log('1. 清除快取並獲取第一頁推薦...')
    const clearCacheResponse = await fetch(
      `${baseUrl}/api/recommendations/mixed?clear_cache=true&limit=10`,
    )
    const clearCacheData = await clearCacheResponse.json()

    if (!clearCacheData.success) {
      console.error('❌ 清除快取失敗:', clearCacheData)
      return
    }

    console.log('✅ 快取清除成功')
    console.log(`📊 獲取到 ${clearCacheData.data.recommendations.length} 個推薦`)

    // 檢查排序
    const recommendations = clearCacheData.data.recommendations
    console.log('\n📈 排序檢查:')
    console.log('前 5 個推薦的 total_score:')
    recommendations.slice(0, 5).forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 檢查是否有排序問題
    let isSorted = true
    for (let i = 1; i < recommendations.length; i++) {
      if (recommendations[i].total_score > recommendations[i - 1].total_score) {
        isSorted = false
        console.log(
          `❌ 排序錯誤: 索引 ${i - 1} (${recommendations[i - 1].total_score}) < 索引 ${i} (${recommendations[i].total_score})`,
        )
        break
      }
    }

    if (isSorted) {
      console.log('✅ 排序正確 (降序)')
    } else {
      console.log('❌ 排序錯誤')
    }

    // 2. 獲取第二頁（不使用 clear_cache）
    console.log('\n2. 獲取第二頁推薦（使用快取）...')
    const secondPageResponse = await fetch(`${baseUrl}/api/recommendations/mixed?page=2&limit=10`)
    const secondPageData = await secondPageResponse.json()

    if (!secondPageData.success) {
      console.error('❌ 獲取第二頁失敗:', secondPageData)
      return
    }

    console.log(`📊 第二頁獲取到 ${secondPageData.data.recommendations.length} 個推薦`)

    // 檢查第二頁排序
    const secondPageRecommendations = secondPageData.data.recommendations
    console.log('\n📈 第二頁排序檢查:')
    console.log('第二頁推薦的 total_score:')
    secondPageRecommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 3. 檢查分頁資訊
    console.log('\n📄 分頁資訊:')
    console.log('第一頁:', clearCacheData.data.pagination)
    console.log('第二頁:', secondPageData.data.pagination)

    // 4. 檢查演算法權重
    console.log('\n⚖️ 演算法權重:')
    console.log(clearCacheData.data.weights)

    // 5. 檢查冷啟動狀態
    console.log('\n❄️ 冷啟動狀態:')
    console.log(clearCacheData.data.cold_start_status)

    // 6. 檢查演算法分數
    console.log('\n🔍 前 3 個推薦的詳細分數:')
    recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`\n推薦 ${index + 1}:`)
      console.log(`  ID: ${rec._id}`)
      console.log(`  總分: ${rec.total_score}`)
      console.log(`  演算法分數:`, rec.algorithm_scores || {})
      console.log(`  推薦類型: ${rec.recommendation_type || 'N/A'}`)
    })

    // 7. 測試不同的 limit 參數
    console.log('\n3. 測試不同的 limit 參數...')
    const limit5Response = await fetch(
      `${baseUrl}/api/recommendations/mixed?clear_cache=true&limit=5`,
    )
    const limit5Data = await limit5Response.json()

    if (limit5Data.success) {
      console.log(`📊 limit=5 獲取到 ${limit5Data.data.recommendations.length} 個推薦`)
      console.log('前 5 個推薦的 total_score:')
      limit5Data.data.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec._id} - total_score: ${rec.total_score}`)
      })
    }

    console.log('\n=== 調試完成 ===')
  } catch (error) {
    console.error('❌ 調試過程中發生錯誤:', error)
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  debugSorting()
}

module.exports = { debugSorting }
