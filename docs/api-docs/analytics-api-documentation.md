# 迷因典後端分析數據 API 文檔

## 概述

本文檔詳細說明迷因典後端提供的所有分析數據API，供前端AI判斷和數據視覺化使用。

## 基礎資訊

- **Base URL**: `/api/analytics`
- **認證方式**: Bearer Token (JWT)
- **數據格式**: JSON
- **時間格式**: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)

## API 端點總覽

### 1. 推薦效果儀表板

- `GET /api/analytics/dashboard` - 取得整體推薦效果統計

### 2. 演算法統計分析

- `GET /api/analytics/algorithm-stats` - 取得演算法詳細統計

### 3. 用戶推薦效果分析

- `GET /api/analytics/user-effectiveness` - 取得用戶個人推薦效果

### 4. A/B 測試管理

- `GET /api/analytics/ab-tests` - 取得A/B測試列表
- `GET /api/analytics/ab-tests/:testId` - 取得A/B測試詳細資訊
- `POST /api/analytics/ab-tests` - 建立A/B測試
- `PUT /api/analytics/ab-tests/:testId/status` - 更新A/B測試狀態

### 5. 數據追蹤

- `POST /api/analytics/track-recommendation` - 記錄推薦事件
- `PUT /api/analytics/update-interaction` - 更新互動事件

---

## 詳細 API 說明

### 1. 推薦效果儀表板

#### `GET /api/analytics/dashboard`

**描述**: 取得整體推薦效果統計數據，包含各演算法效能比較

**查詢參數**:

```typescript
{
  start_date?: string;    // 開始日期 (ISO格式)
  end_date?: string;      // 結束日期 (ISO格式)
}
```

**響應格式**:

```typescript
{
  success: boolean
  data: {
    time_range: {
      start_date: string
      end_date: string
    }
    overall_stats: {
      total_recommendations: number // 總推薦數
      ctr: number // 點擊率 (0-1)
      engagement_rate: number // 互動率 (0-1)
      avg_view_duration: number // 平均觀看時長(秒)
      avg_rating: number // 平均評分 (1-5)
      total_likes: number // 總點讚數
      total_shares: number // 總分享數
      total_comments: number // 總評論數
      total_collections: number // 總收藏數
      total_dislikes: number // 總不喜歡數
    }
    algorithm_comparison: Array<{
      algorithm: string // 演算法名稱
      total_recommendations: number // 推薦數
      ctr: number // 點擊率
      engagement_rate: number // 互動率
      avg_view_duration: number // 平均觀看時長
      avg_rating: number // 平均評分
    }>
    active_ab_tests: number // 活躍A/B測試數量
    top_performing_algorithms: Array<{
      // 表現最佳演算法(前3名)
      algorithm: string
      engagement_rate: number
    }>
  }
}
```

**使用範例**:

```javascript
// 取得最近30天的儀表板數據
const response = await fetch('/api/analytics/dashboard', {
  headers: { Authorization: `Bearer ${token}` },
})

// 取得指定時間範圍的數據
const response = await fetch('/api/analytics/dashboard?start_date=2024-01-01&end_date=2024-01-31', {
  headers: { Authorization: `Bearer ${token}` },
})
```

---

### 2. 演算法統計分析

#### `GET /api/analytics/algorithm-stats`

**描述**: 取得特定演算法的詳細統計數據

**查詢參數**:

```typescript
{
  algorithm?: string;     // 演算法名稱 (可選，不提供則返回所有演算法)
  start_date?: string;    // 開始日期 (ISO格式)
  end_date?: string;      // 結束日期 (ISO格式)
  group_by?: 'day' | 'week' | 'month';  // 分組方式
}
```

**支援的演算法**:

- `hot` - 熱門推薦
- `latest` - 最新推薦
- `content-based` - 內容基礎推薦
- `collaborative-filtering` - 協同過濾
- `social-collaborative-filtering` - 社交協同過濾
- `mixed` - 混合推薦
- `tag-based` - 標籤基礎推薦
- `similar` - 相似推薦
- `user-interest` - 用戶興趣推薦

**響應格式**:

```typescript
{
  success: boolean
  data: {
    stats: Array<{
      algorithm: string
      total_recommendations: number
      total_clicks: number
      total_likes: number
      total_shares: number
      total_comments: number
      total_collections: number
      total_dislikes: number
      avg_view_duration: number
      avg_rating: number
      ctr: number
      engagement_rate: number
    }>
    time_range: {
      start_date: string
      end_date: string
    }
    group_by: string
  }
}
```

---

### 3. 用戶推薦效果分析

#### `GET /api/analytics/user-effectiveness`

**描述**: 取得當前用戶的個人推薦效果分析

**查詢參數**:

```typescript
{
  start_date?: string;    // 開始日期 (ISO格式)
  end_date?: string;      // 結束日期 (ISO格式)
}
```

**響應格式**:

```typescript
{
  success: boolean;
  data: {
    user_id: string;
    time_range: {
      start_date: string;
      end_date: string;
    };
    overall_stats: {
      total_recommendations: number;
      ctr: number;
      engagement_rate: number;
      total_likes: number;
      total_shares: number;
      total_comments: number;
      total_collections: number;
      total_dislikes: number;
    };
    algorithm_stats: {
      [algorithm: string]: {
        total: number;
        clicks: number;
        likes: number;
        shares: number;
        comments: number;
        collections: number;
        dislikes: number;
        ctr: number;
        engagement_rate: number;
        avg_rating: number;
        avg_view_duration: number;
      };
    };
    recent_recommendations: Array<{
      meme_id: string;
      algorithm: string;
      recommended_at: string;
      is_clicked: boolean;
      is_liked: boolean;
      user_rating: number;
    }>;
  };
}
```

---

### 4. A/B 測試管理

#### `GET /api/analytics/ab-tests`

**描述**: 取得A/B測試列表

**查詢參數**:

```typescript
{
  status?: string;        // 測試狀態篩選
  test_type?: string;     // 測試類型篩選
  page?: number;          // 頁碼 (預設: 1)
  limit?: number;         // 每頁數量 (預設: 10)
}
```

**響應格式**:

```typescript
{
  success: boolean
  data: {
    tests: Array<{
      test_id: string
      name: string
      description: string
      test_type: string
      primary_metric: string
      status: 'draft' | 'active' | 'paused' | 'completed'
      start_date: string
      end_date: string
      created_at: string
    }>
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}
```

#### `GET /api/analytics/ab-tests/:testId`

**描述**: 取得A/B測試詳細資訊

**響應格式**:

```typescript
{
  success: boolean;
  data: {
    test: {
      test_id: string;
      name: string;
      description: string;
      test_type: string;
      primary_metric: string;
      secondary_metrics: string[];
      variants: Array<{
        variant_id: string;
        name: string;
        description: string;
        configuration: object;
        traffic_percentage: number;
      }>;
      target_audience: {
        user_segments: string[];
        user_activity_levels: string[];
        device_types: string[];
      };
      start_date: string;
      end_date: string;
      status: string;
      statistical_settings: {
        confidence_level: number;
        minimum_sample_size: number;
        minimum_duration_days: number;
      };
    };
    results: {
      winner_variant: string;
      statistical_significance: boolean;
      p_value: number;
      effect_size: number;
      confidence_interval: {
        lower: number;
        upper: number;
      };
      sample_sizes: {
        A: number;
        B: number;
        control: number;
      };
      metric_results: {
        A: object;
        B: object;
        control: object;
      };
    };
    is_active: boolean;
    is_completed: boolean;
    duration_days: number;
  };
}
```

---

### 5. 數據追蹤

#### `POST /api/analytics/track-recommendation`

**描述**: 記錄推薦展示事件

**請求格式**:

```typescript
{
  meme_id: string;                    // 迷因ID
  algorithm: string;                  // 推薦演算法
  recommendation_score: number;       // 推薦分數
  recommendation_rank: number;        // 推薦排名
  ab_test_id?: string;               // A/B測試ID (可選)
  ab_test_variant?: 'A' | 'B' | 'control';  // A/B測試變體 (可選)
  recommendation_context?: {
    page: string;                     // 頁面名稱
    position: number;                 // 位置
    session_id?: string;              // 會話ID (可選)
  };
  user_features?: {
    is_new_user: boolean;             // 是否新用戶
    user_activity_level: 'low' | 'medium' | 'high';  // 用戶活躍度
    user_preferences?: object;        // 用戶偏好 (可選)
  };
}
```

#### `PUT /api/analytics/update-interaction`

**描述**: 更新用戶互動事件

**請求格式**:

```typescript
{
  metrics_id: string;                 // 指標記錄ID
  interaction_type: 'click' | 'like' | 'share' | 'comment' | 'collect' | 'dislike' | 'view' | 'rate';
  view_duration?: number;             // 觀看時長(秒) (view類型時使用)
  user_rating?: number;               // 用戶評分(1-5) (rate類型時使用)
}
```

---

## 數據指標說明

### 核心指標

| 指標名稱           | 說明       | 計算方式                           | 範圍 |
| ------------------ | ---------- | ---------------------------------- | ---- |
| CTR                | 點擊率     | 點擊數 / 推薦數                    | 0-1  |
| Engagement Rate    | 互動率     | (點讚+分享+評論+收藏) / (推薦數×4) | 0-1  |
| Satisfaction Score | 滿意度分數 | 平均用戶評分                       | 1-5  |
| View Duration      | 觀看時長   | 平均觀看秒數                       | ≥0   |
| Time to Interact   | 互動時間   | 從推薦到互動的秒數                 | ≥0   |

### 互動類型

| 類型    | 說明   | 觸發時機       |
| ------- | ------ | -------------- |
| click   | 點擊   | 用戶點擊迷因   |
| like    | 點讚   | 用戶點讚迷因   |
| share   | 分享   | 用戶分享迷因   |
| comment | 評論   | 用戶評論迷因   |
| collect | 收藏   | 用戶收藏迷因   |
| dislike | 不喜歡 | 用戶點擊不喜歡 |
| view    | 觀看   | 用戶觀看迷因   |
| rate    | 評分   | 用戶評分迷因   |

---

## 使用建議

### 1. 儀表板設計

- 使用 `GET /api/analytics/dashboard` 建立主要數據儀表板
- 顯示整體統計和演算法比較
- 提供時間範圍選擇器

### 2. 演算法分析

- 使用 `GET /api/analytics/algorithm-stats` 建立演算法效能分析頁面
- 支援單一演算法或全演算法比較
- 提供趨勢圖表顯示

### 3. 用戶分析

- 使用 `GET /api/analytics/user-effectiveness` 建立個人數據頁面
- 顯示用戶個人推薦效果
- 提供演算法偏好分析

### 4. A/B 測試監控

- 使用 A/B 測試相關API建立測試管理介面
- 即時監控測試進度和結果
- 提供測試結果視覺化

### 5. 數據追蹤整合

- 在推薦展示時調用 `POST /api/analytics/track-recommendation`
- 在用戶互動時調用 `PUT /api/analytics/update-interaction`
- 確保數據完整性和即時性

---

## 錯誤處理

### 常見錯誤碼

| 狀態碼 | 說明         | 處理方式              |
| ------ | ------------ | --------------------- |
| 400    | 請求參數錯誤 | 檢查必要參數是否正確  |
| 401    | 未授權       | 檢查認證token是否有效 |
| 404    | 資源不存在   | 檢查ID或路徑是否正確  |
| 500    | 伺服器錯誤   | 稍後重試或聯繫管理員  |

### 錯誤響應格式

```typescript
{
  success: false
  error: string // 錯誤訊息
}
```

---

## 效能考量

### 快取策略

- 儀表板數據快取5分鐘
- 日統計數據快取1小時
- 演算法比較數據快取1小時

### 分頁支援

- A/B測試列表支援分頁
- 建議每頁10-20條記錄
- 提供總數和頁數資訊

### 時間範圍限制

- 建議查詢時間範圍不超過90天
- 大範圍查詢可能影響效能
- 支援增量數據載入

---

## 更新日誌

- **v1.0.0** - 初始版本，包含基礎分析功能
- **v1.1.0** - 新增A/B測試管理功能
- **v1.2.0** - 優化效能和快取策略
- **v1.3.0** - 新增用戶個人分析功能

---

## 聯繫資訊

如有問題或建議，請聯繫後端開發團隊。
