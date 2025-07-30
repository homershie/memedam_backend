# 推薦系統 API 文檔

## 概述

推薦系統為迷因平台提供智能內容推薦功能，支援多種推薦演算法，包括熱門推薦、最新推薦、相似推薦、用戶興趣推薦和混合推薦。

## 推薦演算法

### 1. 熱門推薦 (Hot Recommendations)

- **演算法**: 基於熱門分數排序
- **適用場景**: 發現平台最受歡迎的內容
- **特點**: 考慮讚數、瀏覽數、留言數等多維度指標

### 2. 最新推薦 (Latest Recommendations)

- **演算法**: 基於時間排序
- **適用場景**: 發現最新發布的內容
- **特點**: 優先展示最新內容，適合追蹤趨勢

### 3. 相似推薦 (Similar Recommendations)

- **演算法**: 基於標籤相似度
- **適用場景**: 用戶喜歡某個迷因時，推薦相似內容
- **特點**: 分析標籤重疊度，提供相關內容

### 4. 用戶興趣推薦 (User Interest Recommendations)

- **演算法**: 基於用戶行為分析（未來實作）
- **適用場景**: 個人化推薦
- **特點**: 需要登入，分析用戶互動歷史

### 5. 混合推薦 (Mixed Recommendations)

- **演算法**: 結合多種演算法
- **適用場景**: 平衡多種推薦策略
- **特點**: 可調整權重，提供多樣化內容

## API 端點

### 1. 熱門推薦

**GET** `/recommendations/hot`

取得基於熱門分數的推薦。

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 20)
- `type` (string): 迷因類型篩選 (all, image, video, audio, text)
- `days` (number): 時間範圍天數 (預設: 7)
- `exclude_viewed` (boolean): 是否排除已看過的迷因 (預設: false)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "超好笑迷因",
        "content": "這個迷因真的超好笑",
        "hot_score": 567.89,
        "recommendation_score": 567.89,
        "recommendation_type": "hot",
        "hot_level": "trending",
        "author": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "username": "user123",
          "display_name": "用戶123",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "filters": {
      "type": "all",
      "days": 7,
      "limit": 20
    },
    "algorithm": "hot_score"
  },
  "error": null
}
```

### 2. 最新推薦

**GET** `/recommendations/latest`

取得基於時間的最新推薦。

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 20)
- `type` (string): 迷因類型篩選
- `hours` (number): 時間範圍小時數 (預設: 24)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "最新迷因",
        "recommendation_score": 0.000123,
        "recommendation_type": "latest",
        "time_factor": 2
      }
    ],
    "filters": {
      "type": "all",
      "hours": 24,
      "limit": 20
    },
    "algorithm": "latest"
  },
  "error": null
}
```

### 3. 相似推薦

**GET** `/recommendations/similar/:memeId`

取得與指定迷因相似的推薦。

**路徑參數**:

- `memeId` (string): 目標迷因ID

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 10)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "target_meme": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "title": "原始迷因",
      "tags": ["搞笑", "貓咪", "日常"]
    },
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
        "title": "相似迷因",
        "recommendation_score": 0.67,
        "recommendation_type": "similar",
        "common_tags": ["搞笑", "貓咪"],
        "similarity_score": 0.67
      }
    ],
    "filters": {
      "limit": 10
    },
    "algorithm": "similar_tags"
  },
  "error": null
}
```

### 4. 用戶興趣推薦

**GET** `/recommendations/user-interest`

取得基於用戶興趣的個人化推薦。

**權限**: 需要登入

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 20)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "個人化推薦",
        "recommendation_score": 245.67,
        "recommendation_type": "user_interest",
        "personalization_level": "basic"
      }
    ],
    "user_id": "60f7b3b3b3b3b3b3b3b3b3b6",
    "filters": {
      "limit": 20
    },
    "algorithm": "user_interest",
    "note": "目前使用基礎推薦，未來將實作更進階的個人化演算法"
  },
  "error": null
}
```

### 5. 混合推薦

**GET** `/recommendations/mixed`

取得結合多種演算法的混合推薦。

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 30)
- `hot_weight` (number): 熱門分數權重 (預設: 0.4)
- `latest_weight` (number): 最新分數權重 (預設: 0.3)
- `similar_weight` (number): 相似分數權重 (預設: 0.3)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "混合推薦迷因",
        "recommendation_score": 234.56,
        "recommendation_type": "mixed",
        "hot_score_weight": 0.4,
        "latest_weight": 0.3,
        "hot_level": "popular"
      }
    ],
    "filters": {
      "limit": 30,
      "hot_weight": 0.4,
      "latest_weight": 0.3,
      "similar_weight": 0.3
    },
    "algorithm": "mixed",
    "weights": {
      "hot": 0.4,
      "latest": 0.3,
      "similar": 0.3
    }
  },
  "error": null
}
```

### 6. 推薦統計

**GET** `/recommendations/stats`

取得推薦系統統計資訊。

**回應範例**:

```json
{
  "success": true,
  "data": {
    "total_memes": 1500,
    "hot_memes": 200,
    "trending_memes": 80,
    "viral_memes": 20
  },
  "error": null
}
```

### 7. 綜合推薦

**GET** `/recommendations`

取得綜合推薦，可指定演算法。

**查詢參數**:

- `algorithm` (string): 推薦演算法 (hot, latest, mixed, user-interest)
- `limit` (number): 推薦數量 (預設: 20)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "綜合推薦迷因",
        "recommendation_score": 345.67,
        "recommendation_type": "mixed"
      }
    ],
    "algorithm": "mixed"
  },
  "error": null
}
```

## 推薦分數說明

### 熱門推薦分數

- 直接使用迷因的熱門分數
- 範圍: 0 到無限大
- 越高表示越受歡迎

### 最新推薦分數

- 基於時間倒數計算
- 公式: `1 / (當前時間 - 創建時間)`
- 越新的內容分數越高

### 相似推薦分數

- 基於標籤重疊度計算
- 公式: `共同標籤數 / 目標迷因標籤總數`
- 範圍: 0 到 1

### 混合推薦分數

- 結合多種演算法的加權分數
- 公式: `(熱門分數 × 熱門權重) + (時間分數 × 最新權重)`
- 可調整權重平衡不同策略

## 使用建議

### 前端實作建議

1. **首頁推薦**:

   ```javascript
   // 使用混合推薦，平衡熱門和最新
   const response = await fetch('/recommendations/mixed?limit=20&hot_weight=0.6&latest_weight=0.4')
   ```

2. **探索頁面**:

   ```javascript
   // 使用熱門推薦，發現最受歡迎內容
   const response = await fetch('/recommendations/hot?limit=30&days=7')
   ```

3. **相似內容**:

   ```javascript
   // 在迷因詳情頁面推薦相似內容
   const response = await fetch(`/recommendations/similar/${memeId}?limit=10`)
   ```

4. **個人化推薦**:
   ```javascript
   // 需要登入，提供個人化內容
   const response = await fetch('/recommendations/user-interest?limit=20', {
     headers: { Authorization: `Bearer ${token}` },
   })
   ```

### 效能優化建議

1. **快取策略**: 熱門推薦可快取 5-10 分鐘
2. **分頁處理**: 大量推薦時使用分頁
3. **條件篩選**: 根據用戶偏好篩選內容類型
4. **A/B 測試**: 測試不同演算法的效果

### 未來擴展

1. **機器學習**: 實作基於用戶行為的 ML 推薦
2. **協同過濾**: 基於相似用戶的推薦
3. **內容分析**: 分析迷因內容特徵
4. **實時推薦**: 支援實時更新推薦結果

## 錯誤處理

所有端點都遵循統一的錯誤回應格式：

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

常見錯誤：

- `401`: 用戶興趣推薦需要登入
- `404`: 相似推薦的目標迷因不存在
- `500`: 伺服器內部錯誤
