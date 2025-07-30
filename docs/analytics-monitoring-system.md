# 推薦系統分析與監控系統

## 概述

本系統提供完整的推薦效果監控和 A/B 測試框架，幫助優化推薦演算法的效能和用戶體驗。

## 功能特色

### 1. 推薦效果指標追蹤

#### 核心指標

- **CTR (Click-Through Rate)**: 點擊率
- **Engagement Rate**: 互動率（包含點讚、分享、評論、收藏）
- **Satisfaction Score**: 滿意度分數
- **View Duration**: 觀看時長
- **Time to Interact**: 互動時間

#### 追蹤事件

- 推薦展示
- 用戶點擊
- 點讚/取消點讚
- 分享
- 評論
- 收藏
- 評分
- 觀看時長

### 2. A/B 測試框架

#### 測試類型

- **演算法比較**: 比較不同推薦演算法的效果
- **參數調優**: 調整演算法參數
- **功能測試**: 測試新功能對推薦效果的影響
- **UI 變體**: 測試不同 UI 設計
- **內容變體**: 測試不同內容呈現方式

#### 統計分析

- 統計顯著性檢定
- 置信區間計算
- 效果大小評估
- 自動獲勝者選擇

## API 端點

### 推薦指標追蹤

#### POST /api/analytics/track-recommendation

記錄推薦展示事件

```json
{
  "meme_id": "meme_id",
  "algorithm": "mixed",
  "recommendation_score": 0.85,
  "recommendation_rank": 1,
  "ab_test_id": "test_001",
  "ab_test_variant": "A",
  "recommendation_context": {
    "page": "home",
    "position": 1,
    "session_id": "session_123"
  },
  "user_features": {
    "is_new_user": false,
    "user_activity_level": "high",
    "user_preferences": {
      "funny": 0.8,
      "gaming": 0.6
    }
  },
  "meme_features": {
    "type": "image",
    "tags": ["funny", "gaming"],
    "hot_score": 0.75,
    "age_hours": 24
  }
}
```

#### PUT /api/analytics/update-interaction

更新用戶互動事件

```json
{
  "metrics_id": "metrics_id",
  "interaction_type": "like",
  "view_duration": 30,
  "user_rating": 4
}
```

### 統計分析

#### GET /api/analytics/algorithm-stats

取得演算法統計

查詢參數：

- `algorithm`: 特定演算法（可選）
- `start_date`: 開始日期
- `end_date`: 結束日期
- `group_by`: 分組方式（day, week, month）

#### GET /api/analytics/user-effectiveness

取得用戶推薦效果分析

#### GET /api/analytics/dashboard

取得推薦效果儀表板

### A/B 測試管理

#### POST /api/analytics/ab-tests

建立 A/B 測試

```json
{
  "test_id": "test_001",
  "name": "混合推薦演算法測試",
  "description": "測試新的混合推薦演算法效果",
  "test_type": "algorithm_comparison",
  "primary_metric": "engagement_rate",
  "secondary_metrics": ["ctr", "satisfaction_score"],
  "variants": [
    {
      "variant_id": "A",
      "name": "現有演算法",
      "description": "使用現有的混合推薦演算法",
      "configuration": {
        "hot_weight": 0.3,
        "content_weight": 0.4,
        "collaborative_weight": 0.3
      },
      "traffic_percentage": 50
    },
    {
      "variant_id": "B",
      "name": "新演算法",
      "description": "使用新的混合推薦演算法",
      "configuration": {
        "hot_weight": 0.2,
        "content_weight": 0.5,
        "collaborative_weight": 0.3
      },
      "traffic_percentage": 50
    }
  ],
  "target_audience": {
    "user_segments": ["all_users"],
    "user_activity_levels": ["medium", "high"],
    "device_types": ["mobile", "desktop"]
  },
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-31T23:59:59Z",
  "statistical_settings": {
    "confidence_level": 0.95,
    "minimum_sample_size": 1000,
    "minimum_duration_days": 7
  },
  "automation": {
    "auto_stop": true,
    "auto_winner_selection": false,
    "minimum_improvement": 0.05
  }
}
```

#### GET /api/analytics/ab-tests

取得 A/B 測試列表

#### GET /api/analytics/ab-tests/:testId

取得 A/B 測試詳細資訊

#### PUT /api/analytics/ab-tests/:testId/status

更新 A/B 測試狀態

## 資料模型

### RecommendationMetrics

推薦指標記錄模型

```javascript
{
  user_id: ObjectId,
  meme_id: ObjectId,
  algorithm: String,
  ab_test_id: String,
  ab_test_variant: String,
  recommendation_score: Number,
  recommendation_rank: Number,
  is_clicked: Boolean,
  is_liked: Boolean,
  is_shared: Boolean,
  is_commented: Boolean,
  is_collected: Boolean,
  is_disliked: Boolean,
  view_duration: Number,
  time_to_interact: Number,
  user_rating: Number,
  recommendation_context: {
    page: String,
    position: Number,
    session_id: String
  },
  user_features: {
    is_new_user: Boolean,
    user_activity_level: String,
    user_preferences: Map
  },
  meme_features: {
    type: String,
    tags: [String],
    hot_score: Number,
    age_hours: Number
  },
  recommended_at: Date,
  interacted_at: Date,
  calculated_metrics: {
    ctr: Number,
    engagement_rate: Number,
    satisfaction_score: Number
  }
}
```

### ABTest

A/B 測試模型

```javascript
{
  test_id: String,
  name: String,
  description: String,
  test_type: String,
  primary_metric: String,
  secondary_metrics: [String],
  variants: [{
    variant_id: String,
    name: String,
    description: String,
    configuration: Map,
    traffic_percentage: Number
  }],
  target_audience: {
    user_segments: [String],
    user_activity_levels: [String],
    geographic_regions: [String],
    device_types: [String]
  },
  start_date: Date,
  end_date: Date,
  statistical_settings: {
    confidence_level: Number,
    minimum_sample_size: Number,
    minimum_duration_days: Number
  },
  status: String,
  results: {
    winner_variant: String,
    statistical_significance: Boolean,
    p_value: Number,
    effect_size: Number,
    confidence_interval: {
      lower: Number,
      upper: Number
    },
    sample_sizes: {
      A: Number,
      B: Number,
      control: Number
    },
    metric_results: {
      A: Object,
      B: Object,
      control: Object
    }
  },
  automation: {
    auto_stop: Boolean,
    auto_winner_selection: Boolean,
    minimum_improvement: Number
  },
  notifications: {
    on_start: Boolean,
    on_completion: Boolean,
    on_significant_result: Boolean,
    recipients: [String]
  },
  created_by: ObjectId,
  tags: [String]
}
```

## 監控工具

### AnalyticsMonitor

即時監控工具類

#### 主要功能

- 即時統計更新
- A/B 測試結果分析
- 快取管理
- 事件追蹤

#### 定期任務

- 每小時更新活躍測試
- 每 5 分鐘更新指標快取
- 每小時檢查 A/B 測試結果

#### 快取策略

- 即時統計：5 分鐘過期
- 日統計：1 小時過期
- 演算法比較：1 小時過期

## 使用範例

### 1. 記錄推薦事件

```javascript
// 在推薦 API 中記錄事件
const metricsId = await analyticsMonitor.trackRecommendationEvent({
  user_id: userId,
  meme_id: memeId,
  algorithm: 'mixed',
  recommendation_score: 0.85,
  recommendation_rank: 1,
  recommendation_context: {
    page: 'home',
    position: 1,
  },
  user_features: {
    is_new_user: false,
    user_activity_level: 'high',
  },
  meme_features: {
    type: 'image',
    tags: ['funny'],
    hot_score: 0.75,
    age_hours: 24,
  },
})
```

### 2. 更新互動事件

```javascript
// 在用戶互動時更新事件
await analyticsMonitor.updateInteractionEvent(metricsId, {
  interaction_type: 'like',
  view_duration: 30,
})
```

### 3. 建立 A/B 測試

```javascript
// 建立演算法比較測試
const testData = {
  test_id: 'algo_test_001',
  name: '混合推薦演算法優化',
  test_type: 'algorithm_comparison',
  primary_metric: 'engagement_rate',
  variants: [
    {
      variant_id: 'A',
      name: '現有演算法',
      configuration: { hot_weight: 0.3, content_weight: 0.4 },
      traffic_percentage: 50,
    },
    {
      variant_id: 'B',
      name: '優化演算法',
      configuration: { hot_weight: 0.2, content_weight: 0.5 },
      traffic_percentage: 50,
    },
  ],
  start_date: '2024-01-01T00:00:00Z',
  end_date: '2024-01-31T23:59:59Z',
}

const response = await fetch('/api/analytics/ab-tests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData),
})
```

### 4. 取得統計資料

```javascript
// 取得演算法統計
const stats = await fetch('/api/analytics/algorithm-stats?algorithm=mixed')
const data = await stats.json()

// 取得儀表板資料
const dashboard = await fetch('/api/analytics/dashboard')
const dashboardData = await dashboard.json()
```

## 最佳實踐

### 1. 指標追蹤

- 確保所有推薦展示都被記錄
- 及時更新用戶互動事件
- 定期檢查資料完整性

### 2. A/B 測試

- 設定明確的測試目標
- 確保樣本大小足夠
- 監控測試進度
- 及時分析結果

### 3. 效能優化

- 使用快取減少資料庫查詢
- 定期清理舊資料
- 監控系統效能

### 4. 資料品質

- 驗證資料完整性
- 處理異常資料
- 定期備份重要資料

## 監控儀表板

系統提供即時監控儀表板，包含：

1. **整體統計**
   - 總推薦數
   - 平均 CTR
   - 平均互動率
   - 平均觀看時長

2. **演算法比較**
   - 各演算法效能對比
   - 趨勢分析
   - 排名變化

3. **A/B 測試狀態**
   - 活躍測試數量
   - 測試進度
   - 結果通知

4. **用戶分析**
   - 用戶行為模式
   - 偏好分析
   - 留存率

## 故障排除

### 常見問題

1. **指標記錄失敗**
   - 檢查資料庫連線
   - 驗證必要欄位
   - 檢查權限設定

2. **A/B 測試無法啟動**
   - 檢查測試配置
   - 驗證時間設定
   - 確認目標用戶群

3. **統計資料不準確**
   - 檢查資料完整性
   - 驗證計算邏輯
   - 清理異常資料

### 日誌分析

系統提供詳細的日誌記錄，包括：

- 推薦事件記錄
- 互動事件更新
- A/B 測試狀態變化
- 錯誤和異常

## 未來擴展

1. **機器學習整合**
   - 自動參數調優
   - 預測模型
   - 異常檢測

2. **即時通知**
   - Email 通知
   - Webhook 整合
   - 即時儀表板

3. **進階分析**
   - 用戶分群分析
   - 內容效果分析
   - 趨勢預測

4. **多維度分析**
   - 時間維度
   - 地理維度
   - 設備維度
