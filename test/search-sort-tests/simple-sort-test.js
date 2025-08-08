const fetch = require('node-fetch')

async function testSimpleSorting() {
  const baseUrl = 'http://localhost:3000'

  console.log('=== 簡單排序測試 ===\n')

  try {
    // 測試 1: 清除快取並獲取推薦
    console.log('測試 1: 清除快取並獲取推薦...')
    const response1 = await fetch(`${baseUrl}/api/recommendations/mixed?clear_cache=true&limit=5`)
    const data1 = await response1.json()

    if (!data1.success) {
      console.error('❌ 請求失敗:', data1)
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
    console.log('\n測試 2: 使用快取獲取推薦...')
    const response2 = await fetch(`${baseUrl}/api/recommendations/mixed?limit=5`)
    const data2 = await response2.json()

    if (!data2.success) {
      console.error('❌ 請求失敗:', data2)
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

    console.log('\n=== 測試完成 ===')
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error)
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  testSimpleSorting()
}

module.exports = { testSimpleSorting }
