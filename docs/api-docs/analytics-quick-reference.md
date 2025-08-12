# 迷因典分析數據 API 快速參考

## 🚀 快速開始

### 基礎配置

```javascript
const BASE_URL = '/api/analytics'
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
}
```

## 📊 主要數據端點

### 1. 儀表板數據 (最重要)

```javascript
// 取得整體統計
GET / api / analytics / dashboard
// 返回: 總推薦數、CTR、互動率、演算法比較、最佳演算法
```

### 2. 演算法分析

```javascript
// 取得演算法統計
GET /api/analytics/algorithm-stats?algorithm=mixed
// 返回: 特定演算法的詳細效能數據
```

### 3. 用戶個人數據

```javascript
// 取得用戶效果分析
GET / api / analytics / user - effectiveness
// 返回: 用戶個人推薦效果和偏好
```

## 🎯 核心指標

| 指標                | 說明         | 範圍 | 用途           |
| ------------------- | ------------ | ---- | -------------- |
| `ctr`               | 點擊率       | 0-1  | 衡量推薦準確性 |
| `engagement_rate`   | 互動率       | 0-1  | 衡量用戶參與度 |
| `avg_view_duration` | 平均觀看時長 | ≥0秒 | 衡量內容吸引力 |
| `avg_rating`        | 平均評分     | 1-5  | 衡量用戶滿意度 |

## 📈 數據結構範例

### 儀表板響應

```json
{
  "success": true,
  "data": {
    "overall_stats": {
      "total_recommendations": 10000,
      "ctr": 0.15,
      "engagement_rate": 0.25,
      "avg_view_duration": 45.5,
      "avg_rating": 4.2
    },
    "algorithm_comparison": [
      {
        "algorithm": "mixed",
        "ctr": 0.18,
        "engagement_rate": 0.28
      }
    ],
    "top_performing_algorithms": [{ "algorithm": "mixed", "engagement_rate": 0.28 }]
  }
}
```

### 演算法統計響應

```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "algorithm": "mixed",
        "total_recommendations": 5000,
        "total_clicks": 900,
        "total_likes": 1200,
        "ctr": 0.18,
        "engagement_rate": 0.28
      }
    ]
  }
}
```

## 🔧 實用函數

### 取得儀表板數據

```javascript
async function getDashboardData(startDate = null, endDate = null) {
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)

  const response = await fetch(`${BASE_URL}/dashboard?${params}`, { headers })
  return response.json()
}
```

### 取得演算法統計

```javascript
async function getAlgorithmStats(algorithm = null, startDate = null, endDate = null) {
  const params = new URLSearchParams()
  if (algorithm) params.append('algorithm', algorithm)
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)

  const response = await fetch(`${BASE_URL}/algorithm-stats?${params}`, { headers })
  return response.json()
}
```

### 取得用戶效果分析

```javascript
async function getUserEffectiveness(startDate = null, endDate = null) {
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)

  const response = await fetch(`${BASE_URL}/user-effectiveness?${params}`, { headers })
  return response.json()
}
```

## 📱 前端使用建議

### 1. 儀表板組件

```javascript
// 使用儀表板數據建立主要統計卡片
const dashboardData = await getDashboardData()
const { overall_stats, algorithm_comparison } = dashboardData.data

// 顯示關鍵指標
displayMetric('總推薦數', overall_stats.total_recommendations)
displayMetric('點擊率', (overall_stats.ctr * 100).toFixed(1) + '%')
displayMetric('互動率', (overall_stats.engagement_rate * 100).toFixed(1) + '%')
```

### 2. 演算法比較圖表

```javascript
// 建立演算法效能比較圖表
const algorithmData = await getAlgorithmStats()
const { stats } = algorithmData.data

// 建立圖表數據
const chartData = stats.map((stat) => ({
  name: stat.algorithm,
  ctr: stat.ctr * 100,
  engagement: stat.engagement_rate * 100,
}))
```

### 3. 用戶個人數據

```javascript
// 顯示用戶個人推薦效果
const userData = await getUserEffectiveness()
const { overall_stats, algorithm_stats } = userData.data

// 顯示個人統計
displayPersonalStats(overall_stats)
displayAlgorithmPreferences(algorithm_stats)
```

## ⚡ 效能優化

### 快取策略

- 儀表板數據: 5分鐘快取
- 演算法統計: 1小時快取
- 用戶數據: 即時獲取

### 時間範圍建議

- 預設: 最近30天
- 最大: 90天
- 小範圍查詢效能更好

## 🚨 錯誤處理

```javascript
async function safeApiCall(apiFunction) {
  try {
    const result = await apiFunction()
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  } catch (error) {
    console.error('API調用失敗:', error)
    // 顯示用戶友好的錯誤訊息
    showErrorMessage('數據載入失敗，請稍後重試')
    return null
  }
}
```

## 🎨 數據視覺化建議

### 1. 儀表板佈局

- 頂部: 關鍵指標卡片 (CTR、互動率、觀看時長)
- 中部: 演算法比較圖表
- 底部: 趨勢圖表

### 2. 圖表類型

- 點擊率/互動率: 柱狀圖或雷達圖
- 趨勢分析: 折線圖
- 演算法比較: 並列柱狀圖
- 用戶偏好: 圓餅圖

### 3. 互動功能

- 時間範圍選擇器
- 演算法篩選器
- 數據鑽取功能
- 即時更新

## 📋 檢查清單

### 前端整合檢查

- [ ] 認證token正確設置
- [ ] 錯誤處理機制完善
- [ ] 載入狀態顯示
- [ ] 數據快取策略
- [ ] 響應式設計
- [ ] 無障礙支援

### 數據品質檢查

- [ ] 數值範圍驗證
- [ ] 空值處理
- [ ] 數據格式化
- [ ] 單位顯示
- [ ] 精度控制

## 🔗 相關文檔

- [完整API文檔](./analytics-api-documentation.md)
- [A/B測試指南](../system-docs/oauth-backend-checklist.md)
- [效能優化指南](../performance-docs/performance-optimization.md)

---

**注意**: 所有API都需要有效的JWT認證token。確保在每個請求中包含正確的Authorization header。
