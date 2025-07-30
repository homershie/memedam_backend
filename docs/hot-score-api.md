# 熱門分數 API 文檔

## 概述

熱門分數系統為迷因平台提供智能推薦功能，透過多種演算法計算迷因的熱門程度，並提供相應的 API 端點。

## 熱門分數演算法

### 自定義迷因熱門分數演算法

綜合考慮以下因素：

- **讚數** (權重: 1.0)
- **噓數** (權重: -0.5，會降低分數)
- **瀏覽數** (權重: 0.1)
- **留言數** (權重: 2.0)
- **收藏數** (權重: 3.0)
- **分享數** (權重: 2.5)
- **時間衰減因子** (對數衰減)

### 熱門等級分類

- **viral** (≥1000): 病毒式傳播
- **trending** (≥500): 趨勢熱門
- **popular** (≥100): 受歡迎
- **active** (≥50): 活躍
- **normal** (≥10): 一般
- **new** (<10): 新內容

## API 端點

### 1. 更新單一迷因熱門分數

**PUT** `/memes/:id/hot-score`

更新指定迷因的熱門分數。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "meme_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "hot_score": 245.67,
    "hot_level": "popular",
    "engagement_score": 12.5,
    "quality_score": 85.2,
    "updated_at": "2024-01-15T10:30:00.000Z"
  },
  "error": null
}
```

### 2. 批次更新熱門分數

**POST** `/memes/batch-update-hot-scores`

批次更新所有迷因的熱門分數。

**權限**: 需要登入

**查詢參數**:

- `limit` (number): 更新數量限制 (預設: 1000)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "updated_count": 150,
    "results": [
      {
        "meme_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "搞笑迷因",
        "hot_score": 245.67,
        "hot_level": "popular"
      }
    ],
    "message": "成功更新 150 個迷因的熱門分數"
  },
  "error": null
}
```

### 3. 取得熱門迷因列表

**GET** `/memes/hot/list`

取得基於熱門分數排序的迷因列表。

**查詢參數**:

- `limit` (number): 返回數量 (預設: 50)
- `days` (number): 時間範圍天數 (預設: 7)
- `type` (string): 迷因類型篩選 (all, image, video, audio, text)
- `status` (string): 狀態篩選 (預設: public)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "memes": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "搞笑迷因",
        "content": "超好笑的迷因",
        "hot_score": 245.67,
        "hot_level": "popular",
        "engagement_score": 12.5,
        "quality_score": 85.2,
        "author": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "username": "user123",
          "display_name": "用戶123",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "filters": {
      "limit": 50,
      "days": 7,
      "type": "all",
      "status": "public"
    }
  },
  "error": null
}
```

### 4. 取得趨勢迷因列表

**GET** `/memes/trending/list`

取得基於熱門分數和瀏覽數的趨勢迷因列表。

**查詢參數**:

- `limit` (number): 返回數量 (預設: 50)
- `hours` (number): 時間範圍小時數 (預設: 24)
- `type` (string): 迷因類型篩選
- `status` (string): 狀態篩選

**回應範例**:

```json
{
  "success": true,
  "data": {
    "memes": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "趨勢迷因",
        "hot_score": 567.89,
        "hot_level": "trending",
        "engagement_score": 18.3,
        "quality_score": 92.1
      }
    ],
    "filters": {
      "limit": 50,
      "hours": 24,
      "type": "all",
      "status": "public"
    }
  },
  "error": null
}
```

### 5. 取得迷因分數分析

**GET** `/memes/:id/score-analysis`

取得指定迷因的詳細分數分析。

**回應範例**:

```json
{
  "success": true,
  "data": {
    "meme_id": "60f7b3b3b3b3b3b3b3b3b3b3",
    "title": "分析迷因",
    "hot_score": 245.67,
    "hot_level": "popular",
    "engagement_score": 12.5,
    "quality_score": 85.2,
    "stats": {
      "views": 1500,
      "likes": 120,
      "dislikes": 5,
      "comments": 25,
      "collections": 15,
      "shares": 8
    },
    "analysis": {
      "hot_score_formula": "基礎分數 * 時間衰減因子",
      "engagement_rate": "12.50%",
      "quality_ratio": "85.20%",
      "time_factor": "0.847"
    }
  },
  "error": null
}
```

## 管理端點

### 1. 批次更新熱門分數 (管理員)

**POST** `/admin/batch-update-hot-scores`

**權限**: 管理員

**請求體**:

```json
{
  "limit": 1000,
  "force": false
}
```

### 2. 執行定期更新任務 (管理員)

**POST** `/admin/scheduled-hot-score-update`

**權限**: 管理員

**請求體**:

```json
{
  "updateInterval": "1h",
  "maxUpdates": 1000,
  "force": false
}
```

### 3. 取得熱門分數統計 (管理員)

**GET** `/admin/hot-score-statistics`

**權限**: 管理員

**回應範例**:

```json
{
  "success": true,
  "data": {
    "overall": {
      "total_memes": 1500,
      "avg_hot_score": 45.67,
      "max_hot_score": 1234.56,
      "min_hot_score": 0,
      "total_hot_score": 68505
    },
    "by_level": [
      {
        "_id": "normal",
        "count": 800
      },
      {
        "_id": "active",
        "count": 400
      },
      {
        "_id": "popular",
        "count": 200
      },
      {
        "_id": "trending",
        "count": 80
      },
      {
        "_id": "viral",
        "count": 20
      }
    ]
  },
  "message": "已獲取熱門分數統計資訊"
}
```

## 錯誤處理

所有端點都遵循統一的錯誤回應格式：

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

常見錯誤狀態碼：

- `400`: 請求參數錯誤
- `401`: 未授權
- `403`: 權限不足
- `404`: 資源不存在
- `500`: 伺服器內部錯誤

## 使用建議

1. **定期更新**: 建議每小時執行一次批次更新
2. **監控統計**: 定期檢查熱門分數統計，了解平台活躍度
3. **個人化**: 結合用戶行為數據，未來可實作更精準的個人化推薦
4. **效能優化**: 大量更新時建議使用批次處理，避免影響系統效能
