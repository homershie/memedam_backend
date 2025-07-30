# 迷因推薦系統設計文檔

## 概述

本系統實作了一個混合推薦演算法，結合協同過濾、社交協同過濾、內容基礎推薦和熱門度排序，為用戶提供個人化的迷因推薦。

## 系統架構

### 1. 熱門度演算法 (Hot Score Algorithm)

基於 Reddit 的熱門演算法，考慮時間衰減和互動數據。

#### 演算法公式

```javascript
// 互動分數計算
const interactionScore =
  like_count * 1.0 + // 按讚權重 1.0
  comment_count * 2.0 + // 留言權重 2.0 (互動性更高)
  share_count * 3.0 + // 分享權重 3.0 (傳播性最強)
  collection_count * 1.5 + // 收藏權重 1.5
  views * 0.1 - // 瀏覽權重 0.1 (已實作)
  dislike_count * 0.5 // 按噓扣分 0.5

// 時間衰減因子
const timeDecay = Math.pow(hoursSinceCreation + 2, 1.5)

// 最終熱門分數
const hotScore = interactionScore / timeDecay
```

#### 特點

- **時間敏感**：新內容有機會快速上升
- **互動加權**：不同互動類型有不同權重
- **自動衰減**：舊內容會逐漸降低排名

### 2. 協同過濾推薦 (Collaborative Filtering)

基於用戶行為相似性的推薦系統。

#### 演算法流程

1. **用戶行為分析**
   - 收集用戶的按讚、收藏、留言、分享歷史
   - 建立用戶-迷因互動矩陣

2. **相似用戶發現**
   - 找到喜歡相同迷因的用戶
   - 計算用戶相似度（基於共同喜好）

3. **推薦生成**
   - 推薦相似用戶喜歡但當前用戶未互動的迷因
   - 按相似度加權排序

#### 優點

- **發現新內容**：推薦用戶可能感興趣但未發現的內容
- **個人化**：基於實際行為而非內容特徵
- **動態適應**：隨用戶行為變化而調整

### 3. 社交協同過濾 (Social Collaborative Filtering)

結合社交關係和用戶行為的進階推薦系統。

#### 演算法流程

1. **社交網路分析**
   - 分析用戶的關注關係（Follow/Following）
   - 建立社交影響力圖譜
   - 計算用戶間的社交距離

2. **社交權重計算**

   ```javascript
   // 社交影響力計算
   const socialInfluence = {
     directFollow: 1.0, // 直接關注
     mutualFollow: 1.5, // 互相關注
     secondDegree: 0.6, // 二度關係
     thirdDegree: 0.3, // 三度關係
   }

   // 社交相似度計算
   const socialSimilarity = calculateSocialSimilarity(userA, userB)
   ```

3. **社交層分數計算設計**

   ```javascript
   // 社交層推薦分數配置
   const socialScoreConfig = {
     publish: 5, // 被你追蹤的人發佈
     like: 3, // 被你追蹤的人按讚
     comment: 3, // 被你追蹤的人留言
     share: 4, // 被你追蹤的人分享
     collect: 2, // 被你追蹤的人收藏
     view: 1, // 被你追蹤的人瀏覽
   }

   // 社交分數計算
   let socialScore = 0
   for (const interaction of memeInteractions) {
     if (follows.includes(interaction.userId)) {
       socialScore += socialScoreConfig[interaction.type] || 0
     }
   }

   // 設定分數上限，避免單一迷因爆分
   socialScore = Math.min(socialScore, 20)
   ```

4. **混合相似度計算**

   ```javascript
   // 結合行為相似度和社交相似度
   const behaviorSimilarity = calculateBehaviorSimilarity(userA, userB)
   const socialSimilarity = calculateSocialSimilarity(userA, userB)

   // 加權混合
   const finalSimilarity = behaviorSimilarity * 0.7 + socialSimilarity * 0.3
   ```

5. **社交推薦生成**
   - 優先推薦社交圈內用戶喜歡的內容
   - 考慮社交影響力的傳播效果
   - 平衡社交關係和內容品質

#### 社交特徵分析

1. **關注關係分析**
   - 直接關注：用戶直接關注的創作者
   - 互相關注：建立雙向社交關係
   - 社交距離：基於關注關係的距離計算

2. **互動模式分析**
   - 社交互動：評論、分享、@提及
   - 內容傳播：迷因在社交網路中的傳播路徑
   - 影響力傳播：高影響力用戶的推薦效果

#### 權重配置建議

```javascript
// 混合推薦系統權重配置
const defaultWeights = {
  collaborative: 0.35, // 協同過濾權重
  contentBased: 0.25, // 內容基礎權重
  hotScore: 0.25, // 熱門分數權重
  socialScore: 0.15, // 社交層權重（初期建議 0.1~0.2）
}

// 最終混合推薦公式
const finalScore =
  collaborativeScore * 0.35 +
  contentScore * 0.25 +
  hotScore * 0.25 +
  Math.min(socialScore, 20) * 0.15

// 冷啟動期權重調整
const coldStartWeights = {
  collaborative: 0.25,
  contentBased: 0.25,
  hotScore: 0.25,
  socialScore: 0.25, // 提高社交權重
}
```

#### 前端呈現建議

當社交分數大於 0 時，推薦理由可顯示：

- 「你的好友 XXX 按讚了這則迷因」
- 「你的好友 XXX 發佈了這則迷因」
- 「你的好友 XXX 收藏了這則迷因」

增強推薦的信任感與互動率。

#### 進階設計

1. **親疏遠近分數遞減**

   ```javascript
   // 根據社交距離調整權重
   const socialDistanceWeight = {
     directFollow: 1.0, // 直接好友
     secondDegree: 0.3, // 二度好友
     thirdDegree: 0.1, // 三度好友
   }
   ```

2. **動態權重調整**

   ```javascript
   // 根據用戶社交活躍度調整權重
   const adjustSocialWeight = (user) => {
     const socialActivity = calculateSocialActivity(user)

     if (socialActivity > 0.7) {
       return 0.2 // 高社交活躍用戶
     } else if (socialActivity < 0.3) {
       return 0.1 // 低社交活躍用戶
     }

     return 0.15 // 預設權重
   }
   ```

#### 優點

- **社交信任**：基於真實社交關係的推薦
- **影響力傳播**：利用社交影響力提升推薦效果
- **病毒式傳播**：促進內容在社交網路中的傳播
- **可解釋性**：明確的推薦原因說明
- **防同溫層**：透過權重控制避免過度集中

### 4. 內容基礎推薦 (Content-Based Filtering)

基於迷因標籤和內容特徵的推薦。

#### 演算法流程

1. **用戶偏好分析**
   - 分析用戶互動過的迷因標籤
   - 計算標籤偏好權重

2. **內容相似度計算**
   - 基於標籤重疊度計算迷因相似度
   - 考慮標籤權重和數量

3. **推薦生成**
   - 推薦與用戶偏好標籤相似的迷因
   - 按相似度排序

#### 優點

- **可解釋性**：推薦原因明確（基於標籤）
- **冷啟動友好**：新用戶也能獲得推薦
- **內容多樣性**：避免過度集中在特定類型

### 5. 混合推薦系統 (Hybrid Recommendation)

結合多種演算法的綜合推薦系統。

#### 權重配置

```javascript
const defaultWeights = {
  collaborative: 0.35, // 協同過濾權重
  contentBased: 0.25, // 內容基礎權重
  hotScore: 0.25, // 熱門分數權重
  socialScore: 0.15, // 社交層權重
}
```

#### 分數計算

```javascript
// 協同過濾分數
const collaborativeScore = collaborativeWeight * (1 - rank / totalItems)

// 內容基礎分數
const contentScore = contentWeight * (1 - rank / totalItems)

// 熱門分數（標準化）
const normalizedHotScore = hotScoreWeight * (hotScore / maxHotScore)

// 社交層分數（已計算並限制上限）
const normalizedSocialScore = socialScoreWeight * (Math.min(socialScore, 20) / 20)

// 綜合分數
const finalScore = collaborativeScore + contentScore + normalizedHotScore + normalizedSocialScore
```

#### 動態權重調整

```javascript
// 根據用戶社交活躍度調整權重
const adjustWeightsBySocialActivity = (user) => {
  const socialActivity = calculateSocialActivity(user)

  if (socialActivity > 0.7) {
    // 高社交活躍用戶，增加社交層權重
    return {
      collaborative: 0.3,
      contentBased: 0.25,
      hotScore: 0.25,
      socialScore: 0.2,
    }
  } else if (socialActivity < 0.3) {
    // 低社交活躍用戶，增加內容基礎權重
    return {
      collaborative: 0.35,
      contentBased: 0.35,
      hotScore: 0.25,
      socialScore: 0.05,
    }
  }

  return defaultWeights
}

// 冷啟動期權重調整
const getColdStartWeights = () => {
  return {
    collaborative: 0.25,
    contentBased: 0.25,
    hotScore: 0.25,
    socialScore: 0.25, // 提高社交權重
  }
}
```

## API 端點設計

### 1. 個人化推薦端點

```http
GET /memes/recommended
Authorization: Bearer <token>
```

#### 查詢參數

| 參數          | 類型    | 預設值                | 說明                                                              |
| ------------- | ------- | --------------------- | ----------------------------------------------------------------- |
| `algorithm`   | string  | `hybrid`              | 演算法類型：`hybrid`, `collaborative`, `social`, `content`, `hot` |
| `weights`     | string  | `0.35,0.25,0.25,0.15` | 混合演算法權重（協同過濾,內容基礎,熱門分數,社交層）               |
| `limit`       | number  | `20`                  | 返回數量限制                                                      |
| `page`        | number  | `1`                   | 頁碼                                                              |
| `social_only` | boolean | `false`               | 是否僅使用社交關係進行推薦                                        |

#### 回應格式

```json
{
  "success": true,
  "data": {
    "memes": [
      {
        "_id": "...",
        "title": "...",
        "content": "...",
        "image_url": "...",
        "hot_score": 123.45,
        "recommendation_score": 0.85,
        "social_score": 12,
        "social_influence": 0.72,
        "recommendation_reason": "你的好友 user123 按讚了這則迷因",
        "social_interactions": [
          {
            "user": "user123",
            "action": "like",
            "weight": 3
          },
          {
            "user": "user456",
            "action": "share",
            "weight": 4
          }
        ],
        "author": {
          "_id": "...",
          "username": "user123",
          "display_name": "顯示名稱",
          "avatar": "..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    },
    "algorithm": "hybrid",
    "weights": "0.35,0.25,0.25,0.15",
    "social_metrics": {
      "social_activity": 0.65,
      "influence_score": 0.78,
      "social_score_range": "0-20"
    }
  },
  "error": null
}
```

### 2. 社交推薦端點

```http
GET /memes/social-recommended
Authorization: Bearer <token>
```

#### 功能

- 專門基於社交關係的推薦
- 顯示推薦原因（基於哪個社交關係）
- 社交影響力加權推薦

#### 查詢參數

| 參數            | 類型   | 預設值 | 說明                     |
| --------------- | ------ | ------ | ------------------------ |
| `influence_min` | number | `0.5`  | 最小社交影響力閾值       |
| `max_degree`    | number | `3`    | 最大社交距離（幾度關係） |

### 3. 熱門分數更新端點

```http
POST /memes/hot-scores/:memeId?
Authorization: Bearer <admin_token>
```

#### 功能

- 更新單一迷因的熱門分數
- 批次更新所有迷因的熱門分數（管理員功能）

#### 回應格式

```json
{
  "success": true,
  "data": {
    "memeId": "...",
    "hotScore": 123.45
  },
  "error": null
}
```

## 實作細節

### 1. 資料庫索引優化

```javascript
// 為推薦系統添加索引
db.memes.createIndex({ hot_score: -1 })
db.memes.createIndex({ status: 1, hot_score: -1 })
db.likes.createIndex({ user_id: 1, meme_id: 1 })
db.collections.createIndex({ user_id: 1, meme_id: 1 })
db.comments.createIndex({ user_id: 1, meme_id: 1 })
db.shares.createIndex({ user_id: 1, meme_id: 1 })

// 社交關係索引
db.follows.createIndex({ follower_id: 1, following_id: 1 })
db.follows.createIndex({ following_id: 1, follower_id: 1 })
db.follows.createIndex({ created_at: -1 })
```

### 2. 快取策略

```javascript
// Redis 快取配置
const CACHE_KEYS = {
  USER_RECOMMENDATIONS: 'user_recommendations',
  SOCIAL_RECOMMENDATIONS: 'social_recommendations',
  HOT_MEMES: 'hot_memes',
  USER_PREFERENCES: 'user_preferences',
  SOCIAL_GRAPH: 'social_graph',
}

// 快取時間設定
const CACHE_TTL = {
  RECOMMENDATIONS: 30 * 60, // 30分鐘
  SOCIAL_RECOMMENDATIONS: 15 * 60, // 15分鐘
  HOT_MEMES: 10 * 60, // 10分鐘
  USER_PREFERENCES: 60 * 60, // 1小時
  SOCIAL_GRAPH: 5 * 60, // 5分鐘
}
```

### 3. 定期任務

```javascript
// 每小時更新熱門分數
setInterval(updateHotScoresTask, 60 * 60 * 1000)

// 每日重新計算用戶偏好
setInterval(updateUserPreferencesTask, 24 * 60 * 60 * 1000)

// 每週清理過期快取
setInterval(cleanupCacheTask, 7 * 24 * 60 * 60 * 1000)

// 每30分鐘更新社交圖譜
setInterval(updateSocialGraphTask, 30 * 60 * 1000)
```

## 效能優化

### 1. 查詢優化

- 使用 MongoDB 聚合管道減少記憶體使用
- 實作分頁避免大量資料傳輸
- 使用索引加速查詢
- 社交圖譜預計算和快取

### 2. 快取策略

- 熱門迷因快取 10 分鐘
- 用戶推薦快取 30 分鐘
- 社交推薦快取 15 分鐘
- 用戶偏好快取 1 小時
- 社交圖譜快取 5 分鐘

### 3. 非同步處理

- 熱門分數更新使用背景任務
- 用戶行為分析使用佇列處理
- 推薦計算使用工作池
- 社交圖譜更新使用背景任務

## 監控與分析

### 1. 推薦效果指標

- **點擊率 (CTR)**：推薦內容的點擊率
- **互動率**：推薦內容的按讚、留言、分享率
- **多樣性**：推薦內容的標籤多樣性
- **新穎性**：推薦新內容的比例
- **社交傳播率**：推薦內容的社交分享率

### 2. 系統效能指標

- **回應時間**：推薦 API 的平均回應時間
- **快取命中率**：Redis 快取的命中率
- **資料庫查詢時間**：聚合查詢的執行時間
- **社交圖譜更新時間**：社交關係更新的處理時間

### 3. 用戶行為分析

- **演算法偏好**：不同用戶群體的演算法效果
- **時間模式**：用戶活躍時間與推薦效果
- **內容偏好**：用戶的標籤偏好變化
- **社交活躍度**：用戶的社交互動模式

### 4. 社交指標

- **社交影響力**：用戶的社交影響力分數
- **社交距離**：用戶間的社交距離分布
- **內容傳播路徑**：迷因在社交網路中的傳播路徑
- **社交層分數分布**：社交分數的統計分布
- **社交互動類型分析**：不同社交互動類型的影響力
- **社交分數上限觸發率**：達到分數上限的迷因比例

## 未來擴展

### 1. 深度學習整合

- 實作神經協同過濾 (Neural Collaborative Filtering)
- 使用深度學習模型預測用戶偏好
- 整合自然語言處理分析迷因內容
- 社交圖神經網路 (Graph Neural Networks)

### 2. 即時推薦

- 實作流式處理架構
- 即時更新用戶偏好模型
- 支援即時推薦調整
- 即時社交圖譜更新

### 3. A/B 測試框架

- 實作推薦演算法 A/B 測試
- 動態調整演算法權重
- 自動優化推薦效果
- 社交推薦效果測試

### 4. 進階社交功能

- **影響力預測**：預測內容的社交傳播潛力
- **社交推薦解釋**：提供推薦的社交原因說明
- **跨社交圈推薦**：促進不同社交圈間的內容交流

## 開發指南

### 1. 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 測試推薦 API
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/api/memes/recommended?algorithm=hybrid&limit=10"

# 測試社交推薦 API
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/api/memes/social-recommended?influence_min=0.5"
```

### 2. 生產部署

```bash
# 設定環境變數
NODE_ENV=production
REDIS_URL=redis://localhost:6379

# 啟動應用
npm start

# 監控推薦系統
npm run monitor:recommendations

# 監控社交推薦
npm run monitor:social-recommendations
```

### 3. 效能測試

```bash
# 測試推薦 API 效能
npm run test:recommendations

# 測試社交推薦效能
npm run test:social-recommendations

# 壓力測試
npm run stress:recommendations
```

## 注意事項

1. **隱私保護**：用戶行為資料僅用於推薦，不應外洩
2. **演算法透明度**：提供推薦原因說明
3. **冷啟動處理**：新用戶和新內容的推薦策略
4. **偏見防護**：避免推薦系統強化現有偏見
5. **效能監控**：持續監控系統效能和推薦效果
6. **社交隱私**：尊重用戶的社交隱私設定
7. **影響力平衡**：避免過度依賴高影響力用戶

---

_本文檔最後更新：2024年12月_
