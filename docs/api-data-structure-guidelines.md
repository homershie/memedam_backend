# API 資料結構開發規範

## 作者資訊處理標準

### 🔴 問題背景

在開發過程中發現不同 API 端點返回的作者資訊欄位名稱不一致，導致前端無法正確顯示用戶頭像和資訊。

### ✅ 標準規範

#### 1. 前端期望的資料結構

```javascript
{
  _id: "...",
  title: "...",
  // ... 其他迷因資料
  author: {                    // ← 統一使用 author 欄位
    _id: "...",
    username: "user123",
    display_name: "顯示名稱",
    avatar: "https://example.com/avatar.jpg"
  },
  author_id: "..."             // ← 保留原始 ID 供後端關聯使用
}
```

#### 2. Mongoose populate 處理方式

```javascript
// ❌ 錯誤：直接 populate 會產生 author_id 欄位
const memes = await Meme.find(filter).populate('author_id', 'username display_name avatar')

// ✅ 正確：需要轉換資料結構
const memesData = await Meme.find(filter).populate('author_id', 'username display_name avatar')

const memes = memesData.map((meme) => {
  const memeObj = meme.toObject()
  return {
    ...memeObj,
    author: memeObj.author_id, // 將 author_id 複製為 author
    author_id: memeObj.author_id?._id, // 保留原始 ID
  }
})
```

#### 3. MongoDB 聚合管道處理方式

```javascript
// ✅ 正確：在 $project 階段直接定義 author 欄位
{
  $project: {
    _id: '$meme._id',
    title: '$meme.title',
    // ... 其他欄位
    author: {                        // ← 使用 author 而非 author_id
      _id: '$author._id',
      username: '$author.username',
      display_name: '$author.display_name',
      avatar: '$author.avatar',
    },
    author_id: '$meme.author_id',    // ← 保留原始關聯 ID
  }
}
```

#### 4. 模糊搜尋資料扁平化處理

```javascript
// ✅ 正確：同時轉換結構和扁平化
const memesWithFlattenedAuthor = allMemesData.map((meme) => ({
  ...meme,
  author: meme.author_id, // 轉換結構
  author_id: meme.author_id?._id, // 保留原始 ID
  username: meme.author_id?.username || '', // 扁平化供 Fuse.js 搜尋
  display_name: meme.author_id?.display_name || '',
}))
```

### 📋 檢查清單

在開發新的 API 端點時，請確認：

- [ ] 所有返回迷因資料的 API 都包含 `author` 欄位（而非 `author_id`）
- [ ] `author` 欄位包含：`_id`, `username`, `display_name`, `avatar`
- [ ] 保留 `author_id` 欄位作為原始關聯 ID
- [ ] 前端可以安全使用 `meme.author?.avatar` 訪問頭像
- [ ] 前端可以安全使用 `meme.author?.display_name || meme.author?.username` 訪問顯示名稱

### 🎯 適用的 API 端點

- `GET /memes` - 取得迷因列表
- `GET /memes/by-tags` - 標籤篩選迷因
- `GET /memes/:id` - 取得單一迷因
- 所有其他返回迷因資料的端點

### 💡 前端使用範例

```vue
<template>
  <Avatar :image="meme.author?.avatar" :icon="!meme.author?.avatar ? 'pi pi-user' : undefined" />
  <span>
    {{ meme.author?.display_name || meme.author?.username || '匿名用戶' }}
  </span>
</template>
```

### ⚠️ 常見錯誤

1. **直接使用 populate 結果**：會產生 `author_id` 欄位而非 `author`
2. **聚合管道中遺漏轉換**：忘記在 `$project` 中重新命名欄位
3. **缺少 null 安全檢查**：前端沒有使用可選鏈操作符 `?.`

---

_最後更新：2024-12-19_  
_相關問題：用戶頭像失效、作者資訊無法顯示_
