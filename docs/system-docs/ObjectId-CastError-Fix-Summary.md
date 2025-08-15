# ObjectId CastError 修復總結

## 問題描述

用戶在使用推薦系統API時遇到以下錯誤：

```
CastError: Cast to ObjectId failed for value "{
  '$nin': [
    new ObjectId('68881ac39383b508e4ac0640'),
    new ObjectId('6886f1992987480bf1433b13'),
    ...
  ]
}" (type Object) at path "_id" for model "Meme"
```

**錯誤發生路由：** `/api/recommendations?algorithm=trending&exclude_ids=...`

## 根本原因

問題出現在推薦系統控制器中處理 `exclude_ids` 參數時：

1. **不正確的 ObjectId 轉換**：某些函數只驗證 ObjectId 有效性，但沒有正確創建 ObjectId 實例
2. **$nin 查詢物件被當作 ObjectId**：整個包含 `$nin` 操作符的查詢物件被錯誤地當作單一 ObjectId 處理
3. **重複轉換**：在某些地方對已經是 ObjectId 實例的值再次進行轉換

## 修復方案

### 1. 統一 ObjectId 處理邏輯

在 `controllers/recommendationController.js` 中的所有推薦函數中，統一實施以下安全的 ObjectId 轉換邏輯：

```javascript
// 解析排除ID參數 - 使用安全的ObjectId轉換
let excludeIds = []
if (exclude_ids) {
  const rawIds = Array.isArray(exclude_ids)
    ? exclude_ids
    : exclude_ids
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id)

  // 確保所有ID都轉換為有效的ObjectId實例
  excludeIds = rawIds
    .filter((id) => {
      try {
        return mongoose.Types.ObjectId.isValid(id)
      } catch {
        console.warn(`無效的ObjectId格式: ${id}`)
        return false
      }
    })
    .map((id) => {
      try {
        const objectId =
          id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
        return objectId
      } catch (error) {
        console.warn(`轉換ObjectId失敗: ${id}`, error)
        return null
      }
    })
    .filter((id) => id !== null)
}
```

### 2. 修復的函數列表

以下函數已經修復：

- ✅ `getHotRecommendations` (第96-130行)
- ✅ `getLatestRecommendations` (第240-274行)
- ✅ `getTrendingRecommendationsController` (第1552-1631行)
- ✅ `getSocialCollaborativeFilteringRecommendationsController` (第1291-1323行)

### 3. 關鍵修復點

1. **確保 ObjectId 實例創建**：

   ```javascript
   const objectId = id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
   ```

2. **避免重複轉換**：

   ```javascript
   // 修復前 (錯誤)
   $nin: excludeIds.map((id) => new mongoose.Types.ObjectId(id))

   // 修復後 (正確)
   $nin: excludeIds // excludeIds 已經是ObjectId實例陣列
   ```

3. **添加錯誤處理**：確保無效ID被正確過濾，不會導致整個查詢失敗

## 相關 Pull Request

此問題之前在以下 PR 中也有相關修復：

- [PR #8](https://github.com/homershie/memedex_backend/pull/8) - Debug objectid cast failure
- [PR #9](https://github.com/homershie/memedex_backend/pull/9) - Debug social collaborative filtering recommendation error

本次修復補充了這些 PR 中未涵蓋的控制器函數。

## 驗證方法

### 1. 手動測試

測試以下API端點：

```bash
# 測試 trending 算法 (原始錯誤發生處)
curl "http://localhost:3000/api/recommendations?page=2&limit=10&include_social_signals=true&exclude_ids=68881ac39383b508e4ac0640,6886f1992987480bf1433b13&algorithm=trending"

# 測試 hot 推薦
curl "http://localhost:3000/api/recommendations/hot?exclude_ids=68881ac39383b508e4ac0640,6886f1992987480bf1433b13"

# 測試 latest 推薦
curl "http://localhost:3000/api/recommendations/latest?exclude_ids=68881ac39383b508e4ac0640,6886f1992987480bf1433b13"
```

### 2. 預期結果

- ✅ 不再出現 `CastError: Cast to ObjectId failed` 錯誤
- ✅ API 正常返回推薦結果
- ✅ `exclude_ids` 參數正確工作，排除指定的迷因ID
- ✅ 無效的ObjectId會被自動過濾，不影響查詢

### 3. 錯誤處理

修復後的系統能夠：

- 自動跳過無效的ObjectId格式
- 記錄警告訊息而不是拋出錯誤
- 確保查詢能夠繼續執行，即使部分ID無效

## 檔案變更

- `controllers/recommendationController.js` - 主要修復檔案
- `test-objectid-fix.js` - 驗證測試腳本 (可選)

## 總結

此修復解決了推薦系統中 `exclude_ids` 參數處理的 ObjectId CastError 問題。通過統一的安全轉換邏輯和適當的錯誤處理，確保系統能夠穩定處理各種輸入格式，避免因為 ObjectId 轉換錯誤導致的 API 崩潰。

**修復狀態：** ✅ 完成  
**測試狀態：** ✅ 需要手動驗證  
**部署狀態：** 🟡 準備就緒

---

## 2025-08-15 新增修復記錄

### TagController ObjectId CastError 修復

#### 問題描述

在標籤維護 API 中遇到以下錯誤：

```
CastError: Cast to ObjectId failed for value "{ '$ne': new ObjectId('6888191b9383b508e4ac04c2') }" (type Object) at path "_id" for model "Tag"
```

**錯誤發生路由：** `/api/tags/maintenance/rebuild` 和 `/api/tags/:id` (PUT)

#### 根本原因

在 `tagController.js` 中使用了 `{ _id: { $ne: ObjectId } }` 的查詢方式，這會導致 Mongoose 將整個查詢物件當作 `_id` 值進行 ObjectId 轉換，從而引發 CastError。

#### 修復方案

使用 Mongoose Query Builder 的方式替代 `$ne` 操作符：

**修復前 (錯誤)：**

```javascript
// updateTag 函數中
const existingTag = await Tag.findOne({
  name: req.body.name,
  lang: req.body.lang || 'zh',
  _id: { $ne: req.params.id },
}).session(session)

// rebuildTagsMetadata 函數中
const dup = await Tag.findOne({ lang: tagLang, slug: unique, _id: { $ne: t._id } })
```

**修復後 (正確)：**

```javascript
// updateTag 函數中
const existingTag = await Tag.findOne({
  name: req.body.name,
  lang: req.body.lang || 'zh',
})
  .where('_id')
  .ne(req.params.id)
  .session(session)

// rebuildTagsMetadata 函數中 - 使用記憶體過濾避免 ObjectId CastError
const existingTags = await Tag.find({
  lang: tagLang,
  slug: unique,
}).lean()

// 在記憶體中過濾掉當前標籤
const dup = existingTags.find((tag) => tag._id.toString() !== t._id.toString())
```

#### 修復的函數列表

- ✅ `updateTag` (第251行) - 更新標籤時的重複檢查
- ✅ `rebuildTagsMetadata` (第530行) - 批次重建標籤時的 slug 唯一性檢查

#### 關鍵修復點

1. **使用 Query Builder 語法**：

   ```javascript
   // 避免將查詢物件當作 _id 值
   .where('_id').ne(objectId)
   ```

2. **使用記憶體過濾**：

   ```javascript
   // 對於複雜查詢，先查詢所有結果再在記憶體中過濾
   const existingTags = await Tag.find({ lang: tagLang, slug: unique }).lean()
   const dup = existingTags.find((tag) => tag._id.toString() !== t._id.toString())
   ```

3. **保持 session 支援**：

   ```javascript
   // 確保在事務中正確使用
   .where('_id').ne(req.params.id).session(session)
   ```

4. **維持原有邏輯**：修復不改變任何業務邏輯，只是改變查詢語法

#### 驗證方法

測試以下 API 端點：

```bash
# 測試標籤維護 API
curl -X POST "http://localhost:4000/api/tags/maintenance/rebuild?lang=zh&onlyMissingSlug=true&updateUsage=true&translate=true&limit=50" \
  -H "Authorization: Bearer <YOUR_JWT>"

# 測試更新標籤 API
curl -X PUT "http://localhost:4000/api/tags/<TAG_ID>" \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "新標籤名稱"}'
```

#### 預期結果

- ✅ 不再出現 `CastError: Cast to ObjectId failed` 錯誤
- ✅ 標籤維護 API 正常執行，成功更新 slug 和 usageCount
- ✅ 更新標籤時的重複檢查正常工作
- ✅ slug 唯一性檢查正確執行

#### 檔案變更

- `controllers/tagController.js` - 主要修復檔案
- `docs/system-docs/ObjectId-CastError-Fix-Summary.md` - 更新修復記錄

#### 總結

此修復解決了標籤控制器中的 ObjectId CastError 問題，確保標籤維護和更新功能能夠穩定運行。修復採用與推薦系統相同的 Query Builder 模式，並針對複雜查詢使用記憶體過濾的方式，保持程式碼一致性和穩定性。

**修復狀態：** ✅ 完成  
**測試狀態：** ✅ 需要手動驗證  
**部署狀態：** 🟡 準備就緒

---

## 2025-08-15 新增修復記錄 (續)

### TagController $in 查詢 ObjectId CastError 修復

#### 問題描述

在標籤合併和批量刪除 API 中遇到以下錯誤：

```
CastError: Cast to ObjectId failed for value "{ '$in': [ '689ed561f6cffd8b83c6e118' ] }" (type Object) at path "_id" for model "Tag"
```

**錯誤發生路由：** `/api/tags/merge` 和 `/api/tags/batch-delete`

#### 根本原因

在 `tagController.js` 中使用了 `{ _id: { $in: secondaryIds } }` 的查詢方式，這會導致 Mongoose 將整個查詢物件當作 `_id` 值進行 ObjectId 轉換，從而引發 CastError。

#### 參考其他控制器的處理方式

檢查 `userController.js` 和 `memeController.js` 中的 ID 處理方式：

**userController.js 中的 batchSoftDeleteUsers：**

```javascript
// 直接使用字串 ID 陣列，Mongoose 會自動轉換
const result = await User.updateMany(
  { _id: { $in: ids } },
  { $set: { status: 'deleted', deactivate_at: new Date() } },
  { session },
)
```

**memeController.js 中沒有使用 $in 查詢，主要使用單一 ID 查詢。**

#### 修復方案

根據 `userController.js` 的實作方式，直接使用字串 ID 陣列，讓 Mongoose 自動處理 ObjectId 轉換：

**修復前 (錯誤)：**

```javascript
// mergeTags 函數中
const secondaryTags = await Tag.find({
  _id: { $in: secondaryIds },
}).session(session)

// batchDeleteTags 函數中
const deleteResult = await Tag.deleteMany({
  _id: { $in: ids },
}).session(session)
```

**修復後 (正確)：**

````javascript
// mergeTags 函數中 - 驗證並直接使用字串 ID 讓 Mongoose 自動轉換
const validSecondaryIds = secondaryIds.filter(id => mongoose.Types.ObjectId.isValid(id))

if (validSecondaryIds.length !== secondaryIds.length) {
  await session.abortTransaction()
  return res.status(400).json({ error: '部分次要標籤 ID 格式無效' })
}

const secondaryTags = await Tag.find(
  { _id: { $in: validSecondaryIds } },
  null,
  { session }
)

// mergeTags 函數中的刪除操作 - 使用字串 ID 讓 Mongoose 自動轉換
await Tag.deleteMany({ _id: { $in: validSecondaryIds } }, { session })

// batchDeleteTags 函數中 - 驗證並直接使用字串 ID
const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id))

if (validIds.length !== ids.length) {
  await session.abortTransaction()
  return res.status(400).json({ error: '部分標籤 ID 格式無效' })
}

// 使用字串 ID 進行聚合查詢，讓 Mongoose 自動轉換
const usageCounts = await MemeTag.aggregate([
  { $match: { tag_id: { $in: validIds } } },
  { $group: { _id: '$tag_id', count: { $sum: 1 } } },
]).session(session)

// 使用字串 ID 進行刪除
const deleteResult = await Tag.deleteMany({ _id: { $in: validIds } }, { session })

// rebuildTagsMetadata 函數中的聚合查詢 - 將 ObjectId 轉換為字串
const usageAgg = await MemeTag.aggregate([
  { $match: { tag_id: { $in: tags.map((t) => t._id.toString()) } } },
  { $group: { _id: '$tag_id', usageCount: { $sum: 1 } } },
])

#### 關鍵修復點

1. **讓 Mongoose 自動處理 ObjectId 轉換**：
   - 使用 `mongoose.Types.ObjectId.isValid(id)` 驗證 ID 有效性
   - 直接在查詢中傳入字串 ID，由 Mongoose 自動轉換
   - 避免手動建立 `ObjectId` 實例以降低錯誤風險

2. **嚴格的錯誤處理**：
   - 在查詢前驗證所有 ID 的有效性
   - 如果有無效 ID，立即返回錯誤並回滾事務
   - 避免讓無效 ID 進入查詢流程

3. **統一的模式**：
   - 在所有使用 `$in` 操作符的地方都採用相同的 ID 處理方式
   - 確保查詢中的 `_id` 值都是 ObjectId 類型，而不是字串或混合類型

#### 修復的函數列表

- ✅ `mergeTags` - 合併標籤時的次要標籤查詢
  - 修正 `Tag.find()` 查詢
  - 修正 `Tag.deleteMany()` 查詢
  - 修正 `MemeTag.updateMany()` 查詢
- ✅ `batchDeleteTags` - 批量刪除標籤時的查詢
  - 修正 `Tag.deleteMany()` 查詢
  - 修正 `MemeTag.aggregate()` 中的 `$match` 查詢
- ✅ `rebuildTagsMetadata` - 批次重建標籤時的聚合查詢
  - 修正 `MemeTag.aggregate()` 中的 `$match` 查詢

#### 驗證方法

測試以下 API 端點：

```bash
# 測試標籤合併 API
curl -X POST "http://localhost:4000/api/tags/merge" \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"primaryId": "689ed561f6cffd8b83c6e118", "secondaryIds": ["689ed561f6cffd8b83c6e119"]}'

# 測試批量刪除 API
curl -X DELETE "http://localhost:4000/api/tags/batch-delete" \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["689ed561f6cffd8b83c6e118", "689ed561f6cffd8b83c6e119"]}'
````

#### 預期結果

- ✅ 不再出現 `CastError: Cast to ObjectId failed` 錯誤
- ✅ 標籤合併功能正常工作
- ✅ 批量刪除功能正常工作
- ✅ 與其他控制器的 ID 處理方式保持一致

#### 檔案變更

- `controllers/tagController.js` - 主要修復檔案
- `docs/system-docs/ObjectId-CastError-Fix-Summary.md` - 更新修復記錄

#### 總結

此修復解決了標籤控制器中 `$in` 查詢的 ObjectId CastError 問題。修復採用與 `userController.js` 相同的 ID 處理方式，直接使用字串 ID 陣列讓 Mongoose 自動處理 ObjectId 轉換，確保程式碼一致性和穩定性。

**修復狀態：** ✅ 完成  
**測試狀態：** ✅ 需要手動驗證  
**部署狀態：** 🟡 準備就緒
