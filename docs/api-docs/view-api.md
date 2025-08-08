# 瀏覽統計 API 使用說明

## 概述

本系統提供了完整的瀏覽次數統計功能，包括記錄瀏覽、防刷機制、統計分析等功能。

## API 端點

### 1. 記錄瀏覽

```http
POST /views/:meme_id
Content-Type: application/json
```

**請求參數：**

| 參數       | 類型   | 必填 | 說明               |
| ---------- | ------ | ---- | ------------------ |
| `duration` | number | 否   | 瀏覽時間長度（秒） |
| `referrer` | string | 否   | 來源網址           |

**請求範例：**

```json
{
  "duration": 30,
  "referrer": "https://www.google.com"
}
```

**回應格式：**

```json
{
  "success": true,
  "data": {
    "view": {
      "_id": "...",
      "meme_id": "...",
      "user_id": "...",
      "ip": "192.168.1.1",
      "user_agent": "...",
      "platform_detail": "web",
      "referrer": "https://www.google.com",
      "duration": 30,
      "is_duplicate": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "isDuplicate": false,
    "message": "瀏覽記錄已保存"
  },
  "error": null
}
```

**防刷機制：**

- 同一用戶/IP 在 5 分鐘內重複瀏覽同一迷因不會計入統計
- 重複瀏覽會記錄但標記為 `is_duplicate: true`

### 2. 取得迷因瀏覽統計

```http
GET /views/stats/:meme_id?period=all
```

**查詢參數：**

| 參數     | 類型   | 預設值 | 說明                                    |
| -------- | ------ | ------ | --------------------------------------- |
| `period` | string | `all`  | 統計期間：`all`, `day`, `week`, `month` |

**回應格式：**

```json
{
  "success": true,
  "data": {
    "total_views": 150,
    "unique_users": 45,
    "avg_duration": 25.5,
    "total_duration": 3825,
    "duplicate_views": 12,
    "effective_views": 138
  },
  "error": null
}
```

### 3. 取得用戶瀏覽歷史

```http
GET /views/history?page=1&limit=20
Authorization: Bearer <token>
```

**查詢參數：**

| 參數    | 類型   | 預設值 | 說明     |
| ------- | ------ | ------ | -------- |
| `page`  | number | `1`    | 頁碼     |
| `limit` | number | `20`   | 每頁數量 |

**回應格式：**

```json
{
  "success": true,
  "data": {
    "views": [
      {
        "_id": "...",
        "meme_id": {
          "_id": "...",
          "title": "迷因標題",
          "image_url": "...",
          "type": "image"
        },
        "duration": 30,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "error": null
}
```

### 4. 取得熱門迷因

```http
GET /views/popular?page=1&limit=20&period=all
```

**查詢參數：**

| 參數     | 類型   | 預設值 | 說明                                    |
| -------- | ------ | ------ | --------------------------------------- |
| `page`   | number | `1`    | 頁碼                                    |
| `limit`  | number | `20`   | 每頁數量                                |
| `period` | string | `all`  | 統計期間：`all`, `day`, `week`, `month` |

**回應格式：**

```json
{
  "success": true,
  "data": {
    "memes": [
      {
        "_id": "...",
        "title": "迷因標題",
        "content": "內容",
        "image_url": "...",
        "type": "image",
        "status": "public",
        "view_count": 150,
        "unique_viewers": 45,
        "avg_duration": 25.5,
        "author": {
          "_id": "...",
          "username": "user123",
          "display_name": "顯示名稱",
          "avatar": "..."
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
    "period": "all"
  },
  "error": null
}
```

### 5. 清理過期瀏覽記錄（管理員功能）

```http
DELETE /views/cleanup?days=90
Authorization: Bearer <admin_token>
```

**查詢參數：**

| 參數   | 類型   | 預設值 | 說明     |
| ------ | ------ | ------ | -------- |
| `days` | number | `90`   | 保留天數 |

**回應格式：**

```json
{
  "success": true,
  "data": {
    "deleted_count": 1500,
    "cutoff_date": "2024-01-01T00:00:00.000Z",
    "message": "已清理 1500 條過期瀏覽記錄"
  },
  "error": null
}
```

## 前端整合範例

### 1. 記錄瀏覽

```javascript
// 在迷因詳情頁面載入時記錄瀏覽
const recordView = async (memeId, duration = 0) => {
  try {
    const response = await fetch(`/api/views/${memeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        duration,
        referrer: document.referrer,
      }),
    })

    const data = await response.json()
    console.log('瀏覽記錄:', data.message)
  } catch (error) {
    console.error('記錄瀏覽失敗:', error)
  }
}

// 使用範例
recordView('meme_id_here', 30)
```

### 2. 取得瀏覽統計

```javascript
const getViewStats = async (memeId, period = 'all') => {
  try {
    const response = await fetch(`/api/views/stats/${memeId}?period=${period}`)
    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('取得瀏覽統計失敗:', error)
    return null
  }
}

// 使用範例
const stats = await getViewStats('meme_id_here', 'week')
console.log('本週瀏覽數:', stats.effective_views)
```

### 3. 取得熱門迷因

```javascript
const getPopularMemes = async (page = 1, limit = 20, period = 'all') => {
  try {
    const response = await fetch(`/api/views/popular?page=${page}&limit=${limit}&period=${period}`)
    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('取得熱門迷因失敗:', error)
    return null
  }
}

// 使用範例
const popularData = await getPopularMemes(1, 10, 'week')
console.log('本週熱門迷因:', popularData.memes)
```

## 資料庫索引

系統已建立以下索引以優化查詢效能：

```javascript
// 防止重複瀏覽
db.views.createIndex({ meme_id: 1, user_id: 1, ip: 1 })

// 統計查詢
db.views.createIndex({ meme_id: 1, createdAt: -1 })
db.views.createIndex({ user_id: 1, createdAt: -1 })

// 熱門查詢
db.views.createIndex({ is_duplicate: 1, createdAt: -1 })
```

## 注意事項

1. **防刷機制**：同一用戶/IP 在 5 分鐘內重複瀏覽不會計入統計
2. **效能考量**：大量瀏覽記錄會影響查詢效能，建議定期清理
3. **隱私保護**：IP 和 User Agent 僅用於防刷，不會外洩
4. **統計準確性**：`effective_views` 為扣除重複瀏覽後的實際瀏覽數

## 管理功能

### 定期清理任務

建議設定定期任務清理過期瀏覽記錄：

```bash
# 每週清理 90 天前的記錄
curl -X DELETE "http://localhost:3000/api/views/cleanup?days=90" \
     -H "Authorization: Bearer <admin_token>"
```

### 監控建議

- 監控瀏覽記錄增長速度
- 監控重複瀏覽比例
- 監控查詢效能
- 設定資料庫空間告警

---

_本文檔最後更新：2024年12月_
