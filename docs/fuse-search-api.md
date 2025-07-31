# Fuse.js 搜尋功能說明

## 概述

我們已經整合了 Fuse.js 來提供更強大的模糊搜尋功能，支援搜尋以下欄位：

- `title` (標題) - 權重 0.8
- `content` (內容) - 權重 0.6
- `detail_markdown` (詳細內容) - 權重 0.4
- `tags_cache` (標籤) - 權重 0.7
- `display_name` (作者顯示名稱) - 權重 0.1
- `username` (作者帳號) - 權重 0.05

## API 端點

### 1. 基本搜尋 (`GET /memes`)

**參數：**

- `search` - 搜尋關鍵字
- `useAdvancedSearch` - 是否使用進階搜尋 (預設: true)
- `page` - 頁碼 (預設: 1)
- `limit` - 每頁數量 (預設: 50)
- `type` - 迷因類型篩選
- `status` - 狀態篩選
- `tags` - 標籤篩選 (逗號分隔)
- `sort` - 排序欄位 (預設: comprehensive)
- `order` - 排序方向 (預設: desc)

**範例：**

```bash
# 使用進階搜尋
GET /memes?search=貓咪&useAdvancedSearch=true

# 使用傳統搜尋
GET /memes?search=貓咪&useAdvancedSearch=false

# 搜尋特定標籤的迷因
GET /memes?tags=搞笑,貓咪&search=可愛

# 自訂每頁數量
GET /memes?limit=100&page=1
```

### 2. 進階標籤搜尋 (`GET /memes/by-tags`)

**參數：**

- `tagIds` - 標籤ID (逗號分隔)
- `search` - 搜尋關鍵字
- `useAdvancedSearch` - 是否使用進階搜尋 (預設: true)
- 其他參數同上

**範例：**

```bash
# 搜尋特定標籤ID的迷因
GET /memes/by-tags?tagIds=507f1f77bcf86cd799439011,507f1f77bcf86cd799439012&search=貓咪
```

## 搜尋功能特點

### 1. 模糊搜尋

- 支援部分匹配和拼寫錯誤
- 不區分大小寫
- 可設定相似度閾值

### 2. 權重系統

- 標題權重最高 (0.8)
- 標籤權重較高 (0.7)
- 內容權重中等 (0.6)
- 詳細內容權重較低 (0.4)
- 作者顯示名稱權重較低 (0.1)
- 作者帳號權重最低 (0.05)

### 3. 搜尋範圍

- **標題**: 迷因標題
- **內容**: 主要內容簡介
- **詳細內容**: detail_markdown 欄位
- **標籤**: tags_cache 欄位
- **作者顯示名稱**: 作者的 display_name 欄位
- **作者帳號**: 作者的 username 欄位

### 4. 結果排序

- 按搜尋相關性分數排序
- 分數越低表示越相關
- 支援分頁功能

## 使用建議

### 1. 效能考量

- 模糊搜尋會載入所有符合基本條件的資料到記憶體
- 建議在資料量較小時使用
- 大量資料時建議使用傳統搜尋

### 2. 搜尋策略

- 短關鍵字：使用模糊搜尋
- 精確搜尋：使用傳統搜尋
- 複雜條件：結合使用

### 3. 前端整合

```javascript
// 前端搜尋範例
const searchMemes = async (searchTerm) => {
  const response = await fetch(`/memes?search=${searchTerm}&useAdvancedSearch=true`)
  const data = await response.json()

  // 結果包含搜尋分數
  data.memes.forEach((meme) => {
    console.log(`標題: ${meme.title}, 相關性分數: ${meme.searchScore}`)
  })
}
```

## 回應格式

### 成功回應

```json
{
  "memes": [
    {
      "_id": "meme_id",
      "title": "迷因標題",
      "content": "迷因內容",
      "detail_markdown": "詳細內容",
      "tags_cache": ["標籤1", "標籤2"],
      "searchScore": 0.1, // 搜尋相關性分數 (僅模糊搜尋時)
      "searchMatches": [...], // 匹配資訊 (僅模糊搜尋時)
      "author": {
        "_id": "user_id",
        "username": "用戶名",
        "avatar": "頭像URL"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "search": "搜尋關鍵字",
    "tags": ["標籤1", "標籤2"],
    "type": "image",
    "status": "public"
  }
}
```

## 錯誤處理

### 400 Bad Request

```json
{
  "error": "請提供標籤ID參數"
}
```

### 500 Internal Server Error

```json
{
  "error": "伺服器錯誤訊息"
}
```
