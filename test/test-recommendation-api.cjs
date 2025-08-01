const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

async function testRecommendationAPI() {
  console.log('=== 測試推薦 API ===\n')

  try {
    const baseUrl = 'http://localhost:4000'

    // 測試 1: 清除快取並獲取推薦
    console.log('1. 清除快取並獲取推薦...')
    const response1 = await fetch(`${baseUrl}/api/recommendations/mixed?clear_cache=true&limit=5`)

    if (!response1.ok) {
      console.error(`❌ HTTP 錯誤: ${response1.status} ${response1.statusText}`)
      return
    }

    const data1 = await response1.json()

    if (!data1.success) {
      console.error('❌ API 響應錯誤:', data1)
      return
    }

    const recommendations1 = data1.data.recommendations
    console.log(`✅ 獲取到 ${recommendations1.length} 個推薦`)

    // 檢查排序
    console.log('\n📊 推薦排序 (清除快取後):')
    recommendations1.forEach((rec, index) => {
      console.log(`${index + 1}. ID: ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 驗證排序
    let isSorted1 = true
    for (let i = 1; i < recommendations1.length; i++) {
      if (recommendations1[i].total_score > recommendations1[i - 1].total_score) {
        isSorted1 = false
        console.log(
          `❌ 排序錯誤: ${recommendations1[i - 1].total_score} < ${recommendations1[i].total_score}`,
        )
        break
      }
    }

    console.log(isSorted1 ? '✅ 排序正確' : '❌ 排序錯誤')

    // 測試 2: 不使用 clear_cache 再次獲取
    console.log('\n2. 使用快取獲取推薦...')
    const response2 = await fetch(`${baseUrl}/api/recommendations/mixed?limit=5`)

    if (!response2.ok) {
      console.error(`❌ HTTP 錯誤: ${response2.status} ${response2.statusText}`)
      return
    }

    const data2 = await response2.json()

    if (!data2.success) {
      console.error('❌ API 響應錯誤:', data2)
      return
    }

    const recommendations2 = data2.data.recommendations
    console.log(`✅ 獲取到 ${recommendations2.length} 個推薦`)

    // 檢查排序
    console.log('\n📊 推薦排序 (使用快取):')
    recommendations2.forEach((rec, index) => {
      console.log(`${index + 1}. ID: ${rec._id} - total_score: ${rec.total_score}`)
    })

    // 驗證排序
    let isSorted2 = true
    for (let i = 1; i < recommendations2.length; i++) {
      if (recommendations2[i].total_score > recommendations2[i - 1].total_score) {
        isSorted2 = false
        console.log(
          `❌ 排序錯誤: ${recommendations2[i - 1].total_score} < ${recommendations2[i].total_score}`,
        )
        break
      }
    }

    console.log(isSorted2 ? '✅ 排序正確' : '❌ 排序錯誤')

    // 比較兩次結果
    console.log('\n🔍 比較兩次結果:')
    console.log(
      '清除快取後的第一個推薦:',
      recommendations1[0]?._id,
      recommendations1[0]?.total_score,
    )
    console.log(
      '使用快取後的第一個推薦:',
      recommendations2[0]?._id,
      recommendations2[0]?.total_score,
    )

    const sameOrder = recommendations1[0]?._id === recommendations2[0]?._id
    console.log(sameOrder ? '✅ 兩次結果一致' : '❌ 兩次結果不一致')

    // 檢查演算法權重
    console.log('\n⚖️ 演算法權重:')
    console.log(data1.data.weights)

    // 檢查冷啟動狀態
    console.log('\n❄️ 冷啟動狀態:')
    console.log(data1.data.cold_start_status)

    console.log('\n=== 測試完成 ===')
  } catch (error) {
    console.error('❌ 測試失敗:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.error('💡 建議: 請確保後端服務器正在運行 (npm run dev)')
    }

    if (error.message.includes('fetch')) {
      console.error('💡 建議: 請安裝 node-fetch: npm install node-fetch')
    }
  }
}

// 運行測試
testRecommendationAPI()
