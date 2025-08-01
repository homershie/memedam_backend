# 推薦排序問題修復總結

## 問題描述

用戶報告推薦分頁的順序是相反的，最不受推薦的項目出現在前端顯示的最上面，而最受推薦的項目出現在最後。

## 根本原因分析

經過深入調查，發現問題出現在 `utils/mixedRecommendation.js` 中的社交分數計算邏輯：

1. **社交分數計算函數的排序問題**：`calculateMultipleMemeSocialScores` 函數在計算完社交分數後，會按社交分數對結果進行排序（第 523 行）：

   ```javascript
   results.sort((a, b) => b.socialScore - a.socialScore)
   ```

2. **快取讀取邏輯中的排序丟失**：在 `getMixedRecommendations` 函數的快取讀取邏輯中，當我們對 `paginatedRecommendations` 進行社交分數計算後，沒有重新按 `total_score` 排序，導致排序被社交分數的排序覆蓋。

## 修復方案

### 1. 在快取讀取邏輯中添加重新排序

在 `utils/mixedRecommendation.js` 的快取讀取邏輯中，社交分數計算完成後添加重新排序：

```javascript
// 重新按 total_score 排序，確保社交分數計算不會影響原始排序
paginatedRecommendations.sort((a, b) => b.total_score - a.total_score)
```

### 2. 在非快取路徑中添加重新排序

在 `utils/mixedRecommendation.js` 的非快取路徑中，社交分數計算完成後也添加重新排序：

```javascript
// 重新按 total_score 排序，確保社交分數計算不會影響原始排序
paginatedRecommendations.sort((a, b) => b.total_score - a.total_score)
```

## 修復的文件

### `utils/mixedRecommendation.js`

- **行 660-661**：在快取讀取邏輯的社交分數計算後添加重新排序
- **行 820-821**：在非快取路徑的社交分數計算後添加重新排序

## 測試驗證

### 創建的測試腳本

1. **`test/debug-sorting.js`**：詳細的調試腳本，檢查 API 響應、快取狀態和排序邏輯
2. **`test/simple-sort-test.js`**：簡單的排序測試，比較清除快取和使用快取的結果
3. **`test/verify-sort-fix.js`**：驗證修復是否有效的測試腳本

### 測試內容

- 清除快取後的排序正確性
- 使用快取後的排序正確性
- 兩次結果的一致性
- 社交分數的正確添加

## 修復效果

### 預期結果

1. **排序正確性**：推薦列表按 `total_score` 降序排列
2. **結果一致性**：清除快取和使用快取的結果應該一致
3. **社交分數**：社交分數正確添加但不影響原始排序

### 驗證方法

用戶可以運行以下測試腳本來驗證修復：

```bash
# 詳細調試
node test/debug-sorting.js

# 簡單排序測試
node test/simple-sort-test.js

# 驗證修復
node test/verify-sort-fix.js
```

## 前端使用建議

### 清除快取

在測試修復效果時，建議在前端請求中添加 `clear_cache=true` 參數：

```javascript
// 清除快取並獲取推薦
const response = await apiService.httpAuth.get('/api/recommendations/mixed', {
  params: {
    limit: 10,
    clear_cache: 'true',
  },
})
```

### 正常使用

修復後，正常使用時不需要 `clear_cache` 參數：

```javascript
// 正常獲取推薦
const response = await apiService.httpAuth.get('/api/recommendations/mixed', {
  params: {
    limit: 10,
    page: 1,
  },
})
```

## 技術細節

### 排序邏輯

- **主要排序依據**：`total_score`（加權總分）
- **排序方向**：降序（最高分在前）
- **排序時機**：
  1. `mergeRecommendations` 函數中（第 526 行）
  2. 社交分數計算後（新增的修復）
  3. 控制器最終排序（第 643-646 行）

### 快取策略

- **快取內容**：完整的推薦列表（不包含分頁資訊）
- **快取鍵**：`mixed_recommendations:${userId}:${limit}:${weights}:${tags}`
- **分頁處理**：在快取數據上進行分頁和排除操作

### 社交分數整合

- **計算時機**：在分頁後對當前頁面的推薦進行計算
- **不影響排序**：社交分數僅作為附加信息，不影響 `total_score` 排序
- **重新排序**：計算完成後重新按 `total_score` 排序

## 注意事項

1. **性能影響**：社交分數計算會增加響應時間，但這是必要的功能
2. **快取一致性**：修復確保了快取和非快取路徑的一致性
3. **向後兼容**：修復不影響現有的 API 接口和參數

## 後續監控

建議監控以下指標：

- 推薦排序的正確性
- API 響應時間
- 快取命中率
- 用戶滿意度（通過前端反饋）
