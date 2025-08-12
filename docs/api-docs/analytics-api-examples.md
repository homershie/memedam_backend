# 迷因典分析數據 API 測試範例

## 🧪 測試環境設置

### 1. 準備測試數據

```javascript
// 測試配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000/api/analytics',
  token: 'your_jwt_token_here',
  headers: {
    Authorization: 'Bearer your_jwt_token_here',
    'Content-Type': 'application/json',
  },
}
```

### 2. 測試工具函數

```javascript
// 通用測試函數
async function testApi(endpoint, options = {}) {
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}${endpoint}`, {
      headers: TEST_CONFIG.headers,
      ...options,
    })

    const data = await response.json()

    console.log(`✅ ${endpoint} - 狀態: ${response.status}`)
    console.log('響應數據:', data)

    return { success: response.ok, data, status: response.status }
  } catch (error) {
    console.error(`❌ ${endpoint} - 錯誤:`, error)
    return { success: false, error: error.message }
  }
}
```

---

## 📊 1. 儀表板數據測試

### 測試基本儀表板

```javascript
// 測試 1: 取得最近30天儀表板數據
async function testDashboard() {
  console.log('🧪 測試儀表板數據...')

  const result = await testApi('/dashboard')

  if (result.success) {
    const { overall_stats, algorithm_comparison } = result.data.data

    console.log('📈 整體統計:')
    console.log(`- 總推薦數: ${overall_stats.total_recommendations}`)
    console.log(`- 點擊率: ${(overall_stats.ctr * 100).toFixed(2)}%`)
    console.log(`- 互動率: ${(overall_stats.engagement_rate * 100).toFixed(2)}%`)
    console.log(`- 平均觀看時長: ${overall_stats.avg_view_duration.toFixed(1)}秒`)
    console.log(`- 平均評分: ${overall_stats.avg_rating.toFixed(1)}/5`)

    console.log('🔍 演算法比較:')
    algorithm_comparison.forEach((algo) => {
      console.log(
        `- ${algo.algorithm}: CTR=${(algo.ctr * 100).toFixed(1)}%, 互動率=${(algo.engagement_rate * 100).toFixed(1)}%`,
      )
    })
  }
}

// 執行測試
testDashboard()
```

### 測試指定時間範圍

```javascript
// 測試 2: 取得指定時間範圍的儀表板數據
async function testDashboardWithDateRange() {
  console.log('🧪 測試指定時間範圍儀表板...')

  const startDate = '2024-01-01'
  const endDate = '2024-01-31'

  const result = await testApi(`/dashboard?start_date=${startDate}&end_date=${endDate}`)

  if (result.success) {
    console.log('✅ 指定時間範圍數據獲取成功')
    console.log('時間範圍:', result.data.data.time_range)
  }
}
```

**預期響應範例**:

```json
{
  "success": true,
  "data": {
    "time_range": {
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-01-31T23:59:59.999Z"
    },
    "overall_stats": {
      "total_recommendations": 15420,
      "ctr": 0.156,
      "engagement_rate": 0.284,
      "avg_view_duration": 42.3,
      "avg_rating": 4.1,
      "total_likes": 3250,
      "total_shares": 890,
      "total_comments": 1200,
      "total_collections": 680,
      "total_dislikes": 120
    },
    "algorithm_comparison": [
      {
        "algorithm": "mixed",
        "total_recommendations": 8000,
        "ctr": 0.18,
        "engagement_rate": 0.32,
        "avg_view_duration": 45.2,
        "avg_rating": 4.3
      },
      {
        "algorithm": "hot",
        "total_recommendations": 4200,
        "ctr": 0.12,
        "engagement_rate": 0.22,
        "avg_view_duration": 38.1,
        "avg_rating": 3.8
      }
    ],
    "active_ab_tests": 2,
    "top_performing_algorithms": [
      {
        "algorithm": "mixed",
        "engagement_rate": 0.32
      },
      {
        "algorithm": "content-based",
        "engagement_rate": 0.28
      }
    ]
  }
}
```

---

## 🔍 2. 演算法統計測試

### 測試所有演算法統計

```javascript
// 測試 3: 取得所有演算法統計
async function testAllAlgorithmStats() {
  console.log('🧪 測試所有演算法統計...')

  const result = await testApi('/algorithm-stats')

  if (result.success) {
    const { stats } = result.data.data

    console.log('📊 演算法統計:')
    stats.forEach((stat) => {
      console.log(`\n${stat.algorithm}:`)
      console.log(`  推薦數: ${stat.total_recommendations}`)
      console.log(`  點擊數: ${stat.total_clicks}`)
      console.log(`  點讚數: ${stat.total_likes}`)
      console.log(`  CTR: ${(stat.ctr * 100).toFixed(1)}%`)
      console.log(`  互動率: ${(stat.engagement_rate * 100).toFixed(1)}%`)
      console.log(`  平均觀看時長: ${stat.avg_view_duration.toFixed(1)}秒`)
      console.log(`  平均評分: ${stat.avg_rating.toFixed(1)}/5`)
    })
  }
}
```

### 測試特定演算法

```javascript
// 測試 4: 取得特定演算法統計
async function testSpecificAlgorithm() {
  console.log('🧪 測試特定演算法統計...')

  const algorithms = ['mixed', 'hot', 'content-based']

  for (const algorithm of algorithms) {
    console.log(`\n測試演算法: ${algorithm}`)
    const result = await testApi(`/algorithm-stats?algorithm=${algorithm}`)

    if (result.success) {
      const stat = result.data.data.stats[0]
      console.log(`✅ ${algorithm} 統計獲取成功`)
      console.log(`  CTR: ${(stat.ctr * 100).toFixed(1)}%`)
      console.log(`  互動率: ${(stat.engagement_rate * 100).toFixed(1)}%`)
    }
  }
}
```

**預期響應範例**:

```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "algorithm": "mixed",
        "total_recommendations": 8000,
        "total_clicks": 1440,
        "total_likes": 2560,
        "total_shares": 720,
        "total_comments": 960,
        "total_collections": 640,
        "total_dislikes": 80,
        "avg_view_duration": 45.2,
        "avg_rating": 4.3,
        "ctr": 0.18,
        "engagement_rate": 0.32
      }
    ],
    "time_range": {
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-01-31T23:59:59.999Z"
    },
    "group_by": "day"
  }
}
```

---

## 👤 3. 用戶效果分析測試

### 測試用戶個人數據

```javascript
// 測試 5: 取得用戶個人推薦效果
async function testUserEffectiveness() {
  console.log('🧪 測試用戶個人推薦效果...')

  const result = await testApi('/user-effectiveness')

  if (result.success) {
    const { overall_stats, algorithm_stats, recent_recommendations } = result.data.data

    console.log('👤 用戶整體統計:')
    console.log(`- 總推薦數: ${overall_stats.total_recommendations}`)
    console.log(`- 個人CTR: ${(overall_stats.ctr * 100).toFixed(1)}%`)
    console.log(`- 個人互動率: ${(overall_stats.engagement_rate * 100).toFixed(1)}%`)

    console.log('\n🎯 演算法偏好:')
    Object.entries(algorithm_stats).forEach(([algo, stats]) => {
      console.log(
        `- ${algo}: CTR=${(stats.ctr * 100).toFixed(1)}%, 互動率=${(stats.engagement_rate * 100).toFixed(1)}%`,
      )
    })

    console.log('\n📝 最近推薦記錄:')
    recent_recommendations.slice(0, 3).forEach((rec) => {
      console.log(
        `- ${rec.algorithm}: ${rec.is_clicked ? '✅' : '❌'} 點擊, ${rec.is_liked ? '❤️' : '🤍'} 點讚`,
      )
    })
  }
}
```

**預期響應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "507f1f77bcf86cd799439011",
    "time_range": {
      "start_date": "2024-01-01T00:00:00.000Z",
      "end_date": "2024-01-31T23:59:59.999Z"
    },
    "overall_stats": {
      "total_recommendations": 150,
      "ctr": 0.24,
      "engagement_rate": 0.35,
      "total_likes": 45,
      "total_shares": 12,
      "total_comments": 8,
      "total_collections": 15,
      "total_dislikes": 3
    },
    "algorithm_stats": {
      "mixed": {
        "total": 80,
        "clicks": 20,
        "likes": 28,
        "shares": 8,
        "comments": 5,
        "collections": 10,
        "dislikes": 1,
        "ctr": 0.25,
        "engagement_rate": 0.38,
        "avg_rating": 4.2,
        "avg_view_duration": 48.5
      }
    },
    "recent_recommendations": [
      {
        "meme_id": "507f1f77bcf86cd799439012",
        "algorithm": "mixed",
        "recommended_at": "2024-01-31T10:30:00.000Z",
        "is_clicked": true,
        "is_liked": true,
        "user_rating": 4
      }
    ]
  }
}
```

---

## 🧪 4. A/B 測試管理測試

### 測試A/B測試列表

```javascript
// 測試 6: 取得A/B測試列表
async function testABTests() {
  console.log('🧪 測試A/B測試列表...')

  const result = await testApi('/ab-tests?page=1&limit=5')

  if (result.success) {
    const { tests, pagination } = result.data.data

    console.log('📋 A/B測試列表:')
    tests.forEach((test) => {
      console.log(`\n- ${test.name} (${test.test_id})`)
      console.log(`  類型: ${test.test_type}`)
      console.log(`  狀態: ${test.status}`)
      console.log(`  主要指標: ${test.primary_metric}`)
      console.log(`  開始日期: ${new Date(test.start_date).toLocaleDateString()}`)
    })

    console.log(
      `\n📄 分頁資訊: 第${pagination.page}頁，共${pagination.pages}頁，總計${pagination.total}個測試`,
    )
  }
}
```

### 測試特定A/B測試詳情

```javascript
// 測試 7: 取得特定A/B測試詳情
async function testABTestDetails() {
  console.log('🧪 測試A/B測試詳情...')

  // 假設有一個測試ID
  const testId = 'test_001'

  const result = await testApi(`/ab-tests/${testId}`)

  if (result.success) {
    const { test, results, is_active, is_completed } = result.data.data

    console.log(`📊 A/B測試詳情: ${test.name}`)
    console.log(`- 測試ID: ${test.test_id}`)
    console.log(`- 類型: ${test.test_type}`)
    console.log(`- 主要指標: ${test.primary_metric}`)
    console.log(`- 狀態: ${test.status}`)
    console.log(`- 是否活躍: ${is_active}`)
    console.log(`- 是否完成: ${is_completed}`)

    if (results) {
      console.log('\n📈 測試結果:')
      console.log(`- 獲勝變體: ${results.winner_variant}`)
      console.log(`- 統計顯著性: ${results.statistical_significance}`)
      console.log(`- P值: ${results.p_value}`)
      console.log(`- 效果大小: ${results.effect_size}`)
    }
  }
}
```

---

## 📝 5. 數據追蹤測試

### 測試推薦事件追蹤

```javascript
// 測試 8: 記錄推薦事件
async function testTrackRecommendation() {
  console.log('🧪 測試推薦事件追蹤...')

  const recommendationData = {
    meme_id: '507f1f77bcf86cd799439013',
    algorithm: 'mixed',
    recommendation_score: 0.85,
    recommendation_rank: 1,
    recommendation_context: {
      page: 'home',
      position: 1,
      session_id: 'session_123',
    },
    user_features: {
      is_new_user: false,
      user_activity_level: 'high',
      user_preferences: {
        funny: 0.8,
        gaming: 0.6,
      },
    },
  }

  const result = await testApi('/track-recommendation', {
    method: 'POST',
    body: JSON.stringify(recommendationData),
  })

  if (result.success) {
    console.log('✅ 推薦事件記錄成功')
    console.log('指標ID:', result.data.data.metrics_id)
    return result.data.data.metrics_id
  }

  return null
}
```

### 測試互動事件更新

```javascript
// 測試 9: 更新互動事件
async function testUpdateInteraction(metricsId) {
  console.log('🧪 測試互動事件更新...')

  if (!metricsId) {
    console.log('❌ 需要先記錄推薦事件')
    return
  }

  const interactionData = {
    metrics_id: metricsId,
    interaction_type: 'like',
    view_duration: 30,
    user_rating: 4,
  }

  const result = await testApi('/update-interaction', {
    method: 'PUT',
    body: JSON.stringify(interactionData),
  })

  if (result.success) {
    console.log('✅ 互動事件更新成功')
  }
}
```

---

## 🚀 完整測試流程

### 執行所有測試

```javascript
// 完整測試流程
async function runAllTests() {
  console.log('🚀 開始執行所有分析API測試...\n')

  // 1. 儀表板測試
  await testDashboard()
  await testDashboardWithDateRange()

  // 2. 演算法統計測試
  await testAllAlgorithmStats()
  await testSpecificAlgorithm()

  // 3. 用戶效果測試
  await testUserEffectiveness()

  // 4. A/B測試測試
  await testABTests()
  await testABTestDetails()

  // 5. 數據追蹤測試
  const metricsId = await testTrackRecommendation()
  await testUpdateInteraction(metricsId)

  console.log('\n🎉 所有測試完成！')
}

// 執行測試
runAllTests()
```

---

## 🔧 錯誤處理測試

### 測試錯誤情況

```javascript
// 測試 10: 錯誤處理
async function testErrorHandling() {
  console.log('🧪 測試錯誤處理...')

  // 測試無效token
  const invalidHeaders = {
    Authorization: 'Bearer invalid_token',
    'Content-Type': 'application/json',
  }

  const response = await fetch(`${TEST_CONFIG.baseUrl}/dashboard`, {
    headers: invalidHeaders,
  })

  console.log('無效token響應狀態:', response.status)

  // 測試無效參數
  const result = await testApi('/algorithm-stats?algorithm=invalid_algorithm')
  console.log('無效演算法響應:', result)

  // 測試無效日期格式
  const dateResult = await testApi('/dashboard?start_date=invalid_date')
  console.log('無效日期響應:', dateResult)
}
```

---

## 📋 測試檢查清單

### 功能測試

- [ ] 儀表板數據獲取
- [ ] 演算法統計分析
- [ ] 用戶個人效果分析
- [ ] A/B測試管理
- [ ] 數據追蹤功能

### 錯誤處理測試

- [ ] 無效認證
- [ ] 無效參數
- [ ] 無效日期格式
- [ ] 網路錯誤
- [ ] 伺服器錯誤

### 效能測試

- [ ] 響應時間
- [ ] 數據大小
- [ ] 快取效果
- [ ] 並發請求

---

## 📞 問題報告

如果測試中發現問題，請提供以下資訊：

1. **測試環境**: 作業系統、瀏覽器版本
2. **錯誤訊息**: 完整的錯誤日誌
3. **請求詳情**: API端點、參數、請求頭
4. **預期行為**: 期望的響應格式
5. **實際行為**: 實際收到的響應

---

**注意**: 請確保在執行測試前設置正確的JWT token，並且後端服務正在運行。
