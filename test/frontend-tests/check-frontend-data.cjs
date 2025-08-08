const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

async function checkFrontendData() {
  console.log('=== 檢查前端數據處理 ===\n')

  try {
    const baseUrl = 'http://localhost:4000'

    // 獲取推薦數據
    console.log('1. 獲取推薦數據...')
    const response = await fetch(`${baseUrl}/api/recommendations/mixed?clear_cache=true&limit=10`)

    if (!response.ok) {
      console.error(`❌ HTTP 錯誤: ${response.status} ${response.statusText}`)
      return
    }

    const data = await response.json()

    if (!data.success) {
      console.error('❌ API 響應錯誤:', data)
      return
    }

    const recommendations = data.data.recommendations
    console.log(`✅ 獲取到 ${recommendations.length} 個推薦`)

    // 檢查原始數據
    console.log('\n📊 原始 API 數據 (按 total_score 排序):')
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ID: ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 模擬前端可能的數據處理
    console.log('\n🔍 模擬前端數據處理...')

    // 1. 檢查是否有額外的排序邏輯
    console.log('\n1. 檢查是否有額外的排序邏輯:')
    const sortedByScore = [...recommendations].sort((a, b) => b.total_score - a.total_score)
    const isAlreadySorted = JSON.stringify(recommendations) === JSON.stringify(sortedByScore)
    console.log(`原始數據是否已按 total_score 排序: ${isAlreadySorted ? '✅ 是' : '❌ 否'}`)

    // 2. 檢查是否有其他排序字段
    console.log('\n2. 檢查其他可能的排序字段:')
    const firstRec = recommendations[0]
    if (firstRec) {
      console.log('第一個推薦的字段:')
      Object.keys(firstRec).forEach((key) => {
        if (typeof firstRec[key] === 'number') {
          console.log(`  ${key}: ${firstRec[key]}`)
        }
      })
    }

    // 3. 模擬前端可能的排序邏輯
    console.log('\n3. 模擬不同的排序邏輯:')

    // 按 hot_score 排序
    const sortedByHotScore = [...recommendations].sort(
      (a, b) => (b.hot_score || 0) - (a.hot_score || 0),
    )
    console.log('按 hot_score 排序的前 3 個:')
    sortedByHotScore.slice(0, 3).forEach((rec, index) => {
      console.log(`  ${index + 1}. ID: ${rec._id} - hot_score: ${rec.hot_score || 'N/A'}`)
    })

    // 按 created_at 排序
    const sortedByCreatedAt = [...recommendations].sort(
      (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt),
    )
    console.log('按 created_at 排序的前 3 個:')
    sortedByCreatedAt.slice(0, 3).forEach((rec, index) => {
      console.log(`  ${index + 1}. ID: ${rec._id} - created_at: ${rec.created_at || rec.createdAt}`)
    })

    // 4. 檢查是否有社交分數影響
    console.log('\n4. 檢查社交分數:')
    const hasSocialScore = recommendations.some((rec) => rec.social_score !== undefined)
    console.log(`是否有社交分數: ${hasSocialScore ? '✅ 是' : '❌ 否'}`)

    if (hasSocialScore) {
      const sortedBySocialScore = [...recommendations].sort(
        (a, b) => (b.social_score || 0) - (a.social_score || 0),
      )
      console.log('按 social_score 排序的前 3 個:')
      sortedBySocialScore.slice(0, 3).forEach((rec, index) => {
        console.log(`  ${index + 1}. ID: ${rec._id} - social_score: ${rec.social_score || 'N/A'}`)
      })
    }

    // 5. 檢查分頁信息
    console.log('\n5. 檢查分頁信息:')
    console.log('分頁數據:', data.data.pagination)

    // 6. 檢查演算法分數
    console.log('\n6. 檢查演算法分數:')
    if (recommendations.length > 0) {
      const firstRec = recommendations[0]
      console.log('第一個推薦的演算法分數:', firstRec.algorithm_scores || 'N/A')
    }

    // 7. 模擬前端可能的錯誤排序
    console.log('\n7. 模擬可能的錯誤排序:')

    // 升序排序（錯誤的）
    const ascendingSort = [...recommendations].sort((a, b) => a.total_score - b.total_score)
    console.log('升序排序 (錯誤的) 前 3 個:')
    ascendingSort.slice(0, 3).forEach((rec, index) => {
      console.log(`  ${index + 1}. ID: ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 檢查是否與您提到的問題一致
    const targetId = '68881ac39383b508e4ac0640'
    const targetIndex = recommendations.findIndex((rec) => rec._id === targetId)
    console.log(`\n🎯 目標 ID ${targetId} 在原始數據中的位置: ${targetIndex + 1}`)

    if (targetIndex !== -1) {
      console.log(`該推薦的 total_score: ${recommendations[targetIndex].total_score}`)
      console.log(`該推薦的 hot_score: ${recommendations[targetIndex].hot_score || 'N/A'}`)
      console.log(`該推薦的 social_score: ${recommendations[targetIndex].social_score || 'N/A'}`)
    }

    console.log('\n=== 檢查完成 ===')
  } catch (error) {
    console.error('❌ 檢查失敗:', error.message)
  }
}

// 運行檢查
checkFrontendData()
