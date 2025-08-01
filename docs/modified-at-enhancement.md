# Modified_at 欄位增強功能

## 概述

為了鼓勵內容創作者更新和改善現有迷因內容，我們在 Meme 模型中新增了 `modified_at` 欄位，並對推薦系統進行了相應的優化。

## 新增功能

### 1. 模型變更

#### Meme.js 新增欄位
```javascript
modified_at: {
  type: Date,
  default: null,
  validate: {
    validator: function (v) {
      if (!v) return true // 允許空值
      return v instanceof Date && !isNaN(v)
    },
    message: '修改時間必須是有效的日期',
  },
  // 最後實質性修改時間（用於推薦系統優化）
}
```

#### 新增實例方法

**markAsModified(updateFields)**
- 自動判斷是否為實質性修改
- 實質性修改包括：`title`, `content`, `tags_cache`, `image_url`, `video_url`, `audio_url`, `detail_markdown`
- 僅在實質性修改時更新 `modified_at`

**getEffectiveDate()**
- 返回有效的時間基準
- 優先使用 `modified_at`，若無則使用 `createdAt`

### 2. 推薦系統增強

#### 新增推薦類型：`updated`
- 專門推薦最近更新的內容
- 在混合推薦中佔 **16%** 權重

#### 熱門分數計算優化
- **時間基準**：使用 `modified_at` 或 `createdAt`（優先前者）
- **新鮮度加成**：修改過的內容獲得 **20%** 額外加成
- **時間衰減**：基於最後修改時間重新計算

#### 更新內容專用評分算法
```javascript
calculateUpdatedContentScore(memeData, now = new Date())
```

**評分規則：**
- **1小時內修改**：+100% 分數
- **6小時內修改**：+50% 分數  
- **24小時內修改**：+30% 分數
- **3天內修改**：+10% 分數
- **老內容修改**：額外年齡加成（7天以上 +40%，3天以上 +20%）

### 3. 權重調整

#### 新的推薦權重分配
```javascript
const ALGORITHM_WEIGHTS = {
  hot: 0.22,                          // 熱門推薦
  latest: 0.22,                       // 最新推薦  
  updated: 0.16,                      // 🆕 更新內容推薦
  content_based: 0.17,                // 內容基礎推薦
  collaborative_filtering: 0.12,      // 協同過濾推薦
  social_collaborative_filtering: 0.11 // 社交協同過濾推薦
}
```

#### 不同用戶活躍度的權重調整
- **非常活躍用戶**：`updated` 佔 10%
- **活躍用戶**：`updated` 佔 12%
- **中等活躍用戶**：`updated` 佔 15%
- **低活躍用戶**：`updated` 佔 20%

## 使用方式

### 1. 在控制器中標記修改

```javascript
// 在 memeController.js 的更新方法中
const updatedMeme = await Meme.findById(memeId)
updatedMeme.markAsModified(req.body) // 自動判斷是否實質性修改
await updatedMeme.save()
```

### 2. 獲取更新內容推薦

```javascript
import { getUpdatedRecommendations } from '../utils/mixedRecommendation.js'

// 獲取最近30天內更新的推薦
const recommendations = await getUpdatedRecommendations({
  limit: 20,
  days: 30,
  tags: ['搞笑', '時事']
})
```

### 3. 在推薦原因中顯示

```javascript
// 推薦原因會自動包含
{
  recommendation_reason: "這則迷因最近有更新",
  recommendation_type: "updated",
  days_since_modified: 2
}
```

## 優勢與效果

### 1. 鼓勵內容改善
- 創作者有動機更新舊內容
- 提高整體內容品質
- 延長內容生命週期

### 2. 推薦系統優化
- 更新的內容獲得重新曝光機會
- 避免優質舊內容被埋沒
- 平衡新舊內容的推薦比例

### 3. 用戶體驗提升
- 用戶能看到經過改善的內容
- 推薦更加多樣化
- 提供明確的推薦原因

## 注意事項

### 1. 防止濫用機制
- 只有實質性修改才會更新 `modified_at`
- 統計數據變更不觸發修改時間更新
- 可考慮設置修改頻率限制

### 2. 快取策略
- 更新內容推薦快取 10 分鐘
- 清除快取時需包含 `updated_recommendations:*`

### 3. 資料庫考量
- 新欄位對現有資料無影響（預設為 null）
- 建議為 `modified_at` 欄位建立索引以提升查詢效能

## 未來擴展

### 1. 修改歷史追蹤
- 可考慮增加修改次數統計
- 記錄修改類型（內容、標籤、媒體等）

### 2. 編輯者貢獻統計
- 追蹤協作編輯的貢獻
- 編輯者獎勵機制

### 3. A/B 測試支援
- 測試不同權重配置的效果
- 優化推薦演算法參數

## 總結

透過引入 `modified_at` 欄位和相應的推薦系統優化，我們能夠：
- ✅ 鼓勵內容創作者持續改善作品
- ✅ 提供更新穎、更優質的推薦內容  
- ✅ 平衡新舊內容的曝光機會
- ✅ 提升整體用戶體驗和內容品質

這個增強功能將有效促進內容生態的良性循環，鼓勵持續的內容優化和創新。