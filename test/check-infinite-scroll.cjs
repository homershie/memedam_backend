const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

async function checkInfiniteScroll() {
  console.log('=== 檢查無限滾動 API ===\n')

  try {
    const baseUrl = 'http://localhost:4000'

    // 測試無限滾動 API
    console.log('1. 測試無限滾動 API...')
    const response = await fetch(
      `${baseUrl}/api/recommendations/infinite-scroll?clear_cache=true&limit=10`,
    )

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

    // 檢查排序
    console.log('\n📊 無限滾動 API 數據:')
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ID: ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 檢查目標 ID
    const targetId = '68881ac39383b508e4ac0640'
    const targetIndex = recommendations.findIndex((rec) => rec._id === targetId)
    console.log(`\n🎯 目標 ID ${targetId} 在無限滾動數據中的位置: ${targetIndex + 1}`)

    if (targetIndex !== -1) {
      console.log(`該推薦的 total_score: ${recommendations[targetIndex].total_score}`)
      console.log(`該推薦的 hot_score: ${recommendations[targetIndex].hot_score || 'N/A'}`)
    }

    // 檢查分頁信息
    console.log('\n📄 分頁信息:')
    console.log(data.data.pagination)

    // 測試第二頁
    console.log('\n2. 測試第二頁...')
    const response2 = await fetch(`${baseUrl}/api/recommendations/infinite-scroll?page=2&limit=10`)

    if (response2.ok) {
      const data2 = await response2.json()
      if (data2.success) {
        console.log(`✅ 第二頁獲取到 ${data2.data.recommendations.length} 個推薦`)
        console.log('第二頁分頁信息:', data2.data.pagination)
      }
    }

    console.log('\n=== 檢查完成 ===')
  } catch (error) {
    console.error('❌ 檢查失敗:', error.message)
  }
}

// 運行檢查
checkInfiniteScroll()
