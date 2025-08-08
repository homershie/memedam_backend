const axios = require('axios')

async function testHotRecommendations() {
  console.log('=== 測試熱門推薦 API ===\n')

  try {
    // 測試不同的參數組合
    const testCases = [
      { page: 1, limit: 20, description: '第一頁，20個迷因' },
      { page: 1, limit: 10, description: '第一頁，10個迷因' },
      { page: 2, limit: 10, description: '第二頁，10個迷因' },
      { page: 1, limit: 5, description: '第一頁，5個迷因' },
      { page: 2, limit: 5, description: '第二頁，5個迷因' },
    ]

    for (const testCase of testCases) {
      console.log(`\n📋 測試: ${testCase.description}`)

      const params = new URLSearchParams({
        page: testCase.page,
        limit: testCase.limit,
        _t: Date.now(), // 避免快取
      })

      const response = await axios.get(`http://localhost:3000/api/recommendations?${params}`)

      if (response.data.success) {
        const data = response.data.data
        const recommendations = data.recommendations || []
        const pagination = data.pagination || {}

        console.log(`  ✅ 成功`)
        console.log(`  返回迷因數量: ${recommendations.length}`)
        console.log(`  分頁資訊:`, {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          hasMore: pagination.hasMore,
          totalPages: pagination.totalPages,
        })

        if (recommendations.length > 0) {
          console.log(
            `  前3個迷因ID:`,
            recommendations.slice(0, 3).map((m) => m._id),
          )
        }
      } else {
        console.log(`  ❌ 失敗:`, response.data.error)
      }
    }
  } catch (error) {
    console.error('❌ 測試失敗:', error.message)
  }
}

// 運行測試
testHotRecommendations()
