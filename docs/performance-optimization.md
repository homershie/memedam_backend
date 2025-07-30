# 效能優化文檔

## 概述

本文檔詳細說明迷因典後端系統的效能優化實現，包括 Redis 快取、資料庫索引優化和非同步處理。

## 1. Redis 快取系統

### 1.1 快取架構

- **快取層級**: 使用 Redis 作為分散式快取
- **快取策略**: 採用 Cache-Aside 模式
- **快取失效**: 基於 TTL (Time To Live) 的自動失效機制

### 1.2 快取配置

```javascript
const CACHE_CONFIG = {
  userActivity: 1800, // 30分鐘
  userPreferences: 3600, // 1小時
  hotRecommendations: 900, // 15分鐘
  latestRecommendations: 300, // 5分鐘
  contentBasedRecommendations: 1800, // 30分鐘
  collaborativeFilteringRecommendations: 3600, // 1小時
  socialRecommendations: 3600, // 1小時
  mixedRecommendations: 600, // 10分鐘
  socialScores: 1800, // 30分鐘
}
```

### 1.3 快取鍵命名規範

- `user_activity:{userId}` - 用戶活躍度分數
- `cold_start:{userId}` - 冷啟動狀態
- `hot_recommendations:{limit}:{days}` - 熱門推薦
- `latest_recommendations:{limit}:{hours}` - 最新推薦
- `content_based:{userId}:{limit}` - 內容基礎推薦
- `collaborative_filtering:{userId}:{limit}` - 協同過濾推薦
- `social_collaborative_filtering:{userId}:{limit}` - 社交協同過濾推薦
- `mixed_recommendations:{userId}:{limit}:{weights}` - 混合推薦

### 1.4 快取管理 API

```bash
# 取得快取統計
GET /api/cache/stats

# 清除特定模式的快取
DELETE /api/cache/clear?pattern=user_activity:*
```

## 2. 資料庫索引優化

### 2.1 索引策略

#### User 集合

- `username` (unique) - 用戶名查詢
- `email` (unique) - 郵箱查詢
- `created_at` - 時間排序
- `status` - 狀態篩選

#### Meme 集合

- `status` - 狀態篩選
- `author_id` - 作者查詢
- `created_at` - 時間排序
- `hot_score` - 熱門分數排序
- `tags_cache` - 標籤查詢
- `{status, created_at}` - 複合索引
- `{status, hot_score}` - 複合索引
- `{status, title: 'text', description: 'text'}` - 全文搜尋索引

#### Like 集合

- `user_id` - 用戶查詢
- `meme_id` - 迷因查詢
- `{user_id, meme_id}` (unique) - 防止重複點讚
- `created_at` - 時間排序

#### Comment 集合

- `user_id` - 用戶查詢
- `meme_id` - 迷因查詢
- `status` - 狀態篩選
- `created_at` - 時間排序
- `{meme_id, status, created_at}` - 複合索引

#### View 集合

- `user_id` - 用戶查詢
- `meme_id` - 迷因查詢
- `created_at` - 時間排序
- `{meme_id, created_at}` - 複合索引

### 2.2 連線池配置

```javascript
const options = {
  maxPoolSize: 10, // 連線池大小
  serverSelectionTimeoutMS: 5000, // 伺服器選擇超時
  socketTimeoutMS: 45000, // Socket 超時
  bufferMaxEntries: 0, // 禁用 mongoose 緩衝
  bufferCommands: false, // 禁用命令緩衝
  useNewUrlParser: true,
  useUnifiedTopology: true,
}
```

## 3. 非同步處理優化

### 3.1 任務隊列管理

```javascript
// 創建任務隊列
const taskQueue = new TaskQueue({
  maxConcurrency: 5,
  retryAttempts: 3,
  retryDelay: 1000,
})

// 添加任務
await taskQueue.add(
  async () => {
    // 執行任務
  },
  { priority: 1 },
)
```

### 3.2 批量處理

```javascript
// 批量處理數據
const { results, errors } = await batchProcessor.processBatch(
  items,
  async (batch) => {
    // 處理批次
    return processedBatch
  },
  {
    batchSize: 100,
    delay: 100,
    maxConcurrency: 3,
  },
)
```

### 3.3 並行處理

```javascript
// 並行處理任務
const { results, errors } = await parallelProcessor.processParallel(tasks, {
  maxConcurrency: 10,
  timeout: 30000,
})
```

### 3.4 快取處理器

```javascript
// 帶快取的處理函數
const result = await cacheProcessor.processWithCache(
  'cache_key',
  async () => {
    // 獲取數據的邏輯
    return data
  },
  { ttl: 3600 },
)
```

## 4. 推薦系統優化

### 4.1 並行推薦計算

```javascript
// 並行取得各種推薦
const recommendationTasks = []

if (weights.hot > 0) {
  recommendationTasks.push(getHotRecommendations(options))
}

if (weights.latest > 0) {
  recommendationTasks.push(getLatestRecommendations(options))
}

// 並行執行所有推薦任務
const recommendations = await Promise.all(recommendationTasks)
```

### 4.2 效能監控

```javascript
// 開始監控
performanceMonitor.start('mixed_recommendations')

// 執行推薦邏輯
const result = await getMixedRecommendations(userId, options)

// 結束監控
performanceMonitor.end('mixed_recommendations')
```

### 4.3 快取整合

```javascript
// 檢查快取
const cacheKey = `mixed_recommendations:${userId}:${limit}:${JSON.stringify(weights)}`
const cached = await redisCache.get(cacheKey)

if (cached !== null) {
  return cached
}

// 計算推薦結果
const result = await calculateRecommendations()

// 設定快取
await redisCache.set(cacheKey, result, CACHE_CONFIG.mixedRecommendations)
```

## 5. 效能監控

### 5.1 健康檢查端點

```bash
GET /health
```

回應範例：

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": {
    "connected": true,
    "collections": 15
  },
  "redis": {
    "connected": true,
    "keys": 1250
  },
  "performance": {
    "activeRequests": 3,
    "recentMetrics": [
      {
        "requestId": "1704067200000.123",
        "duration": 150
      }
    ]
  }
}
```

### 5.2 效能監控端點

```bash
GET /api/performance
```

回應範例：

```json
{
  "metrics": {
    "totalRequests": 1000,
    "averageResponseTime": 245,
    "slowestRequests": [
      {
        "requestId": "1704067200000.123",
        "duration": 1500
      }
    ],
    "fastestRequests": [
      {
        "requestId": "1704067200000.456",
        "duration": 45
      }
    ]
  }
}
```

## 6. 環境變數配置

### 6.1 Redis 配置

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

### 6.2 資料庫配置

```env
MONGO_URI=mongodb://localhost:27017/memedex
```

### 6.3 效能配置

```env
NODE_ENV=production
PORT=3000
```

## 7. 效能最佳實踐

### 7.1 查詢優化

- 使用 `lean()` 方法減少記憶體使用
- 限制查詢結果數量
- 使用投影減少傳輸數據量
- 避免 N+1 查詢問題

### 7.2 快取策略

- 熱點數據優先快取
- 合理設定 TTL
- 實現快取穿透保護
- 定期清理過期快取

### 7.3 非同步處理

- 使用 Promise.all 並行處理
- 實現錯誤重試機制
- 控制並行度避免資源耗盡
- 監控任務執行狀態

### 7.4 監控和警報

- 實時監控系統效能
- 設定效能閾值警報
- 記錄慢查詢日誌
- 定期分析效能趨勢

## 8. 部署建議

### 8.1 Redis 部署

- 使用 Redis Cluster 實現高可用
- 配置適當的記憶體限制
- 啟用持久化機制
- 監控 Redis 效能指標

### 8.2 MongoDB 部署

- 使用副本集確保高可用
- 配置適當的索引
- 監控查詢效能
- 定期維護資料庫

### 8.3 應用程式部署

- 使用負載均衡器
- 配置適當的進程數
- 監控記憶體和 CPU 使用
- 實現優雅關閉機制

## 9. 效能測試

### 9.1 負載測試

```bash
# 使用 Apache Bench 進行負載測試
ab -n 1000 -c 10 http://localhost:3000/api/recommendations

# 使用 Artillery 進行更複雜的測試
artillery run load-test.yml
```

### 9.2 效能基準

- 推薦 API 響應時間 < 200ms
- 快取命中率 > 80%
- 資料庫查詢時間 < 50ms
- 系統並發處理能力 > 1000 QPS

## 10. 故障排除

### 10.1 常見問題

1. **Redis 連線失敗**
   - 檢查 Redis 服務狀態
   - 驗證連線配置
   - 檢查網路連線

2. **資料庫查詢慢**
   - 檢查索引是否正確建立
   - 分析慢查詢日誌
   - 優化查詢語句

3. **記憶體使用過高**
   - 檢查記憶體洩漏
   - 優化查詢結果大小
   - 調整快取策略

### 10.2 監控指標

- 響應時間
- 吞吐量
- 錯誤率
- 資源使用率
- 快取命中率

## 11. 未來優化方向

1. **CDN 整合**: 靜態資源使用 CDN
2. **微服務架構**: 拆分大型服務
3. **讀寫分離**: 實現資料庫讀寫分離
4. **容器化部署**: 使用 Docker 和 Kubernetes
5. **自動擴展**: 根據負載自動擴展服務
