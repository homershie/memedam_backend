# 推薦系統實作總結

## 實作概述

已成功實作完整的推薦系統，包含熱門分數系統、內容基礎推薦、混合推薦等多種演算法，為迷因平台提供智能內容推薦功能。

### 核心功能

1. **熱門分數系統** - 自定義迷因熱門分數演算法
2. **內容基礎推薦** - 基於用戶標籤偏好的個人化推薦
3. **標籤相關推薦** - 基於指定標籤的相關迷因推薦
4. **協同過濾推薦** - 基於用戶行為相似性的推薦
5. **混合推薦系統** - 結合多種演算法的綜合推薦
6. **熱門分數管理** - 批次更新和統計分析功能

## 實作內容

### 1. 熱門分數系統 (`utils/hotScore.js`)

#### 自定義迷因熱門分數演算法

- `calculateMemeHotScore()`: 綜合考慮讚數、噓數、瀏覽數、留言數、收藏數、分享數
- 實作時間衰減因子，使用對數衰減機制
- 支援多種權重配置，不同互動類型有不同權重

#### 熱門等級分類

- `getHotScoreLevel()`: 根據分數自動分類
- **viral** (≥1000): 病毒式傳播
- **trending** (≥500): 趨勢熱門
- **popular** (≥100): 受歡迎
- **active** (≥50): 活躍
- **normal** (≥10): 一般
- **new** (<10): 新內容

#### 批次更新功能

- `batchUpdateHotScores()`: 批次更新迷因熱門分數
- `calculateEngagementScore()`: 計算互動分數
- `calculateQualityScore()`: 計算品質分數

### 2. 內容基礎推薦系統 (`utils/contentBased.js`)

#### 用戶標籤偏好分析

- `calculateUserTagPreferences()`: 分析用戶互動歷史，計算標籤偏好權重
- 支援多種互動類型：按讚、留言、分享、收藏、瀏覽
- 實作時間衰減機制，新互動權重更高
- 過濾互動次數太少的標籤，提升推薦品質

#### 標籤相似度計算

- `calculateTagSimilarity()`: 基於 Jaccard 相似度計算標籤重疊度
- 結合用戶偏好進行加權計算
- 支援多標籤相似度比較

#### 偏好匹配度計算

- `calculatePreferenceMatch()`: 計算迷因與用戶偏好的匹配度
- 考慮匹配標籤數量和偏好強度
- 平衡匹配比例和平均偏好

#### 推薦生成

- `getContentBasedRecommendations()`: 生成內容基礎推薦
- `getTagBasedRecommendations()`: 生成標籤相關推薦
- 支援冷啟動處理（互動歷史不足時使用熱門推薦）
- 結合熱門分數提升推薦品質

### 3. 協同過濾推薦系統 (`utils/collaborativeFiltering.js`)

#### 用戶-迷因互動矩陣建立

- `buildInteractionMatrix()`: 建立用戶-迷因互動矩陣
- 支援多種互動類型：按讚、留言、分享、收藏、瀏覽
- 實作時間衰減機制，新互動權重更高
- 限制處理規模，避免效能問題

#### 用戶相似度計算

- `calculateUserSimilarity()`: 基於皮爾遜相關係數計算用戶相似度
- 考慮共同互動的迷因和互動強度
- 處理邊界情況（無共同互動、空數據等）

#### 相似用戶發現

- `findSimilarUsers()`: 找到與目標用戶相似的用戶
- 支援相似度閾值篩選
- 限制返回用戶數量，提升效能

#### 協同過濾推薦生成

- `getCollaborativeFilteringRecommendations()`: 生成協同過濾推薦
- 支援冷啟動處理（互動歷史不足時使用熱門推薦）
- 結合熱門分數提升推薦品質
- 排除已互動的迷因

#### 統計和快取功能

- `getCollaborativeFilteringStats()`: 取得用戶協同過濾統計
- `updateCollaborativeFilteringCache()`: 更新協同過濾快取

### 4. 控制器實作 (`controllers/recommendationController.js`)

#### 推薦演算法端點

- `getHotRecommendations()`: 熱門推薦端點
- `getLatestRecommendations()`: 最新推薦端點
- `getSimilarRecommendations()`: 相似推薦端點
- `getContentBasedRecommendationsController()`: 內容基礎推薦端點
- `getTagBasedRecommendationsController()`: 標籤相關推薦端點
- `getCollaborativeFilteringRecommendationsController()`: 協同過濾推薦端點
- `getCollaborativeFilteringStatsController()`: 協同過濾統計端點
- `updateCollaborativeFilteringCacheController()`: 更新協同過濾快取端點
- `getUserTagPreferences()`: 用戶標籤偏好分析端點
- `updateUserPreferences()`: 更新用戶偏好快取端點
- `getUserInterestRecommendations()`: 用戶興趣推薦端點
- `getMixedRecommendations()`: 混合推薦端點
- `getRecommendationStats()`: 推薦統計端點

#### 熱門分數管理端點

- `updateMemeHotScore()`: 更新單一迷因熱門分數
- `batchUpdateHotScores()`: 批次更新熱門分數
- `getHotMemeList()`: 取得熱門迷因列表
- `getTrendingMemeList()`: 取得趨勢迷因列表
- `getMemeScoreAnalysis()`: 取得迷因分數分析

### 5. 路由配置 (`routes/recommendationRoutes.js`)

#### 推薦系統端點

- `GET /api/recommendations/hot`: 熱門推薦
- `GET /api/recommendations/latest`: 最新推薦
- `GET /api/recommendations/similar/:memeId`: 相似推薦
- `GET /api/recommendations/content-based`: 內容基礎推薦
- `GET /api/recommendations/tag-based`: 標籤相關推薦
- `GET /api/recommendations/collaborative-filtering`: 協同過濾推薦
- `GET /api/recommendations/collaborative-filtering-stats`: 協同過濾統計
- `POST /api/recommendations/update-collaborative-filtering-cache`: 更新協同過濾快取
- `GET /api/recommendations/user-preferences`: 用戶偏好分析
- `POST /api/recommendations/update-preferences`: 更新偏好快取
- `GET /api/recommendations/user-interest`: 用戶興趣推薦
- `GET /api/recommendations/mixed`: 混合推薦
- `GET /api/recommendations/stats`: 推薦統計
- `GET /api/recommendations`: 綜合推薦（可指定演算法）

#### 熱門分數管理端點

- `PUT /api/memes/:id/hot-score`: 更新單一迷因熱門分數
- `POST /api/memes/batch-update-hot-scores`: 批次更新熱門分數
- `GET /api/memes/hot/list`: 取得熱門迷因列表
- `GET /api/memes/trending/list`: 取得趨勢迷因列表
- `GET /api/memes/:id/score-analysis`: 取得迷因分數分析

#### 管理端點

- `POST /api/admin/batch-update-hot-scores`: 批次更新熱門分數（管理員）
- `POST /api/admin/scheduled-hot-score-update`: 執行定期更新任務（管理員）
- `GET /api/admin/hot-score-statistics`: 取得熱門分數統計（管理員）

### 6. 測試覆蓋

#### 內容基礎推薦測試 (`test/contentBasedRecommendation.test.js`)

- 用戶標籤偏好計算測試
- 標籤相似度計算測試
- 偏好匹配度計算測試
- 推薦生成功能測試
- 工具函數測試

#### 協同過濾推薦測試 (`test/collaborativeFiltering.test.js`)

- 用戶相似度計算測試
- 相似用戶發現測試
- 互動矩陣建立測試
- 協同過濾推薦生成測試
- 統計功能測試

## 演算法特色

### 1. 熱門分數演算法

```javascript
// 權重配置
const weights = {
  like: 1.0,
  dislike: -0.5, // 噓數會降低分數
  view: 0.1, // 瀏覽數權重較低
  comment: 2.0, // 留言權重較高
  collection: 3.0, // 收藏權重最高
  share: 2.5, // 分享權重很高
}

// 基礎分數計算
const baseScore =
  like_count * weights.like +
  dislike_count * weights.dislike +
  views * weights.view +
  comment_count * weights.comment +
  collection_count * weights.collection +
  share_count * weights.share

// 時間衰減因子
const timeDecay = 1 / (1 + Math.log(timeDiff + 1))

// 最終熱門分數
const hotScore = baseScore * timeDecay
```

### 2. 內容基礎推薦演算法

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
const preferenceScore = interactionWeight * timeDecay
```

### 3. 標籤相似度計算

```javascript
// Jaccard 相似度
const jaccardSimilarity = intersection.length / union.length

// 結合用戶偏好的相似度
const weightedSimilarity = jaccardSimilarity * 0.6 + preferenceWeight * 0.4
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

### 5. 混合推薦分數計算

```javascript
// 混合分數計算
const mixedScore =
  hotScore * parseFloat(hot_weight) +
  timeScore * parseFloat(latest_weight) +
  contentScore * parseFloat(content_weight) +
  similarScore * parseFloat(similar_weight)
```

## API 端點總覽

### 推薦系統端點

| 端點                                                        | 方法 | 權限    | 說明             |
| ----------------------------------------------------------- | ---- | ------- | ---------------- |
| `/api/recommendations/hot`                                  | GET  | Public  | 熱門推薦         |
| `/api/recommendations/latest`                               | GET  | Public  | 最新推薦         |
| `/api/recommendations/similar/:memeId`                      | GET  | Public  | 相似推薦         |
| `/api/recommendations/content-based`                        | GET  | Private | 內容基礎推薦     |
| `/api/recommendations/tag-based`                            | GET  | Public  | 標籤相關推薦     |
| `/api/recommendations/collaborative-filtering`              | GET  | Private | 協同過濾推薦     |
| `/api/recommendations/collaborative-filtering-stats`        | GET  | Private | 協同過濾統計     |
| `/api/recommendations/update-collaborative-filtering-cache` | POST | Private | 更新協同過濾快取 |
| `/api/recommendations/user-preferences`                     | GET  | Private | 用戶偏好分析     |
| `/api/recommendations/update-preferences`                   | POST | Private | 更新偏好快取     |
| `/api/recommendations/user-interest`                        | GET  | Private | 用戶興趣推薦     |
| `/api/recommendations/mixed`                                | GET  | Public  | 混合推薦         |
| `/api/recommendations/stats`                                | GET  | Public  | 推薦統計         |
| `/api/recommendations`                                      | GET  | Public  | 綜合推薦         |

### 熱門分數管理端點

| 端點                                 | 方法 | 權限    | 說明                 |
| ------------------------------------ | ---- | ------- | -------------------- |
| `/api/memes/:id/hot-score`           | PUT  | Private | 更新單一迷因熱門分數 |
| `/api/memes/batch-update-hot-scores` | POST | Private | 批次更新熱門分數     |
| `/api/memes/hot/list`                | GET  | Public  | 取得熱門迷因列表     |
| `/api/memes/trending/list`           | GET  | Public  | 取得趨勢迷因列表     |
| `/api/memes/:id/score-analysis`      | GET  | Public  | 取得迷因分數分析     |

### 管理端點

| 端點                                    | 方法 | 權限  | 說明             |
| --------------------------------------- | ---- | ----- | ---------------- |
| `/api/admin/batch-update-hot-scores`    | POST | Admin | 批次更新熱門分數 |
| `/api/admin/scheduled-hot-score-update` | POST | Admin | 執行定期更新任務 |
| `/api/admin/hot-score-statistics`       | GET  | Admin | 取得熱門分數統計 |

## 回應格式範例

### 內容基礎推薦回應

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "...",
        "title": "Funny Meme",
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
        }
      }
    ],
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
  }
}
```

### 協同過濾推薦回應

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "...",
        "title": "Funny Meme",
        "content": "...",
        "image_url": "...",
        "recommendation_score": 0.85,
        "recommendation_type": "collaborative_filtering",
        "collaborative_score": 0.75,
        "similar_users_count": 12,
        "average_similarity": 0.68,
        "author": {
          "_id": "...",
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
  }
}
```

### 混合推薦回應

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "...",
        "title": "混合推薦迷因",
        "recommendation_score": 234.56,
        "recommendation_type": "mixed",
        "hot_score_weight": 0.25,
        "latest_weight": 0.25,
        "content_weight": 0.25,
        "similar_weight": 0.25,
        "hot_level": "popular"
      }
    ],
    "algorithm": "mixed",
    "weights": {
      "hot": 0.25,
      "latest": 0.25,
      "content": 0.25,
      "similar": 0.25
    },
    "user_authenticated": true,
    "content_based_included": true
  }
}
```

## 效能優化

### 1. 快取策略

- 用戶偏好快取 1 小時
- 推薦結果快取 30 分鐘
- 標籤相似度快取 15 分鐘
- 熱門分數快取 5-10 分鐘

### 2. 資料庫索引建議

```javascript
// 建議的索引
db.memes.createIndex({ tags_cache: 1, status: 1 })
db.memes.createIndex({ hot_score: -1, createdAt: -1 })
db.likes.createIndex({ user_id: 1, meme_id: 1 })
db.collections.createIndex({ user_id: 1, meme_id: 1 })
db.comments.createIndex({ user_id: 1, meme_id: 1 })
db.shares.createIndex({ user_id: 1, meme_id: 1 })
db.views.createIndex({ user_id: 1, meme_id: 1 })
```

### 3. 冷啟動處理

- 新用戶互動歷史不足時，使用熱門推薦作為備選
- 逐步收集用戶互動數據，提升推薦準確度
- 提供推薦原因說明，增強用戶信任

### 4. 批次處理

- 熱門分數批次更新，避免影響系統效能
- 建議每小時執行一次批次更新
- 支援定期更新任務排程

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

### 1. 深度學習整合

- 實作神經協同過濾 (Neural Collaborative Filtering)
- 使用深度學習模型預測用戶偏好
- 整合自然語言處理分析迷因內容

### 2. 即時推薦

- 實作流式處理架構
- 即時更新用戶偏好模型
- 支援即時推薦調整

### 3. A/B 測試框架

- 實作推薦演算法 A/B 測試
- 動態調整演算法權重
- 自動優化推薦效果

### 4. 個人化熱門分數

- 結合用戶偏好的個人化熱門分數
- 動態調整熱門分數權重
- 支援用戶自定義偏好

## 注意事項

1. **隱私保護**：用戶行為資料僅用於推薦，不應外洩
2. **演算法透明度**：提供推薦原因說明
3. **冷啟動處理**：新用戶和新內容的推薦策略
4. **偏見防護**：避免推薦系統強化現有偏見
5. **效能監控**：持續監控系統效能和推薦效果
6. **用戶控制**：允許用戶查看和調整個人偏好
7. **定期維護**：定期更新熱門分數，保持系統活躍度

## 總結

已成功實作完整的推薦系統，包含：

✅ **熱門分數系統**：自定義迷因熱門分數演算法，支援批次更新和等級分類  
✅ **內容基礎推薦**：基於用戶標籤偏好和迷因標籤相似度的個人化推薦  
✅ **標籤相關推薦**：基於指定標籤的相關迷因推薦  
✅ **協同過濾推薦**：基於用戶行為相似性的推薦，支援用戶-迷因互動矩陣  
✅ **混合推薦系統**：結合熱門、最新、內容基礎、相似、協同過濾等多種演算法  
✅ **熱門分數管理**：提供完整的熱門分數更新和統計功能  
✅ **API 端點**：提供完整的 RESTful API 端點，包含推薦和管理功能  
✅ **測試覆蓋**：包含內容基礎推薦和協同過濾推薦的單元測試  
✅ **文檔說明**：提供詳細的 API 文檔和使用說明

### 實作狀態

- **熱門分數系統**：✅ 已完成
- **內容基礎推薦**：✅ 已完成
- **標籤相關推薦**：✅ 已完成
- **協同過濾推薦**：✅ 已完成
- **混合推薦系統**：✅ 已完成
- **API 端點**：✅ 已完成
- **測試覆蓋**：✅ 已完成
- **文檔說明**：✅ 已完成

系統已準備好投入生產環境使用，並可根據實際使用情況進行進一步優化和擴展。

---

_實作完成時間：2024年12月_
