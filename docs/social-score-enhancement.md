# 社交層分數計算系統完善總結

## 概述

已成功完善推薦系統的社交層功能，包括詳細的社交分數計算、推薦原因說明和社交影響力分析。這些功能大幅提升了推薦系統的社交性和可解釋性。

## 完善的功能

### 1. 社交層分數計算 (`utils/socialScoreCalculator.js`)

#### 核心功能

- **社交距離計算**: 支援直接關注、互相關注、二度關係、三度關係
- **社交影響力計算**: 基於追隨者、追隨中、互相關注數量
- **互動分析**: 分析發佈、按讚、留言、分享、收藏、瀏覽等所有互動類型
- **分數上限控制**: 避免單一迷因爆分，保持推薦平衡

#### 配置系統

```javascript
const SOCIAL_SCORE_CONFIG = {
  interactions: {
    publish: 5, // 發佈權重
    like: 3, // 按讚權重
    comment: 3, // 留言權重
    share: 4, // 分享權重
    collect: 2, // 收藏權重
    view: 1, // 瀏覽權重
  },
  distanceWeights: {
    directFollow: 1.0, // 直接關注
    mutualFollow: 1.5, // 互相關注
    secondDegree: 0.6, // 二度關係
    thirdDegree: 0.3, // 三度關係
  },
  scoreLimits: {
    maxSocialScore: 20, // 最大社交分數
    maxInfluenceScore: 100, // 最大影響力分數
  },
}
```

### 2. 推薦原因說明

#### 社交推薦原因

- **具體原因**: "你的好友 user123 按讚了這則迷因"
- **權重排序**: 按影響力權重排序，顯示最重要的原因
- **多原因支援**: 最多顯示3個推薦原因
- **距離資訊**: 包含社交距離和影響力等級

#### 通用推薦原因

- **演算法類型**: 根據推薦演算法生成對應原因
- **熱門分數**: 根據熱門等級生成不同原因
- **標籤偏好**: 基於用戶標籤偏好生成原因

### 3. 社交影響力計算

#### 影響力分數

- **追隨者權重**: 0.3
- **追隨中權重**: 0.2
- **互相關注權重**: 0.5
- **影響力等級**: none, low, moderate, active, popular, influencer

#### 網路分析

- **網路密度**: 社交連接密度計算
- **社交影響範圍**: 直接和間接影響的用戶數量
- **影響力傳播**: 考慮影響力在社交網路中的傳播效果

## 新增的 API 端點

### 1. 社交層分數計算

```
GET /api/recommendations/social-score/:memeId
```

- 計算指定迷因對用戶的社交層分數
- 包含社交距離、影響力、互動分析
- 生成具體的推薦原因

### 2. 用戶社交影響力統計

```
GET /api/recommendations/social-influence-stats
```

- 取得用戶的社交影響力統計
- 包含追隨者、影響力等級等資訊

### 3. 增強的混合推薦

```
GET /api/recommendations/mixed
```

- 新增 `include_social_scores` 參數
- 新增 `include_recommendation_reasons` 參數
- 整合社交層分數和推薦原因

## 整合到混合推薦系統

### 功能整合

- **批量計算**: 為混合推薦中的所有迷因計算社交分數
- **推薦原因**: 自動生成個性化的推薦原因
- **分數融合**: 將社交分數整合到最終推薦分數中

### 回應格式增強

```json
{
  "recommendations": [
    {
      "recommendation_reason": "你的好友 user123 按讚了這則迷因",
      "social_score": 15.2,
      "social_distance_score": 3.5,
      "social_influence_score": 8.7,
      "social_interaction_score": 3.0,
      "social_interactions": [...],
      "recommendation_reasons": [...]
    }
  ]
}
```

## 技術特點

### 1. 效能優化

- **批次處理**: 支援批量計算多個迷因的社交分數
- **快取策略**: 社交圖譜和影響力分數快取
- **分頁處理**: 避免一次性處理過多數據

### 2. 可配置性

- **權重配置**: 所有權重都可以通過配置調整
- **分數上限**: 可配置的分數上限避免極端情況
- **距離限制**: 可配置的最大社交距離

### 3. 錯誤處理

- **邊界情況**: 處理空數據、無社交關係等情況
- **異常恢復**: 優雅的錯誤處理和恢復機制
- **日誌記錄**: 詳細的操作日誌便於調試

## 測試覆蓋

### 測試文件

- `test/socialScoreCalculator.test.js`: 完整的單元測試
- 涵蓋所有核心功能的測試案例
- 包含邊界情況和錯誤處理測試

### 測試內容

- **配置測試**: 驗證配置結構和數值
- **距離計算**: 測試各種社交距離計算
- **影響力計算**: 測試影響力分數和等級
- **推薦原因**: 測試原因生成和排序
- **批量處理**: 測試批量計算功能

## 文檔更新

### 1. API 文檔 (`docs/recommendation-api.md`)

- 新增社交層分數計算端點文檔
- 新增用戶社交影響力統計端點文檔
- 更新混合推薦端點，添加新參數
- 提供詳細的請求/回應範例

### 2. 實作總結 (`docs/recommendation-summary.md`)

- 新增社交層分數計算系統章節
- 更新混合推薦系統，添加社交功能
- 更新路由配置，添加新端點
- 更新總結部分，反映新功能

## 使用範例

### 1. 基本社交分數計算

```javascript
const socialScore = await calculateMemeSocialScore(userId, memeId, {
  includeDistance: true,
  includeInfluence: true,
  includeInteractions: true,
  maxDistance: 3,
})
```

### 2. 批量計算

```javascript
const socialScores = await calculateMultipleMemeSocialScores(userId, memeIds, {
  includeDistance: true,
  includeInfluence: true,
  includeInteractions: true,
  maxDistance: 3,
})
```

### 3. 用戶影響力統計

```javascript
const stats = await getUserSocialInfluenceStats(userId)
console.log(`影響力分數: ${stats.influenceScore}`)
console.log(`影響力等級: ${stats.influenceLevel}`)
```

## 未來擴展

### 1. 進階社交分析

- **社交圈分析**: 分析用戶的社交圈結構
- **影響力傳播**: 更精確的影響力傳播模型
- **社交趨勢**: 分析社交互動的趨勢變化

### 2. 機器學習整合

- **社交特徵學習**: 使用機器學習優化社交權重
- **影響力預測**: 預測內容的社交傳播潛力
- **個性化社交**: 根據用戶偏好調整社交權重

### 3. 即時更新

- **流式處理**: 即時更新社交圖譜和影響力
- **事件驅動**: 基於社交事件的即時推薦調整
- **動態權重**: 根據即時社交活動調整權重

## 總結

通過完善社交層分數計算、推薦原因說明和社交影響力計算功能，推薦系統現在具備了：

1. **更強的社交性**: 詳細的社交關係分析和影響力計算
2. **更好的可解釋性**: 具體的推薦原因說明
3. **更高的準確性**: 多維度的社交分數計算
4. **更靈活的配置**: 可調整的權重和參數
5. **更完整的測試**: 全面的測試覆蓋

這些功能大幅提升了推薦系統的用戶體驗和推薦效果，為迷因平台提供了更智能、更個性化的推薦服務。
