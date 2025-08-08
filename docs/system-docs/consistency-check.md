# 資料一致性檢查和事務處理

## 概述

本系統提供了完整的資料一致性檢查和事務處理機制，確保迷因的計數欄位（如按讚數、留言數等）與實際資料保持同步。

## 功能特色

### 1. 自動計數更新（含事務處理）

- ✅ 按讚/取消讚時自動更新 `like_count`（事務保護）
- ✅ 按噓/取消噓時自動更新 `dislike_count`（事務保護）
- ✅ 新增/刪除留言時自動更新 `comment_count`（事務保護）
- ✅ 收藏/取消收藏時自動更新 `collection_count`（事務保護）
- ✅ 分享時自動更新 `share_count`（事務保護）

### 2. 事務處理

- ✅ 使用 MongoDB 事務確保資料一致性
- ✅ 操作失敗時自動回滾
- ✅ 支援批次操作

### 3. 資料一致性檢查

- ✅ 檢查並修正計數不一致的問題
- ✅ 支援單一迷因或批次檢查
- ✅ 提供詳細的檢查報告

## API 端點

### 管理功能（需要管理員權限）

#### 檢查單一迷因的計數

```http
POST /admin/check-counts/:memeId
Authorization: Bearer <token>
```

**回應範例：**

```json
{
  "success": true,
  "data": {
    "total": 1,
    "fixed": 1,
    "errors": [],
    "details": [
      {
        "meme_id": "507f1f77bcf86cd799439011",
        "meme_title": "測試迷因",
        "fixed": true,
        "changes": {
          "like_count": { "from": 5, "to": 3 },
          "comment_count": { "from": 10, "to": 8 }
        }
      }
    ]
  },
  "error": null
}
```

#### 批次檢查所有迷因

```http
POST /admin/check-all-counts
Authorization: Bearer <token>
Content-Type: application/json

{
  "batchSize": 100
}
```

**回應範例：**

```json
{
  "success": true,
  "data": {
    "total": 1000,
    "processed": 1000,
    "fixed": 25,
    "errors": []
  },
  "error": null
}
```

#### 取得統計資訊

```http
GET /admin/count-statistics
Authorization: Bearer <token>
```

**回應範例：**

```json
{
  "success": true,
  "data": {
    "memes": 1000,
    "likes": 5000,
    "dislikes": 200,
    "comments": 3000,
    "collections": 1500,
    "shares": 800
  },
  "error": null
}
```

## 使用方式

### 1. 程式碼中使用事務

```javascript
import { executeTransaction } from '../utils/transaction.js'

// 在 controller 中使用
export const createLike = async (req, res) => {
  try {
    const { meme_id } = req.body

    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      // 建立按讚記錄
      const like = new Like({ meme_id, user_id: req.user._id })
      await like.save({ session })

      // 更新迷因計數
      await Meme.findByIdAndUpdate(meme_id, { $inc: { like_count: 1 } }, { session })

      return like
    })

    res.status(201).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}
```

### 2. 定期執行一致性檢查

```javascript
import { batchCheckCounts } from '../utils/checkCounts.js'

// 每日凌晨執行檢查
const schedule = require('node-schedule')

schedule.scheduleJob('0 2 * * *', async () => {
  try {
    console.log('開始執行資料一致性檢查...')
    const result = await batchCheckCounts(100)
    console.log(`檢查完成：總計 ${result.total} 個迷因，修正 ${result.fixed} 個`)
  } catch (error) {
    console.error('一致性檢查失敗:', error)
  }
})
```

### 3. 手動執行檢查

```javascript
import { checkAndFixCounts, getCountStatistics } from '../utils/checkCounts.js'

// 檢查特定迷因
const result = await checkAndFixCounts('507f1f77bcf86cd799439011')

// 取得統計資訊
const stats = await getCountStatistics()
console.log('系統統計:', stats)
```

## 錯誤處理

### 常見錯誤

1. **事務失敗**
   - 原因：資料庫連線問題、並發衝突
   - 處理：自動回滾，記錄錯誤日誌

2. **計數不一致**
   - 原因：系統故障、手動資料修改
   - 處理：自動檢查並修正

3. **權限不足**
   - 原因：非管理員用戶嘗試執行管理功能
   - 處理：回傳 403 錯誤

### 監控建議

1. **定期檢查**
   - 每日執行批次檢查
   - 監控修正數量，異常時發出警報

2. **效能監控**
   - 監控事務執行時間
   - 監控資料庫連線狀態

3. **錯誤記錄**
   - 記錄所有檢查和修正操作
   - 記錄事務失敗的詳細資訊

## 最佳實踐

1. **使用事務**
   - 所有會影響計數的操作都使用事務
   - 確保資料一致性

2. **定期維護**
   - 定期執行一致性檢查
   - 監控系統健康狀態

3. **錯誤處理**
   - 妥善處理事務失敗
   - 提供詳細的錯誤資訊

4. **效能優化**
   - 使用批次處理大量資料
   - 避免長時間鎖定資料庫
