# 推薦系統 API 文檔

## 概述

推薦系統為迷因平台提供智能內容推薦功能，支援多種推薦演算法，包括熱門推薦、最新推薦、相似推薦、內容基礎推薦、用戶興趣推薦和混合推薦。系統會分析用戶的互動歷史和內容特徵，為用戶提供個人化的迷因推薦。

## 熱門分數系統

### 熱門分數演算法

#### 自定義迷因熱門分數演算法

綜合考慮以下因素：

- **讚數** (權重: 1.0)
- **噓數** (權重: -0.5，會降低分數)
- **瀏覽數** (權重: 0.1)
- **留言數** (權重: 2.0)
- **收藏數** (權重: 3.0)
- **分享數** (權重: 2.5)
- **時間衰減因子** (對數衰減)

#### 熱門等級分類

- **viral** (≥1000): 病毒式傳播
- **trending** (≥500): 趨勢熱門
- **popular** (≥100): 受歡迎
- **active** (≥50): 活躍
- **normal** (≥10): 一般
- **new** (<10): 新內容

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

### 4. 內容基礎推薦 (Content-Based Recommendations)

- **演算法**: 基於用戶標籤偏好和迷因標籤相似度
- **適用場景**: 個人化推薦，需要登入
- **特點**:
  - 分析用戶的互動歷史（按讚、留言、分享、收藏、瀏覽）
  - 計算用戶對不同標籤的偏好權重
  - 支援時間衰減，新互動權重更高
  - 基於 Jaccard 相似度計算標籤重疊度
  - 結合用戶偏好進行加權計算

### 5. 標籤相關推薦 (Tag-Based Recommendations)

- **演算法**: 基於指定標籤的相關迷因推薦
- **適用場景**: "更多相似內容"功能
- **特點**:
  - 計算迷因標籤與查詢標籤的相似度
  - 結合熱門分數提升推薦品質
  - 支援多標籤查詢

### 6. 協同過濾推薦 (Collaborative Filtering Recommendations)

- **演算法**: 基於用戶行為相似性
- **適用場景**: 個人化推薦，發現新內容
- **特點**:
  - 分析用戶的互動歷史（按讚、留言、分享、收藏、瀏覽）
  - 建立用戶-迷因互動矩陣
  - 計算用戶間的相似度（基於皮爾遜相關係數）
  - 推薦相似用戶喜歡但當前用戶未互動的內容
  - 支援時間衰減，新互動權重更高
  - 結合熱門分數提升推薦品質

### 7. 社交協同過濾推薦 (Social Collaborative Filtering Recommendations)

- **演算法**: 基於社交關係和用戶行為相似性
- **適用場景**: 個人化推薦，需要登入
- **特點**:
  - 分析用戶的社交關係圖譜（追隨者、追隨中、互追）
  - 計算社交影響力分數和社交相似度
  - 結合行為相似度和社交相似度進行推薦
  - 考慮社交影響力加權，影響力高的用戶推薦權重更大
  - 支援時間衰減，新互動權重更高
  - 結合熱門分數提升推薦品質

### 8. 用戶興趣推薦 (User Interest Recommendations)

- **演算法**: 基於用戶行為分析（未來實作）
- **適用場景**: 個人化推薦
- **特點**: 需要登入，分析用戶互動歷史

### 9. 社交層分數計算 (Social Score Calculation)

- **演算法**: 基於社交關係的詳細分數計算
- **適用場景**: 社交推薦和影響力分析
- **特點**:
  - 考慮社交距離（直接關注、互相關注、二度關係、三度關係）
  - 計算社交影響力分數
  - 分析不同類型的社交互動（發佈、按讚、留言、分享、收藏、瀏覽）
  - 生成具體的推薦原因說明
  - 限制分數上限避免單一迷因爆分

### 9. 混合推薦 (Mixed Recommendations)

- **演算法**: 結合多種演算法
- **適用場景**: 平衡多種推薦策略
- **特點**: 可調整權重，提供多樣化內容

## API 端點

### 推薦系統端點

#### 1. 熱門推薦

**GET** `/api/recommendations/hot`

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

#### 2. 最新推薦

**GET** `/api/recommendations/latest`

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

#### 3. 相似推薦

**GET** `/api/recommendations/similar/:memeId`

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

#### 4. 內容基礎推薦

**GET** `/api/recommendations/content-based`

取得基於用戶標籤偏好的個人化推薦。

**權限**: 需要登入

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 20)
- `min_similarity` (number): 最小相似度閾值 (預設: 0.1)
- `exclude_interacted` (boolean): 是否排除已互動的迷因 (預設: true)
- `include_hot_score` (boolean): 是否結合熱門分數 (預設: true)
- `hot_score_weight` (number): 熱門分數權重 (預設: 0.3)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "Funny Meme",
        "content": "...",
        "image_url": "...",
        "tags_cache": ["funny", "meme", "viral"],
        "recommendation_score": 0.85,
        "recommendation_type": "content_based",
        "content_similarity": 0.75,
        "preference_match": 0.82,
        "matched_tags": ["funny", "meme"],
        "user_preferences": {
          "funny": 0.8,
          "meme": 0.6,
          "viral": 0.4
        },
        "author": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "username": "user123",
          "display_name": "用戶123",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "user_id": "user123",
    "filters": {
      "limit": 20,
      "min_similarity": 0.1,
      "exclude_interacted": true,
      "include_hot_score": true,
      "hot_score_weight": 0.3
    },
    "algorithm": "content_based",
    "algorithm_details": {
      "description": "基於用戶標籤偏好和迷因標籤相似度的推薦演算法",
      "features": [
        "分析用戶的按讚、留言、分享、收藏、瀏覽歷史",
        "計算用戶對不同標籤的偏好權重",
        "基於標籤相似度計算迷因推薦分數",
        "結合熱門分數提升推薦品質",
        "支援時間衰減，新互動權重更高"
      ]
    }
  },
  "error": null
}
```

#### 5. 標籤相關推薦

**GET** `/api/recommendations/tag-based`

取得基於指定標籤的相關迷因推薦。

**查詢參數**:

- `tags` (string): 標籤列表（逗號分隔，必填）
- `limit` (number): 推薦數量 (預設: 20)
- `min_similarity` (number): 最小相似度閾值 (預設: 0.1)
- `include_hot_score` (boolean): 是否結合熱門分數 (預設: true)
- `hot_score_weight` (number): 熱門分數權重 (預設: 0.3)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "Funny Meme",
        "content": "...",
        "image_url": "...",
        "tags_cache": ["funny", "meme", "viral"],
        "recommendation_score": 0.75,
        "recommendation_type": "tag_based",
        "tag_similarity": 0.75,
        "matched_tags": ["funny", "meme"],
        "query_tags": ["funny", "meme", "viral"],
        "author": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "username": "user123",
          "display_name": "用戶123",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "query_tags": ["funny", "meme", "viral"],
    "filters": {
      "limit": 20,
      "min_similarity": 0.1,
      "include_hot_score": true,
      "hot_score_weight": 0.3
    },
    "algorithm": "tag_based",
    "algorithm_details": {
      "description": "基於指定標籤的相關迷因推薦",
      "features": ["計算迷因標籤與查詢標籤的相似度", "結合熱門分數提升推薦品質", "支援多標籤查詢"]
    }
  },
  "error": null
}
```

#### 6. 用戶標籤偏好分析

**GET** `/api/recommendations/user-preferences`

取得用戶的標籤偏好分析。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "preferences": {
      "funny": 0.8,
      "meme": 0.6,
      "viral": 0.4,
      "comedy": 0.3
    },
    "interaction_counts": {
      "funny": 15,
      "meme": 12,
      "viral": 8,
      "comedy": 6
    },
    "total_interactions": 41,
    "confidence": 0.75,
    "analysis": {
      "top_tags": [
        { "tag": "funny", "score": 0.8 },
        { "tag": "meme", "score": 0.6 },
        { "tag": "viral", "score": 0.4 }
      ],
      "total_tags": 4,
      "confidence_level": "high"
    }
  },
  "error": null
}
```

#### 7. 更新用戶偏好快取

**POST** `/api/recommendations/update-preferences`

重新計算並更新用戶的標籤偏好快取。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "preferences": {
      "funny": 0.8,
      "meme": 0.6,
      "viral": 0.4
    },
    "confidence": 0.75,
    "updated_at": "2024-12-01T10:00:00.000Z",
    "message": "用戶偏好已成功更新"
  },
  "error": null
}
```

#### 8. 協同過濾推薦

**GET** `/api/recommendations/collaborative-filtering`

取得基於用戶行為相似性的協同過濾推薦。

**權限**: 需要登入

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 20)
- `min_similarity` (number): 最小相似度閾值 (預設: 0.1)
- `max_similar_users` (number): 最大相似用戶數 (預設: 50)
- `exclude_interacted` (boolean): 是否排除已互動的迷因 (預設: true)
- `include_hot_score` (boolean): 是否結合熱門分數 (預設: true)
- `hot_score_weight` (number): 熱門分數權重 (預設: 0.3)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "Funny Meme",
        "content": "...",
        "image_url": "...",
        "recommendation_score": 0.85,
        "recommendation_type": "collaborative_filtering",
        "collaborative_score": 0.75,
        "similar_users_count": 12,
        "average_similarity": 0.68,
        "author": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "username": "user123",
          "display_name": "用戶123",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "user_id": "user123",
    "filters": {
      "limit": 20,
      "min_similarity": 0.1,
      "max_similar_users": 50,
      "exclude_interacted": true,
      "include_hot_score": true,
      "hot_score_weight": 0.3
    },
    "algorithm": "collaborative_filtering",
    "algorithm_details": {
      "description": "基於用戶行為相似性的協同過濾推薦演算法",
      "features": [
        "分析用戶的按讚、留言、分享、收藏、瀏覽歷史",
        "計算用戶間的相似度",
        "推薦相似用戶喜歡但當前用戶未互動的內容",
        "結合熱門分數提升推薦品質",
        "支援時間衰減，新互動權重更高"
      ]
    }
  },
  "error": null
}
```

#### 9. 社交協同過濾推薦

**GET** `/api/recommendations/social-collaborative-filtering`

取得基於社交關係和用戶行為相似性的社交協同過濾推薦。

**權限**: 需要登入

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 20)
- `min_similarity` (number): 最小相似度閾值 (預設: 0.1)
- `max_similar_users` (number): 最大相似用戶數 (預設: 50)
- `exclude_interacted` (boolean): 是否排除已互動的迷因 (預設: true)
- `include_hot_score` (boolean): 是否結合熱門分數 (預設: true)
- `hot_score_weight` (number): 熱門分數權重 (預設: 0.3)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "title": "Funny Meme",
        "content": "...",
        "image_url": "...",
        "recommendation_score": 0.85,
        "recommendation_type": "social_collaborative_filtering",
        "social_collaborative_score": 0.75,
        "similar_users_count": 12,
        "average_similarity": 0.68,
        "average_influence_score": 25.5,
        "author": {
          "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
          "username": "user123",
          "display_name": "用戶123",
          "avatar": "https://example.com/avatar.jpg"
        }
      }
    ],
    "user_id": "user123",
    "filters": {
      "limit": 20,
      "min_similarity": 0.1,
      "max_similar_users": 50,
      "exclude_interacted": true,
      "include_hot_score": true,
      "hot_score_weight": 0.3
    },
    "algorithm": "social_collaborative_filtering",
    "algorithm_details": {
      "description": "基於社交關係和用戶行為相似性的社交協同過濾推薦演算法",
      "features": [
        "分析用戶的社交關係圖譜（追隨者、追隨中、互追）",
        "計算社交影響力分數和社交相似度",
        "結合行為相似度和社交相似度進行推薦",
        "考慮社交影響力加權，影響力高的用戶推薦權重更大",
        "支援時間衰減，新互動權重更高"
      ]
    }
  },
  "error": null
}
```

#### 9. 用戶協同過濾統計

**GET** `/api/recommendations/collaborative-filtering-stats`

取得用戶的協同過濾相關統計資訊。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "interaction_count": 45,
    "similar_users_count": 12,
    "average_similarity": 0.68,
    "top_similar_users": [
      {
        "user_id": "user456",
        "similarity": 0.85,
        "interaction_count": 38
      },
      {
        "user_id": "user789",
        "similarity": 0.72,
        "interaction_count": 42
      }
    ],
    "interaction_distribution": {
      "total_interactions": 156.5,
      "positive_interactions": 42,
      "negative_interactions": 3
    }
  },
  "error": null
}
```

#### 10. 用戶社交協同過濾統計

**GET** `/api/recommendations/social-collaborative-filtering-stats`

取得用戶的社交協同過濾相關統計資訊。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "interaction_count": 45,
    "social_connections": 25,
    "followers_count": 15,
    "following_count": 10,
    "mutual_follows_count": 5,
    "influence_score": 28.5,
    "social_similar_users_count": 8,
    "average_social_similarity": 0.72,
    "top_social_similar_users": [
      {
        "user_id": "user456",
        "similarity": 0.85,
        "influence_score": 35.2,
        "social_connections": 30
      },
      {
        "user_id": "user789",
        "similarity": 0.72,
        "influence_score": 22.1,
        "social_connections": 18
      }
    ],
    "social_network_analysis": {
      "total_connections": 25,
      "influence_level": "medium",
      "social_activity": "active",
      "network_density": 0.2
    }
  },
  "error": null
}
```

#### 10. 更新協同過濾快取

**POST** `/api/recommendations/update-collaborative-filtering-cache`

重新計算並更新協同過濾相關的快取數據。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "cache_results": {
      "total_users": 150,
      "total_interactions": 2500,
      "processing_time": 1250
    },
    "updated_at": "2024-12-01T10:00:00.000Z",
    "message": "協同過濾快取已成功更新"
  },
  "error": null
}
```

#### 11. 更新社交協同過濾快取

**POST** `/api/recommendations/update-social-collaborative-filtering-cache`

重新計算並更新社交協同過濾相關的快取數據。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "cache_results": {
      "total_users": 150,
      "total_interactions": 2500,
      "total_social_connections": 1200,
      "average_influence_score": 15.8,
      "processing_time": 1850
    },
    "updated_at": "2024-12-01T10:00:00.000Z",
    "message": "社交協同過濾快取已成功更新"
  },
  "error": null
}
```

#### 11. 用戶興趣推薦

**GET** `/api/recommendations/user-interest`

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

#### 12. 混合推薦

**GET** `/api/recommendations/mixed`

取得結合多種演算法的混合推薦，支援動態權重調整和冷啟動處理。

**查詢參數**:

- `limit` (number): 推薦數量 (預設: 30)
- `custom_weights` (string): 自定義權重 JSON 字串 (預設: {})
- `include_diversity` (boolean): 是否包含多樣性計算 (預設: true)
- `include_cold_start_analysis` (boolean): 是否包含冷啟動分析 (預設: true)
- `include_social_scores` (boolean): 是否包含社交層分數計算 (預設: true)
- `include_recommendation_reasons` (boolean): 是否包含推薦原因生成 (預設: true)

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
        "recommendation_reason": "你的好友 user123 按讚了這則迷因",
        "recommendation_reasons": [
          {
            "type": "like",
            "text": "你的好友 user123 按讚了這則迷因",
            "weight": 12.5,
            "userId": "60f7b3b3b3b3b3b3b3b3b3b4",
            "username": "user123"
          }
        ],
        "social_score": 15.2,
        "social_distance_score": 3.5,
        "social_influence_score": 8.7,
        "social_interaction_score": 3.0,
        "social_interactions": [
          {
            "userId": "60f7b3b3b3b3b3b3b3b3b3b4",
            "username": "user123",
            "displayName": "用戶123",
            "action": "like",
            "weight": 12.5,
            "distance": 1,
            "distanceType": "direct_follow",
            "influenceScore": 25.3,
            "influenceLevel": "active"
          }
        ],
        "algorithm_scores": {
          "hot": 567.89,
          "latest": 0.000123,
          "content_based": 0.85
        },
        "total_score": 234.56,
        "hot_level": "popular"
      }
    ],
    "filters": {
      "limit": 30,
      "custom_weights": {},
      "include_diversity": true,
      "include_cold_start_analysis": true
    },
    "algorithm": "mixed",
    "weights": {
      "hot": 0.25,
      "latest": 0.25,
      "content_based": 0.2,
      "collaborative_filtering": 0.15,
      "social_collaborative_filtering": 0.15
    },
    "cold_start_status": {
      "isColdStart": false,
      "activityScore": {
        "score": 45.2,
        "level": "active",
        "totalInteractions": 156
      },
      "userPreferences": {
        "preferences": {
          "funny": 0.8,
          "meme": 0.6,
          "viral": 0.4
        }
      }
    },
    "diversity": {
      "tagDiversity": 0.75,
      "authorDiversity": 0.6,
      "uniqueTags": 15,
      "uniqueAuthors": 12,
      "totalTags": 20,
      "totalAuthors": 20
    },
    "user_authenticated": true,
    "algorithm_details": {
      "description": "整合所有推薦演算法的混合推薦系統",
      "features": [
        "支援動態權重調整",
        "冷啟動處理機制",
        "多樣性計算",
        "用戶活躍度分析",
        "個人化推薦策略"
      ]
    }
  },
  "error": null
}
```

#### 13. 推薦演算法統計

**GET** `/api/recommendations/algorithm-stats`

取得推薦演算法統計，包含用戶活躍度和冷啟動分析。

**權限**: 需要登入

#### 14. 社交層分數計算

**GET** `/api/recommendations/social-score/:memeId`

計算迷因的社交層分數，包含社交距離、影響力和互動分析。

**權限**: 需要登入

**路徑參數**:

- `memeId` (string): 迷因ID

**查詢參數**:

- `include_distance` (boolean): 是否包含社交距離計算 (預設: true)
- `include_influence` (boolean): 是否包含影響力計算 (預設: true)
- `include_interactions` (boolean): 是否包含互動計算 (預設: true)
- `max_distance` (number): 最大社交距離 (預設: 3)

**回應範例**:

```json
{
  "success": true,
  "data": {
    "socialScore": 15.2,
    "distanceScore": 3.5,
    "influenceScore": 8.7,
    "interactionScore": 3.0,
    "reasons": [
      {
        "type": "like",
        "text": "你的好友 user123 按讚了這則迷因",
        "weight": 12.5,
        "userId": "60f7b3b3b3b3b3b3b3b3b3b4",
        "username": "user123"
      }
    ],
    "socialInteractions": [
      {
        "userId": "60f7b3b3b3b3b3b3b3b3b3b4",
        "username": "user123",
        "displayName": "用戶123",
        "action": "like",
        "weight": 12.5,
        "distance": 1,
        "distanceType": "direct_follow",
        "influenceScore": 25.3,
        "influenceLevel": "active"
      }
    ],
    "algorithm_details": {
      "description": "基於社交關係的詳細分數計算",
      "features": [
        "考慮社交距離（直接關注、互相關注、二度關係、三度關係）",
        "計算社交影響力分數",
        "分析不同類型的社交互動（發佈、按讚、留言、分享、收藏、瀏覽）",
        "生成具體的推薦原因說明",
        "限制分數上限避免單一迷因爆分"
      ]
    }
  },
  "error": null
}
```

#### 15. 用戶社交影響力統計

**GET** `/api/recommendations/social-influence-stats`

取得用戶的社交影響力統計，包含追隨者、影響力等級等資訊。

**權限**: 需要登入

**回應範例**:

```json
{
  "success": true,
  "data": {
    "influenceScore": 25.3,
    "influenceLevel": "active",
    "followers": 45,
    "following": 32,
    "mutualFollows": 18,
    "networkDensity": 0.77,
    "socialReach": 63
  },
  "error": null
}
```

**回應範例**:

```json
{
  "success": true,
  "data": {
    "totalMemes": 1500,
    "hotMemes": 200,
    "trendingMemes": 80,
    "viralMemes": 20,
    "userActivity": {
      "score": 45.2,
      "level": "active",
      "totalInteractions": 156,
      "breakdown": {
        "likes": 45,
        "comments": 23,
        "shares": 12,
        "collections": 34,
        "views": 42
      }
    },
    "coldStart": false,
    "userPreferences": {
      "preferences": {
        "funny": 0.8,
        "meme": 0.6,
        "viral": 0.4
      }
    }
  },
  "error": null
}
```

#### 14. 動態調整推薦策略

**POST** `/api/recommendations/adjust-strategy`

根據用戶行為動態調整推薦策略。

**權限**: 需要登入

**請求體**:

```json
{
  "userBehavior": {
    "clickRate": 0.35,
    "engagementRate": 0.6,
    "diversityPreference": 0.8
  }
}
```

**回應範例**:

```json
{
  "success": true,
  "data": {
    "weights": {
      "content_based": 0.35,
      "collaborative_filtering": 0.25,
      "social_collaborative_filtering": 0.2,
      "hot": 0.1,
      "latest": 0.1
    },
    "focus": "personalization",
    "coldStartHandling": false
  },
  "error": null
}
```

#### 15. 推薦統計

**GET** `/api/recommendations/stats`

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

#### 13. 綜合推薦

**GET** `/api/recommendations`

取得綜合推薦，可指定演算法。

**查詢參數**:

- `algorithm` (string): 推薦演算法 (hot, latest, mixed, user-interest, content-based, tag-based, collaborative-filtering)
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

### 熱門分數管理端點

#### 1. 更新單一迷因熱門分數

**PUT** `/api/memes/:id/hot-score`

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

#### 2. 批次更新熱門分數

**POST** `/api/memes/batch-update-hot-scores`

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

#### 3. 取得熱門迷因列表

**GET** `/api/memes/hot/list`

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

#### 4. 取得趨勢迷因列表

**GET** `/api/memes/trending/list`

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

#### 5. 取得迷因分數分析

**GET** `/api/memes/:id/score-analysis`

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

### 管理端點

#### 1. 批次更新熱門分數 (管理員)

**POST** `/api/admin/batch-update-hot-scores`

**權限**: 管理員

**請求體**:

```json
{
  "limit": 1000,
  "force": false
}
```

#### 2. 執行定期更新任務 (管理員)

**POST** `/api/admin/scheduled-hot-score-update`

**權限**: 管理員

**請求體**:

```json
{
  "updateInterval": "1h",
  "maxUpdates": 1000,
  "force": false
}
```

#### 3. 取得熱門分數統計 (管理員)

**GET** `/api/admin/hot-score-statistics`

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

## 演算法詳情

### 1. 用戶標籤偏好計算

```javascript
// 互動權重配置
const interactionWeights = {
  like: 1.0, // 按讚權重
  comment: 2.0, // 留言權重（互動性更高）
  share: 3.0, // 分享權重（傳播性最強）
  collection: 1.5, // 收藏權重
  view: 0.1, // 瀏覽權重
}

// 時間衰減計算
const timeDecay = Math.pow(decayFactor, daysSince)

// 最終偏好分數
const preferenceScore = interactionWeight * timeDecay
```

### 2. 標籤相似度計算

```javascript
// Jaccard 相似度
const jaccardSimilarity = intersection.length / union.length

// 結合用戶偏好的相似度
const weightedSimilarity = jaccardSimilarity * 0.6 + preferenceWeight * 0.4
```

### 3. 內容基礎推薦分數計算

```javascript
// 偏好匹配度
const preferenceMatch = matchRatio * 0.4 + averagePreference * 0.6

// 內容相似度
const contentSimilarity = calculateTagSimilarity(memeTags, userTopTags)

// 最終推薦分數
const finalScore = preferenceMatch * 0.6 + contentSimilarity * 0.4

// 結合熱門分數
const finalScoreWithHot = finalScore * 0.7 + normalizedHotScore * 0.3
```

### 4. 協同過濾推薦分數計算

```javascript
// 互動權重配置
const interactionWeights = {
  like: 1.0, // 按讚權重
  dislike: -0.5, // 按噓權重（負面）
  comment: 2.0, // 留言權重（互動性更高）
  share: 3.0, // 分享權重（傳播性最強）
  collection: 1.5, // 收藏權重
  view: 0.1, // 瀏覽權重
}

// 時間衰減計算
const timeDecay = Math.pow(decayFactor, daysSince)
const interactionScore = interactionWeight * timeDecay

// 用戶相似度計算（皮爾遜相關係數）
const similarity = calculatePearsonCorrelation(user1Interactions, user2Interactions)

// 協同過濾推薦分數
const collaborativeScore = (totalScore * similarity) / totalSimilarity

// 結合熱門分數
const finalScore = collaborativeScore * (1 - hotScoreWeight) + normalizedHotScore * hotScoreWeight
```

### 5. 社交協同過濾推薦分數計算

```javascript
// 社交影響力配置
const socialInfluenceConfig = {
  followerWeight: 0.3, // 追隨者權重
  followingWeight: 0.2, // 追隨中權重
  mutualFollowWeight: 0.5, // 互追權重
  influenceDecayFactor: 0.9, // 影響力衰減因子
}

// 社交影響力分數計算
const influenceScore =
  followerCount * socialInfluenceConfig.followerWeight +
  followingCount * socialInfluenceConfig.followingWeight +
  mutualCount * socialInfluenceConfig.mutualFollowWeight

// 應用對數衰減
const finalInfluenceScore = Math.log10(influenceScore + 1) * 10

// 社交相似度計算
const socialSimilarity = calculateSocialSimilarity(user1Id, user2Id, socialGraph)

// 社交加權相似度
const socialWeightedSimilarity =
  behaviorSimilarity * 0.6 + // 行為相似度權重
  socialSimilarity * 0.3 + // 社交相似度權重
  influenceWeight * 0.1 // 影響力權重

// 社交協同過濾推薦分數
const socialCollaborativeScore = (totalScore * socialWeightedSimilarity) / totalSimilarity

// 結合熱門分數
const finalScore =
  socialCollaborativeScore * (1 - hotScoreWeight) + normalizedHotScore * hotScoreWeight
```

### 6. 熱門分數計算

```javascript
// 基礎分數計算
const baseScore =
  likes * 1.0 + dislikes * -0.5 + views * 0.1 + comments * 2.0 + collections * 3.0 + shares * 2.5

// 時間衰減因子
const timeFactor = Math.log10(Date.now() - createdAt + 1) / Math.log10(86400000 + 1)

// 最終熱門分數
const hotScore = baseScore * timeFactor
```

### 5. 推薦分數說明

#### 熱門推薦分數

- 直接使用迷因的熱門分數
- 範圍: 0 到無限大
- 越高表示越受歡迎

#### 最新推薦分數

- 基於時間倒數計算
- 公式: `1 / (當前時間 - 創建時間)`
- 越新的內容分數越高

#### 相似推薦分數

- 基於標籤重疊度計算
- 公式: `共同標籤數 / 目標迷因標籤總數`
- 範圍: 0 到 1

#### 內容基礎推薦分數

- 基於用戶標籤偏好和迷因標籤相似度
- 結合偏好匹配度和內容相似度
- 範圍: 0 到 1

#### 協同過濾推薦分數

- 基於用戶行為相似性
- 計算相似用戶的加權平均分數
- 範圍: 0 到無限大
- 結合熱門分數提升推薦品質

#### 社交協同過濾推薦分數

- 基於社交關係和用戶行為相似性
- 結合行為相似度、社交相似度和影響力分數
- 考慮社交影響力加權，影響力高的用戶推薦權重更大
- 範圍: 0 到無限大
- 結合熱門分數提升推薦品質

#### 混合推薦分數

- 結合多種演算法的加權分數
- 公式: `(熱門分數 × 熱門權重) + (時間分數 × 最新權重) + (內容分數 × 內容權重) + (協同過濾分數 × 協同過濾權重)`
- 可調整權重平衡不同策略

## 使用建議

### 前端實作建議

1. **首頁推薦**:

   ```javascript
   // 使用混合推薦，平衡熱門、最新和內容基礎
   const response = await fetch(
     '/api/recommendations/mixed?limit=20&hot_weight=0.4&latest_weight=0.3&content_weight=0.3',
   )
   ```

2. **探索頁面**:

   ```javascript
   // 使用熱門推薦，發現最受歡迎內容
   const response = await fetch('/api/recommendations/hot?limit=30&days=7')
   ```

3. **個人化推薦**:

   ```javascript
   // 需要登入，提供個人化內容
   const response = await fetch('/api/recommendations/content-based?limit=20', {
     headers: { Authorization: `Bearer ${token}` },
   })
   ```

4. **協同過濾推薦**:

   ```javascript
   // 基於用戶行為相似性的推薦
   const response = await fetch('/api/recommendations/collaborative-filtering?limit=20', {
     headers: { Authorization: `Bearer ${token}` },
   })
   ```

5. **協同過濾統計**:

   ```javascript
   // 分析用戶的協同過濾相關統計
   const response = await fetch('/api/recommendations/collaborative-filtering-stats', {
     headers: { Authorization: `Bearer ${token}` },
   })
   ```

6. **社交協同過濾推薦**:

   ```javascript
   // 基於社交關係和用戶行為相似性的推薦
   const response = await fetch('/api/recommendations/social-collaborative-filtering?limit=20', {
     headers: { Authorization: `Bearer ${token}` },
   })
   ```

7. **社交協同過濾統計**:

   ```javascript
   // 分析用戶的社交協同過濾相關統計
   const response = await fetch('/api/recommendations/social-collaborative-filtering-stats', {
     headers: { Authorization: `Bearer ${token}` },
   })
   ```

8. **相似內容**:

   ```javascript
   // 在迷因詳情頁面推薦相似內容
   const response = await fetch(`/api/recommendations/similar/${memeId}?limit=10`)
   ```

9. **標籤相關推薦**:

   ```javascript
   // 基於標籤的相關內容推薦
   const response = await fetch('/api/recommendations/tag-based?tags=funny,meme,viral&limit=15')
   ```

10. **用戶偏好分析**:

    ```javascript
    // 分析用戶的標籤偏好
    const response = await fetch('/api/recommendations/user-preferences', {
      headers: { Authorization: `Bearer ${token}` },
    })
    ```

11. **熱門分數管理**:

    ```javascript
    // 更新迷因熱門分數
    const response = await fetch(`/api/memes/${memeId}/hot-score`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })

    // 取得熱門迷因列表
    const response = await fetch('/api/memes/hot/list?limit=50&days=7')
    ```

### 效能優化建議

1. **快取策略**:
   - 熱門推薦可快取 5-10 分鐘
   - 用戶偏好快取 1 小時
   - 推薦結果快取 30 分鐘
   - 標籤相似度快取 15 分鐘

2. **分頁處理**: 大量推薦時使用分頁

3. **條件篩選**: 根據用戶偏好篩選內容類型

4. **A/B 測試**: 測試不同演算法的效果

5. **資料庫索引**:

   ```javascript
   // 建議的索引
   db.memes.createIndex({ tags_cache: 1, status: 1 })
   db.likes.createIndex({ user_id: 1, meme_id: 1 })
   db.collections.createIndex({ user_id: 1, meme_id: 1 })
   db.comments.createIndex({ user_id: 1, meme_id: 1 })
   db.shares.createIndex({ user_id: 1, meme_id: 1 })
   db.views.createIndex({ user_id: 1, meme_id: 1 })
   ```

6. **定期更新**: 建議每小時執行一次熱門分數批次更新

### 冷啟動處理

- 新用戶互動歷史不足時，使用熱門推薦作為備選
- 逐步收集用戶互動數據，提升推薦準確度
- 提供推薦原因說明，增強用戶信任

## 監控指標

### 1. 推薦效果指標

- **點擊率 (CTR)**：推薦內容的點擊率
- **互動率**：推薦內容的按讚、留言、分享率
- **多樣性**：推薦內容的標籤多樣性
- **新穎性**：推薦新內容的比例

### 2. 系統效能指標

- **回應時間**：推薦 API 的平均回應時間
- **快取命中率**：Redis 快取的命中率
- **資料庫查詢時間**：聚合查詢的執行時間

### 3. 用戶行為分析

- **標籤偏好變化**：用戶標籤偏好的時間變化
- **互動模式分析**：不同互動類型的分布
- **推薦接受度**：用戶對推薦內容的接受程度

### 4. 熱門分數監控

- **熱門分數分布**：各等級迷因的數量分布
- **更新頻率**：熱門分數更新的頻率和效能
- **分數變化趨勢**：熱門分數的時間變化趨勢

## 未來擴展

1. **機器學習**: 實作基於用戶行為的 ML 推薦
2. **協同過濾**: 基於相似用戶的推薦
3. **內容分析**: 分析迷因內容特徵
4. **實時推薦**: 支援實時更新推薦結果
5. **個人化熱門分數**: 結合用戶偏好的個人化熱門分數

## 注意事項

1. **隱私保護**：用戶行為資料僅用於推薦，不應外洩
2. **演算法透明度**：提供推薦原因說明
3. **冷啟動處理**：新用戶和新內容的推薦策略
4. **偏見防護**：避免推薦系統強化現有偏見
5. **效能監控**：持續監控系統效能和推薦效果
6. **用戶控制**：允許用戶查看和調整個人偏好
7. **定期維護**：定期更新熱門分數，保持系統活躍度

## 錯誤處理

所有端點都遵循統一的錯誤回應格式：

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

常見錯誤：

- `400`: 請求參數錯誤
- `401`: 需要登入的端點（如內容基礎推薦、用戶偏好分析）
- `403`: 權限不足（管理員端點）
- `404`: 相似推薦的目標迷因不存在
- `500`: 伺服器內部錯誤

---

_本文檔最後更新：2025年8月_
