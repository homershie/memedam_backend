# 快取系統重設計劃

## 版本資訊

- **文件版本**: 1.0
- **建立日期**: 2025年1月
- **作者**: AI Assistant
- **審核狀態**: 待審核

## 目錄

1. [現狀分析](#現狀分析)
2. [問題診斷](#問題診斷)
3. [優先順序規劃](#優先順序規劃)
4. [實施方案](#實施方案)
5. [時間表與里程碑](#時間表與里程碑)
6. [測試計劃](#測試計劃)
7. [風險評估與緩解](#風險評估與緩解)
8. [監控與回滾計劃](#監控與回滾計劃)

---

## 現狀分析

### 目前快取使用範圍

#### 1. 推薦系統快取

- **主要快取**: `mixed_recommendations:*`, `hot_recommendations:*`, `latest_recommendations:*`
- **快取策略**: 全量快取完整推薦列表，運行時分頁處理
- **TTL 設定**: 10-60 分鐘不等
- **資料來源**: `utils/mixedRecommendation.js`

#### 2. 分析監控快取

- **快取內容**: 即時統計、每日統計、演算法比較
- **TTL 設定**: 5分鐘-1小時
- **使用場景**: 管理員儀表板
- **資料來源**: `services/analyticsMonitor.js`

#### 3. 系統狀態快取

- **快取內容**: Redis 連線狀態、資料庫統計
- **TTL 設定**: 實時查詢
- **使用場景**: 健康檢查端點
- **資料來源**: `index.js`

### 技術架構

#### 快取層次

- **L1**: Redis 快取（主要）
- **L2**: 應用層快取（無）
- **L3**: CDN 快取（無）

#### 快取鍵命名規則

```
mixed_recommendations:{userId}:{limit}:{customWeights}:{tags}
hot_recommendations:{userId}:*
social_scores:{userId}:*
user_activity:{userId}
```

---

## 問題診斷

### 主要問題

#### 1. 效能問題（緊急）

- ❌ **粗暴清除策略**: 任何寫入操作都清除所有相關快取
- ❌ **全量快取策略**: 快取完整列表而非分頁結果
- ❌ **缺少快取版本控制**: 無法實現條件請求

#### 2. 可維護性問題（重要）

- ❌ **缺少快取命中率監控**: 無法評估快取效能
- ❌ **無統一快取管理**: 分散在各個服務中
- ❌ **缺少快取預熱機制**: 冷啟動效能差

#### 3. 架構問題（長期）

- ❌ **單一快取實例**: 無快取層次結構
- ❌ **缺少容錯機制**: 快取失敗影響主要功能
- ❌ **無快取數據壓縮**: 記憶體使用效率低

### 影響評估

#### 效能影響

- **用戶體驗**: 快取清除後的首次請求響應時間增加 2-5 倍
- **伺服器負載**: 重複計算導致 CPU 使用率升高 30-50%
- **網路傳輸**: 無法利用 HTTP 快取，增加頻寬消耗

#### 維護影響

- **開發效率**: 快取問題難以診斷和修復
- **運營成本**: 缺少監控導致效能問題難以發現
- **擴展性**: 單點故障風險高

---

## 優先順序規劃

### 階段一：緊急修復（1-2週）

#### 1.1 智慧快取失效策略 ⭐⭐⭐⭐⭐

**問題**: 全量清除造成大量重計算
**影響**: 嚴重效能問題
**預期效益**: 效能提升 50-70%

#### 1.2 快取版本控制系統 ⭐⭐⭐⭐⭐

**問題**: 無版本控制，無法實現條件請求
**影響**: 無法利用瀏覽器快取
**預期效益**: 網路傳輸減少 30-50%

#### 1.3 統一快取管理器 ⭐⭐⭐⭐

**問題**: 快取邏輯分散，難以維護
**影響**: 程式碼重複，錯誤率高
**預期效益**: 開發效率提升 40%

### 階段二：效能優化（2-3週）

#### 2.1 HTTP 協商快取實現 ⭐⭐⭐⭐

**問題**: 無 ETag/Last-Modified 支援
**影響**: 無法利用瀏覽器快取機制
**預期效益**: 用戶體驗顯著改善

#### 2.2 快取命中率監控系統 ⭐⭐⭐⭐

**問題**: 無法評估快取效能
**影響**: 無法優化快取策略
**預期效益**: 效能優化決策更精準

#### 2.3 快取預熱機制 ⭐⭐⭐

**問題**: 冷啟動效能差
**影響**: 初始請求響應慢
**預期效益**: 冷啟動效能提升 60%

### 階段三：架構優化（3-4週）

#### 3.1 分層快取架構 ⭐⭐⭐

**問題**: 單一快取實例
**影響**: 無法處理不同類型快取需求
**預期效益**: 系統擴展性提升

#### 3.2 快取容錯機制 ⭐⭐

**問題**: 快取失敗影響主要功能
**影響**: 系統穩定性下降
**預期效益**: 系統可用性提升 99.9%

#### 3.3 快取數據壓縮 ⭐⭐

**問題**: 記憶體使用效率低
**影響**: 快取成本增加
**預期效益**: 記憶體使用優化 40%

---

## 實施方案

### 階段一：緊急修復

#### 1.1 智慧快取失效策略

**目標**: 實現增量快取更新而非全量清除

**實作方案**:

```javascript
// 智慧快取清除器
class SmartCacheInvalidator {
  async invalidateByOperation(operation, params) {
    switch (operation) {
      case 'MEME_CREATED':
        // 只清除受影響的標籤快取
        await this.clearTagRecommendations(params.tags)
        break
      case 'USER_INTERACTION':
        // 只清除用戶個人化快取
        await this.clearUserCache(params.userId)
        break
    }
  }
}
```

**檔案變更**:

- 新增: `utils/smartCacheInvalidator.js`
- 修改: `controllers/memeController.js`
- 修改: `controllers/likeController.js`
- 修改: `controllers/commentController.js`

#### 1.2 快取版本控制系統

**目標**: 實現快取版本管理

**實作方案**:

```javascript
// 快取版本管理器
class CacheVersionManager {
  constructor(redisClient) {
    this.redis = redisClient
    this.versions = new Map()
  }

  async getVersion(cacheKey) {
    return (await this.redis.get(`${cacheKey}:version`)) || '1.0.0'
  }

  async updateVersion(cacheKey) {
    const newVersion = this.incrementVersion(await this.getVersion(cacheKey))
    await this.redis.set(`${cacheKey}:version`, newVersion)
    return newVersion
  }
}
```

**檔案變更**:

- 新增: `utils/cacheVersionManager.js`
- 修改: `utils/mixedRecommendation.js`
- 修改: `services/analyticsMonitor.js`

#### 1.3 統一快取管理器

**目標**: 集中管理所有快取操作

**實作方案**:

```javascript
// 統一快取管理器
class CacheManager {
  constructor(redisClient) {
    this.redis = redisClient
    this.monitor = new CacheMonitor()
    this.versionManager = new CacheVersionManager(redisClient)
  }

  async getOrSet(cacheKey, fetchFunction, options = {}) {
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      this.monitor.recordHit(cacheKey)
      return cached
    }

    this.monitor.recordMiss(cacheKey)
    const data = await fetchFunction()
    await this.redis.set(cacheKey, data, options.ttl)

    return data
  }
}
```

**檔案變更**:

- 新增: `utils/cacheManager.js`
- 修改: `config/redis.js` (整合 CacheManager)
- 新增: `utils/cacheMonitor.js`

### 階段二：效能優化

#### 2.1 HTTP 協商快取實現

**目標**: 添加 ETag 和 Last-Modified 支援

**實作方案**:

```javascript
// HTTP 快取中間件
const conditionalCache = (req, res, next) => {
  const clientETag = req.headers['if-none-match']
  const serverETag = generateETag(res.locals.data)

  if (clientETag === serverETag) {
    return res.status(304).end()
  }

  res.set({
    ETag: serverETag,
    'Cache-Control': 'private, max-age=300',
    'Last-Modified': new Date().toUTCString(),
  })

  next()
}
```

**檔案變更**:

- 新增: `middleware/conditionalCache.js`
- 修改: `controllers/recommendationController.js`
- 修改: `routes/recommendationRoutes.js`

#### 2.2 快取命中率監控系統

**目標**: 實時監控快取效能

**實作方案**:

```javascript
// 快取監控器
class CacheMonitor {
  constructor() {
    this.metrics = new Map()
  }

  recordHit(cacheKey) {
    this.updateMetrics(cacheKey, 'hit')
  }

  recordMiss(cacheKey) {
    this.updateMetrics(cacheKey, 'miss')
  }

  getHitRate(cacheKey) {
    const metric = this.metrics.get(cacheKey)
    if (!metric) return 0

    const total = metric.hits + metric.misses
    return total > 0 ? (metric.hits / total) * 100 : 0
  }
}
```

**檔案變更**:

- 新增: `utils/cacheMonitor.js`
- 修改: `utils/cacheManager.js`
- 新增: `routes/cacheMonitorRoutes.js`

#### 2.3 快取預熱機制

**目標**: 低峰期預先計算熱門內容

**實作方案**:

```javascript
// 快取預熱器
class CacheWarmer {
  constructor(cacheManager) {
    this.cacheManager = cacheManager
  }

  async warmupHotContent() {
    // 預計算熱門推薦
    const hotMemes = await Meme.find().sort({ hot_score: -1 }).limit(100).lean()

    // 預快取熱門推薦
    await this.cacheManager.set('hot_recommendations:global', hotMemes, { ttl: 3600 })
  }

  async scheduleWarmup() {
    // 每小時預熱一次
    setInterval(() => this.warmupHotContent(), 60 * 60 * 1000)
  }
}
```

**檔案變更**:

- 新增: `utils/cacheWarmer.js`
- 修改: `index.js` (啟動時執行預熱)

### 階段三：架構優化

#### 3.1 分層快取架構

**目標**: 實現多層快取策略

**實作方案**:

```javascript
// 分層快取管理器
class HierarchicalCache {
  constructor() {
    this.l1Cache = new MemoryCache() // 應用層快取
    this.l2Cache = new RedisCache() // 分散式快取
    this.l3Cache = new CDNCache() // CDN 快取
  }

  async get(key) {
    // L1 檢查
    let data = await this.l1Cache.get(key)
    if (data) return data

    // L2 檢查
    data = await this.l2Cache.get(key)
    if (data) {
      // 寫回 L1
      await this.l1Cache.set(key, data)
      return data
    }

    return null
  }
}
```

#### 3.2 快取容錯機制

**目標**: 快取失敗時的降級處理

**實作方案**:

```javascript
// 容錯快取包裝器
class FaultTolerantCache {
  async getOrSet(cacheKey, fetchFunction, options = {}) {
    try {
      return await this.cache.getOrSet(cacheKey, fetchFunction, options)
    } catch (cacheError) {
      logger.warn('快取操作失敗，使用直接查詢', { cacheKey, error: cacheError })

      // 降級到直接查詢
      return await fetchFunction()
    }
  }
}
```

#### 3.3 快取數據壓縮

**目標**: 減少記憶體使用

**實作方案**:

```javascript
// 壓縮快取管理器
class CompressedCache {
  async set(key, data, ttl) {
    const compressedData = this.compress(JSON.stringify(data))
    await this.redis.set(key, compressedData, ttl)
  }

  async get(key) {
    const compressedData = await this.redis.get(key)
    if (!compressedData) return null

    const decompressedData = this.decompress(compressedData)
    return JSON.parse(decompressedData)
  }
}
```

---

## 時間表與里程碑

### 階段一：緊急修復（第1-2週）

| 週次  | 任務             | 負責人   | 狀態   | 驗收標準                 |
| ----- | ---------------- | -------- | ------ | ------------------------ |
| 第1週 | 智慧快取失效策略 | 開發團隊 | 待開始 | 寫入操作不再全量清除快取 |
| 第1週 | 快取版本控制系統 | 開發團隊 | 待開始 | 實現快取版本號管理       |
| 第2週 | 統一快取管理器   | 開發團隊 | 待開始 | 所有快取操作通過統一介面 |

### 階段二：效能優化（第3-5週）

| 週次  | 任務           | 負責人   | 狀態   | 驗收標準             |
| ----- | -------------- | -------- | ------ | -------------------- |
| 第3週 | HTTP 協商快取  | 開發團隊 | 待開始 | 支援 ETag 和條件請求 |
| 第4週 | 快取命中率監控 | 開發團隊 | 待開始 | 提供即時快取統計     |
| 第5週 | 快取預熱機制   | 開發團隊 | 待開始 | 冷啟動效能提升60%    |

### 階段三：架構優化（第6-9週）

| 週次  | 任務           | 負責人   | 狀態   | 驗收標準               |
| ----- | -------------- | -------- | ------ | ---------------------- |
| 第6週 | 分層快取架構   | 開發團隊 | 待開始 | 支持L1/L2/L3快取層次   |
| 第7週 | 快取容錯機制   | 開發團隊 | 待開始 | 快取失敗不影響主要功能 |
| 第8週 | 快取數據壓縮   | 開發團隊 | 待開始 | 記憶體使用優化40%      |
| 第9週 | 整合測試與優化 | 測試團隊 | 待開始 | 全系統效能提升50%      |

### 關鍵里程碑

1. **M1**: 階段一完成 - 基本功能恢復正常
2. **M2**: 階段二完成 - 效能顯著改善
3. **M3**: 階段三完成 - 架構完全優化
4. **M4**: 上線驗證 - 生產環境穩定運行

---

## 測試計劃

### 單元測試

#### 智慧快取失效策略測試

```javascript
describe('SmartCacheInvalidator', () => {
  test('should only clear affected cache keys', async () => {
    // 測試只有相關快取被清除
  })

  test('should not clear unrelated cache keys', async () => {
    // 測試不相關快取不受影響
  })
})
```

#### 快取版本控制測試

```javascript
describe('CacheVersionManager', () => {
  test('should increment version correctly', async () => {
    // 測試版本號正確遞增
  })

  test('should handle concurrent updates', async () => {
    // 測試並發更新的一致性
  })
})
```

### 整合測試

#### 端到端快取測試

```javascript
describe('Cache E2E Test', () => {
  test('should serve from cache when available', async () => {
    // 測試快取命中
  })

  test('should invalidate cache on data changes', async () => {
    // 測試快取失效
  })
})
```

#### HTTP 快取測試

```javascript
describe('HTTP Conditional Cache', () => {
  test('should return 304 when ETag matches', async () => {
    // 測試條件請求
  })

  test('should return fresh data when ETag differs', async () => {
    // 測試快取失效時返回新數據
  })
})
```

### 效能測試

#### 快取命中率測試

- 目標: 命中率 > 80%
- 測試場景: 高併發請求
- 監控指標: 響應時間、CPU使用率

#### 記憶體使用測試

- 目標: 記憶體使用 < 70%
- 測試場景: 大量快取數據
- 監控指標: 記憶體使用量、GC頻率

### 壓力測試

#### 高併發測試

- 併發用戶: 1000+
- 請求頻率: 100 req/s
- 測試時間: 30分鐘
- 成功標準: 無快取失效錯誤

#### 快取失效測試

- 模擬大量數據更新
- 監控快取重建時間
- 確保服務可用性

---

## 風險評估與緩解

### 高風險項目

#### 1. 快取策略變更風險

**風險**: 新快取策略可能導致數據不一致
**影響**: 用戶看到過時數據
**緩解方案**:

- 實施雙寫策略（同時寫入舊快取和新快取）
- A/B 測試新舊策略
- 準備快速回滾機制

#### 2. 記憶體使用風險

**風險**: 壓縮快取可能增加CPU負擔
**影響**: 系統效能下降
**緩解方案**:

- 監控CPU使用率
- 實施自適應壓縮策略
- 準備壓縮等級調整機制

### 中風險項目

#### 3. 版本控制複雜度

**風險**: 快取版本管理增加系統複雜度
**影響**: 開發和維護成本增加
**緩解方案**:

- 提供清晰的文件和API
- 實施自動化測試
- 定期程式碼審查

#### 4. 監控系統額外負擔

**風險**: 新增監控可能影響效能
**影響**: 系統響應時間增加
**緩解方案**:

- 非同步記錄監控數據
- 使用高效的監控資料庫
- 實施監控數據抽樣

### 低風險項目

#### 5. 第三方依賴風險

**風險**: Redis 或其他依賴服務故障
**影響**: 快取功能失效
**緩解方案**:

- 實施降級策略
- 多重備份機制
- 服務健康監控

---

## 監控與回滾計劃

### 監控指標

#### 效能指標

- 快取命中率: > 80%
- 平均響應時間: < 200ms
- 記憶體使用率: < 70%
- CPU 使用率: < 60%

#### 業務指標

- 用戶滿意度: 通過用戶反饋收集
- 功能可用性: 99.9% SLA
- 錯誤率: < 0.1%

### 告警機制

#### 即時告警

- 快取命中率 < 70%
- 記憶體使用率 > 80%
- 響應時間 > 500ms
- 錯誤率 > 1%

#### 趨勢告警

- 快取命中率持續下降
- 記憶體使用率持續上升
- 響應時間持續增加

### 回滾計劃

#### 快速回滾

```bash
# 1. 停止新版本服務
docker-compose stop app-new

# 2. 啟動舊版本服務
docker-compose start app-old

# 3. 清除新快取
redis-cli KEYS "new_cache:*" | xargs redis-cli DEL

# 4. 驗證服務恢復
curl http://localhost:4000/health
```

#### 漸進式回滾

```bash
# 1. 降低新版本流量到 10%
kubectl set image deployment/app app=old-image:v1.0

# 2. 監控效能指標
# 3. 如果穩定，逐步增加流量
# 4. 完全切換或保持混合部署
```

### 災難恢復

#### 數據備份

- 每日快取數據備份
- 快取配置版本控制
- 監控配置自動化部署

#### 服務恢復

- 多區域部署
- 自動故障轉移
- 灰度發佈機制

---

## 結論

此快取系統重設計劃將分三階段實施，預計總共9週完成。通過實施智慧快取失效策略、版本控制系統和統一管理器，可以顯著提升系統效能和可維護性。

**預期效益**:

- 效能提升: 50-70%
- 開發效率: 提升40%
- 系統穩定性: 提升至99.9%
- 維護成本: 降低30%

**成功關鍵**:

1. 遵循優先順序，逐步實施
2. 完善的測試覆蓋
3. 持續監控和優化
4. 準備充分的回滾計劃

---

## 附錄

### 術語表

- **TTL**: Time To Live，快取過期時間
- **ETag**: Entity Tag，用於HTTP快取驗證
- **CDN**: Content Delivery Network，內容分發網路
- **PKCE**: Proof Key for Code Exchange，OAuth 2.0 安全擴展

### 參考資料

1. [Redis Caching Best Practices](https://redis.io/docs/manual/patterns/)
2. [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
3. [Cache Invalidation Strategies](https://www.martinfowler.com/bliki/TwoHardThings.html)

### 版本歷史

| 版本 | 日期    | 變更內容 | 作者         |
| ---- | ------- | -------- | ------------ |
| 1.0  | 2025-01 | 初始版本 | AI Assistant |

---

_此文件為 MemeDam 專案的快取系統重設計劃，實施前請確保所有相關團隊成員已閱讀並理解內容。如有疑問，請聯繫技術負責人。_
