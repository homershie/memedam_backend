/**
 * API 測試腳本
 * 測試混合推薦的排序
 */

const testAPI = async () => {
  try {
    console.log('🧪 測試混合推薦 API...')

    // 測試清除快取
    console.log('🗑️ 清除快取...')
    const clearResponse = await fetch(
      'http://localhost:3000/api/recommendations/mixed?clear_cache=true&limit=5',
    )
    const clearData = await clearResponse.json()
    console.log('清除快取結果:', clearData.success)

    // 等待一下
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 測試正常推薦
    console.log('📊 測試正常推薦...')
    const response = await fetch('http://localhost:3000/api/recommendations/mixed?limit=5')
    const data = await response.json()

    if (data.success && data.data.recommendations) {
      console.log('📋 推薦結果:')
      data.data.recommendations.forEach((rec, index) => {
        console.log(
          `${index + 1}. ID: ${rec._id}, 總分: ${rec.total_score}, 類型: ${rec.recommendation_type}`,
        )
      })

      // 檢查排序
      let isCorrectlySorted = true
      for (let i = 1; i < data.data.recommendations.length; i++) {
        if (
          data.data.recommendations[i].total_score > data.data.recommendations[i - 1].total_score
        ) {
          isCorrectlySorted = false
          console.log(
            `❌ 排序錯誤: 第${i + 1}項分數(${data.data.recommendations[i].total_score}) > 第${i}項分數(${data.data.recommendations[i - 1].total_score})`,
          )
          break
        }
      }

      if (isCorrectlySorted) {
        console.log('✅ 排序正確！最高分的項目在最前面')
      } else {
        console.log('❌ 排序有問題！')
      }
    } else {
      console.log('❌ API 回應錯誤:', data)
    }
  } catch (error) {
    console.error('❌ 測試失敗:', error)
  }
}

// 執行測試
testAPI()
