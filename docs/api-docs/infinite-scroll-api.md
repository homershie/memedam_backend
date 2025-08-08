# 無限捲動推薦 API 文檔

## 概述

無限捲動推薦 API 是專門為前端無限捲動功能設計的推薦系統，支援分頁載入、自動排除已顯示項目，並整合了所有推薦演算法。

## API 端點

### GET /api/recommendations/infinite-scroll

專門為無限捲動設計的推薦端點。

#### 請求參數

| 參數                             | 類型    | 必填 | 預設值 | 說明                           |
| -------------------------------- | ------- | ---- | ------ | ------------------------------ |
| `page`                           | integer | 否   | 1      | 頁碼（從1開始）                |
| `limit`                          | integer | 否   | 10     | 每頁推薦數量                   |
| `exclude_ids`                    | string  | 否   | -      | 要排除的項目ID列表（逗號分隔） |
| `tags`                           | string  | 否   | -      | 標籤列表（逗號分隔）           |
| `custom_weights`                 | string  | 否   | '{}'   | 自定義權重 JSON 字串           |
| `include_social_scores`          | boolean | 否   | true   | 是否包含社交分數               |
| `include_recommendation_reasons` | boolean | 否   | true   | 是否包含推薦原因               |

#### 請求範例

```bash
# 基本請求
GET /api/recommendations/infinite-scroll?page=1&limit=10

# 排除已顯示項目
GET /api/recommendations/infinite-scroll?page=2&limit=10&exclude_ids=meme1,meme2,meme3

# 標籤篩選
GET /api/recommendations/infinite-scroll?page=1&limit=10&tags=funny,cat

# 自定義權重
GET /api/recommendations/infinite-scroll?page=1&limit=10&custom_weights={"hot":0.6,"latest":0.4}
```

#### 回應格式

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "meme_id",
        "title": "迷因標題",
        "description": "迷因描述",
        "image_url": "圖片URL",
        "hot_score": 150,
        "recommendation_score": 0.85,
        "recommendation_type": "hot",
        "recommendation_reason": "這則迷因目前很熱門",
        "social_score": 0.75,
        "tags_cache": ["funny", "cat"],
        "author_id": "user_id",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "skip": 0,
      "total": 150,
      "hasMore": true,
      "totalPages": 15,
      "nextPage": 2
    },
    "filters": {
      "page": 1,
      "limit": 10,
      "exclude_ids": ["meme1", "meme2"],
      "tags": ["funny"],
      "custom_weights": {},
      "include_social_scores": true,
      "include_recommendation_reasons": true
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
        "score": 45,
        "level": "active"
      }
    },
    "user_authenticated": true,
    "query_info": {
      "requestedLimit": 10,
      "totalNeeded": 60,
      "excludedCount": 2,
      "isColdStart": false
    },
    "algorithm_details": {
      "description": "專門為無限捲動設計的混合推薦系統",
      "features": [
        "支援分頁載入",
        "自動排除已顯示項目",
        "動態權重調整",
        "冷啟動處理機制",
        "個人化推薦策略",
        "標籤篩選支援",
        "社交分數計算",
        "推薦原因生成"
      ]
    }
  },
  "error": null
}
```

## 前端實作範例

### React 無限捲動實作

```javascript
import { useState, useEffect, useCallback } from 'react'

const InfiniteScrollRecommendations = () => {
  const [recommendations, setRecommendations] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [excludeIds, setExcludeIds] = useState([])

  const fetchRecommendations = useCallback(async (pageNum, excludeList = []) => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: pageNum,
        limit: 10,
        exclude_ids: excludeList.join(','),
        include_social_scores: 'true',
        include_recommendation_reasons: 'true',
      })

      const response = await fetch(`/api/recommendations/infinite-scroll?${params}`)
      const data = await response.json()

      if (data.success) {
        const newRecommendations = data.data.recommendations
        const pagination = data.data.pagination

        if (pageNum === 1) {
          setRecommendations(newRecommendations)
        } else {
          setRecommendations((prev) => [...prev, ...newRecommendations])
        }

        setHasMore(pagination.hasMore)
        setPage(pagination.nextPage || pageNum)

        // 更新排除列表
        const newExcludeIds = newRecommendations.map((rec) => rec._id)
        setExcludeIds((prev) => [...prev, ...newExcludeIds])
      }
    } catch (error) {
      console.error('取得推薦失敗:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecommendations(1)
  }, [fetchRecommendations])

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchRecommendations(page, excludeIds)
    }
  }

  return (
    <div>
      <div className="recommendations-grid">
        {recommendations.map((meme) => (
          <div key={meme._id} className="meme-card">
            <img src={meme.image_url} alt={meme.title} />
            <h3>{meme.title}</h3>
            <p>{meme.recommendation_reason}</p>
            <div className="meme-stats">
              <span>熱門分數: {meme.hot_score}</span>
              <span>推薦分數: {meme.recommendation_score}</span>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="loading">載入中...</div>}

      {hasMore && !loading && (
        <button onClick={loadMore} className="load-more-btn">
          載入更多
        </button>
      )}
    </div>
  )
}

export default InfiniteScrollRecommendations
```

### Vue.js 無限捲動實作

```javascript
<template>
  <div>
    <div class="recommendations-grid">
      <div
        v-for="meme in recommendations"
        :key="meme._id"
        class="meme-card"
      >
        <img :src="meme.image_url" :alt="meme.title" />
        <h3>{{ meme.title }}</h3>
        <p>{{ meme.recommendation_reason }}</p>
        <div class="meme-stats">
          <span>熱門分數: {{ meme.hot_score }}</span>
          <span>推薦分數: {{ meme.recommendation_score }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">載入中...</div>

    <button
      v-if="hasMore && !loading"
      @click="loadMore"
      class="load-more-btn"
    >
      載入更多
    </button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      recommendations: [],
      page: 1,
      hasMore: true,
      loading: false,
      excludeIds: []
    }
  },

  async mounted() {
    await this.fetchRecommendations(1)
  },

  methods: {
    async fetchRecommendations(pageNum, excludeList = []) {
      try {
        this.loading = true

        const params = new URLSearchParams({
          page: pageNum,
          limit: 10,
          exclude_ids: excludeList.join(','),
          include_social_scores: 'true',
          include_recommendation_reasons: 'true'
        })

        const response = await fetch(`/api/recommendations/infinite-scroll?${params}`)
        const data = await response.json()

        if (data.success) {
          const newRecommendations = data.data.recommendations
          const pagination = data.data.pagination

          if (pageNum === 1) {
            this.recommendations = newRecommendations
          } else {
            this.recommendations = [...this.recommendations, ...newRecommendations]
          }

          this.hasMore = pagination.hasMore
          this.page = pagination.nextPage || pageNum

          // 更新排除列表
          const newExcludeIds = newRecommendations.map(rec => rec._id)
          this.excludeIds = [...this.excludeIds, ...newExcludeIds]
        }
      } catch (error) {
        console.error('取得推薦失敗:', error)
      } finally {
        this.loading = false
      }
    },

    async loadMore() {
      if (!this.loading && this.hasMore) {
        await this.fetchRecommendations(this.page, this.excludeIds)
      }
    }
  }
}
</script>
```

## 功能特色

### 1. 分頁支援

- 支援頁碼參數，從第1頁開始
- 自動計算分頁資訊（總數、是否有更多、下一頁等）
- 支援自定義每頁數量

### 2. 排除已顯示項目

- 自動排除已顯示的項目，避免重複
- 支援批量排除多個項目ID
- 前端可維護排除列表

### 3. 動態權重調整

- 根據用戶活躍度自動調整演算法權重
- 支援自定義權重配置
- 冷啟動時自動調整策略

### 4. 標籤篩選

- 支援多標籤篩選
- 逗號分隔的標籤列表
- 自動過濾符合標籤的推薦

### 5. 社交分數計算

- 計算迷因的社交影響力分數
- 包含社交距離、影響力、互動等維度
- 可選擇是否包含社交分數

### 6. 推薦原因生成

- 自動生成推薦原因
- 基於演算法類型和社交分數
- 提升用戶體驗

## 效能優化

### 1. 快取機制

- Redis 快取推薦結果
- 快取鍵包含分頁和排除資訊
- 自動快取失效管理

### 2. 並行處理

- 並行執行多種推薦演算法
- 非同步處理提升效能
- 效能監控和統計

### 3. 冷啟動處理

- 智能識別新用戶
- 自動調整推薦策略
- 增加推薦數量倍數

## 錯誤處理

### 常見錯誤回應

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

### 錯誤代碼

| 錯誤代碼 | 說明               |
| -------- | ------------------ |
| 400      | 請求參數錯誤       |
| 401      | 未授權（需要登入） |
| 500      | 伺服器內部錯誤     |

## 注意事項

1. **快取策略**: 建議前端實作本地快取，避免重複請求
2. **排除列表管理**: 前端需要維護已顯示項目的排除列表
3. **效能監控**: 建議監控 API 回應時間和錯誤率
4. **用戶體驗**: 建議實作載入狀態和錯誤處理
5. **SEO 考量**: 無限捲動可能影響 SEO，建議實作適當的 URL 結構
