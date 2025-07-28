# 標籤篩選 API 使用說明

## 概述

後端已實現兩種標籤篩選功能：

1. **基本標籤篩選**：使用迷因的 `tags_cache` 欄位進行快速篩選
2. **進階標籤篩選**：使用 `MemeTag` 關聯表進行精確篩選

## API 端點

### 1. 基本標籤篩選

**端點**：`GET /memes`

**功能**：支援多種篩選條件，包括標籤名稱篩選

**查詢參數**：

- `tags`：標籤名稱（支援逗號分隔多個標籤）
- `search`：搜尋關鍵字（標題或內容）
- `type`：迷因類型（text, image, video, audio）
- `status`：迷因狀態
- `page`：頁碼（預設：1）
- `limit`：每頁數量（預設：20）
- `sort`：排序欄位（預設：createdAt）
- `order`：排序方向（asc, desc，預設：desc）

**範例請求**：

```
GET /memes?tags=搞笑,貓咪&search=可愛&page=1&limit=10
```

**回應格式**：

```json
{
  "memes": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "search": "可愛",
    "tags": ["搞笑", "貓咪"],
    "type": null,
    "status": null
  }
}
```

### 2. 進階標籤篩選

**端點**：`GET /memes/by-tags`

**功能**：使用標籤ID進行精確篩選，支援複雜的聚合查詢

**查詢參數**：

- `tagIds`：標籤ID（支援逗號分隔多個ID）
- `search`：搜尋關鍵字（標題或內容）
- `type`：迷因類型
- `status`：迷因狀態
- `page`：頁碼（預設：1）
- `limit`：每頁數量（預設：20）
- `sort`：排序欄位（預設：createdAt）
- `order`：排序方向（asc, desc，預設：desc）

**範例請求**：

```
GET /memes/by-tags?tagIds=507f1f77bcf86cd799439011,507f1f77bcf86cd799439012&search=貓咪&page=1&limit=10
```

**回應格式**：

```json
{
  "memes": [
    {
      "_id": "...",
      "title": "可愛的貓咪",
      "content": "超可愛的貓咪迷因",
      "type": "image",
      "image_url": "...",
      "status": "published",
      "views": 100,
      "like_count": 50,
      "comment_count": 10,
      "tags_cache": ["搞笑", "貓咪"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "author": {
        "_id": "...",
        "username": "user123",
        "avatar": "..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "search": "貓咪",
    "tagIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "type": null,
    "status": null
  }
}
```

## 使用建議

### 何時使用基本篩選？

- 需要快速篩選時
- 標籤數量較少時
- 對效能要求較高時

### 何時使用進階篩選？

- 需要精確的標籤關聯查詢時
- 需要複雜的聚合查詢時
- 需要確保資料一致性時

## 效能考量

1. **基本篩選**：使用 `tags_cache` 欄位，查詢速度快
2. **進階篩選**：使用聚合管道，支援複雜查詢但效能較低
3. **建議**：對於簡單的標籤篩選，優先使用基本篩選

## 錯誤處理

- 無效的標籤ID會返回 400 錯誤
- 查詢參數格式錯誤會返回 400 錯誤
- 伺服器錯誤會返回 500 錯誤

## 注意事項

1. 標籤名稱篩選不區分大小寫
2. 搜尋關鍵字支援模糊匹配
3. 分頁參數必須為正整數
4. 排序欄位必須是迷因模型的實際欄位
