# 進階搜尋系統使用說明

## 概述

本系統實現了一個結合 Google 搜尋理念的進階迷因搜尋功能，使用 Fuse.js 進行模糊搜尋，並結合多維度評分系統來提供最佳的搜尋體驗。

## 核心特性

### 1. 多維度評分系統

搜尋結果根據以下四個維度進行綜合評分：

#### 相關性 (Relevance) - 40%

- **Fuse.js 搜尋分數**：基於模糊匹配的相關性
- **標題匹配**：關鍵字出現在標題中
- **標籤匹配**：關鍵字出現在標籤中
- **作者匹配**：關鍵字出現在作者名稱中

#### 品質 (Quality) - 30%

- **瀏覽數**：標準化到 10,000 次瀏覽
- **讚數**：標準化到 1,000 個讚
- **分享數**：標準化到 500 次分享
- **評論數**：標準化到 100 條評論
- **作者聲望**：基於作者的迷因數量

#### 時效性 (Freshness) - 20%

- **創建時間**：新內容獲得更高分數
- **更新時間**：最近更新的內容加分
- **趨勢週期**：基於最近活動的趨勢分數

#### 用戶行為 (User Behavior) - 10%

- **點擊率**：基於瀏覽數的點擊率
- **平均觀看時間**：用戶停留時間
- **互動率**：讚、分享、評論的綜合互動率

### 2. 支援的排序方式

```javascript
// 綜合排序（預設）- 結合所有維度
sort = comprehensive

// 單一維度排序
sort = relevance // 相關性排序
sort = quality // 品質排序
sort = freshness // 時效性排序
sort = popularity // 人氣排序
sort = createdAt // 創建時間排序

// 向後相容的排序
sort = newest // 最新
sort = oldest // 最舊
sort = popular // 熱門
sort = hot // 熱門分數
```

### 3. 進階過濾功能

#### 基本過濾

- `type`：迷因類型 (image, video, audio, text)
- `status`：狀態 (draft, public, private, deleted)
- `tags`：標籤篩選（支援逗號分隔）

#### 進階過濾

- `author`：作者篩選（用戶名或顯示名稱）
- `dateFrom`：開始日期
- `dateTo`：結束日期
- `search`：搜尋關鍵字

## API 使用範例

### 基本搜尋

```bash
GET /api/memes?search=迷因&sort=comprehensive&limit=20
```

### 進階搜尋

```bash
GET /api/memes?search=有趣&tags=迷因,搞笑&author=user1&dateFrom=2024-01-01&sort=quality&limit=10
```

### 回應格式

```json
{
  "memes": [
    {
      "_id": "meme_id",
      "title": "迷因標題",
      "content": "迷因內容",
      "tags_cache": ["標籤1", "標籤2"],
      "author": {
        "username": "user1",
        "display_name": "用戶1"
      },
      "views": 1000,
      "likes": 100,
      "shares": 20,
      "comments": 10,
      "relevanceScore": 0.85,
      "qualityScore": 0.72,
      "freshnessScore": 0.65,
      "userBehaviorScore": 0.58,
      "comprehensiveScore": 0.75
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "scoring": {
    "relevance": 0.85,
    "quality": 0.72,
    "freshness": 0.65,
    "userBehavior": 0.58,
    "comprehensive": 0.75
  },
  "searchStats": {
    "totalResults": 150,
    "averageScores": {
      "relevance": 0.68,
      "quality": 0.45,
      "freshness": 0.52,
      "userBehavior": 0.38,
      "comprehensive": 0.56
    },
    "scoreDistribution": {
      "high": 25,
      "medium": 80,
      "low": 45
    }
  },
  "searchAlgorithm": "advanced"
}
```

## 配置選項

### 評分權重配置

```javascript
const scoringWeights = {
  relevance: 0.4, // 相關性 40%
  quality: 0.3, // 品質 30%
  freshness: 0.2, // 時效性 20%
  userBehavior: 0.1, // 用戶行為 10%
}
```

### 品質評分配置

```javascript
const qualityWeights = {
  viewWeight: 0.2, // 瀏覽數權重
  likeWeight: 0.3, // 讚數權重
  shareWeight: 0.2, // 分享數權重
  commentWeight: 0.1, // 評論數權重
  authorReputationWeight: 0.2, // 作者聲望權重
}
```

### Fuse.js 配置

```javascript
const fuseConfig = {
  keys: [
    { name: 'title', weight: 0.8 }, // 標題權重最高
    { name: 'content', weight: 0.6 }, // 內容權重中等
    { name: 'detail_markdown', weight: 0.4 }, // 詳細內容
    { name: 'tags_cache', weight: 0.7 }, // 標籤權重較高
    { name: 'display_name', weight: 0.1 }, // 作者顯示名稱
    { name: 'username', weight: 0.05 }, // 作者用戶名
  ],
  threshold: 0.3, // 相似度閾值
  minMatchCharLength: 2, // 最小匹配字元長度
  distance: 100, // 編輯距離
}
```

## 效能優化

### 1. 快取策略

- 搜尋結果快取
- 評分計算快取
- 索引預建立

### 2. 分頁優化

- 游標分頁支援
- 動態載入
- 無限滾動

### 3. 搜尋優化

- 預搜尋建議
- 自動完成
- 搜尋歷史

## 測試

執行測試：

```bash
npm test test/advancedSearch.test.js
```

測試覆蓋範圍：

- 模糊搜尋功能
- 評分計算邏輯
- 過濾器功能
- 分頁和排序
- 統計計算

## 向後相容性

系統保持向後相容性，支援原有的搜尋參數：

- `useAdvancedSearch=false`：使用傳統 MongoDB 查詢
- 原有的排序參數：`newest`, `oldest`, `popular`, `hot`
- 原有的過濾參數：`type`, `status`, `tags`

## 未來改進

### 1. 機器學習整合

- 用戶行為學習
- 個性化推薦
- 動態權重調整

### 2. 實時搜尋

- WebSocket 支援
- 即時結果更新
- 協作搜尋

### 3. 進階分析

- 搜尋趨勢分析
- 熱門關鍵字
- 用戶偏好分析

## 故障排除

### 常見問題

1. **搜尋結果不準確**
   - 檢查 Fuse.js 配置
   - 調整相似度閾值
   - 檢查評分權重

2. **效能問題**
   - 啟用快取
   - 優化資料庫查詢
   - 使用索引

3. **記憶體使用過高**
   - 限制搜尋範圍
   - 實作分頁
   - 清理快取

### 監控指標

- 搜尋響應時間
- 結果準確率
- 用戶滿意度
- 系統資源使用
