# 檢舉系統 API 文檔

## 概述

檢舉系統提供完整的內容檢舉功能，包括檢舉提交、處理、通知和統計等功能。系統支援多種檢舉目標類型（迷因、留言、用戶）和多種處理方式。

## 認證

所有 API 端點都需要 JWT 認證，請在請求標頭中包含：

```
Authorization: Bearer <your-jwt-token>
```

## API 端點

### 1. 建立檢舉

**POST** `/api/reports`

建立新的檢舉記錄。

#### 請求參數

```json
{
  "target_type": "meme", // 必填：檢舉目標類型 (meme|comment|user)
  "target_id": "507f1f77bcf86cd799439011", // 必填：檢舉目標ID
  "reason": "inappropriate", // 必填：檢舉原因
  "description": "這個內容不當" // 可選：詳細描述
}
```

#### 檢舉原因選項

- `inappropriate` - 不當內容
- `hate_speech` - 仇恨言論
- `spam` - 垃圾訊息
- `copyright` - 版權問題
- `other` - 其他

#### 回應範例

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "reporter_id": "507f1f77bcf86cd799439013",
    "target_type": "meme",
    "target_id": "507f1f77bcf86cd799439011",
    "reason": "inappropriate",
    "description": "這個內容不當",
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "error": null
}
```

#### 錯誤回應

- `400` - 請求參數錯誤
- `401` - 未授權
- `404` - 檢舉目標不存在
- `409` - 已檢舉過此內容
- `429` - 檢舉頻率過高

### 2. 取得用戶檢舉列表

**GET** `/api/reports/my`

取得當前用戶的檢舉歷史。

#### 查詢參數

- `page` - 頁碼（預設：1）
- `limit` - 每頁數量（預設：10）
- `status` - 篩選狀態（pending|processed|rejected）
- `sort` - 排序欄位（預設：createdAt）
- `order` - 排序方向（asc|desc，預設：desc）

#### 回應範例

```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "target_type": "meme",
        "target_id": "507f1f77bcf86cd799439011",
        "reason": "inappropriate",
        "status": "processed",
        "action": "warn_author",
        "admin_comment": "內容已警告處理",
        "processed_at": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  },
  "error": null
}
```

### 3. 取得檢舉列表（管理員）

**GET** `/api/reports`

取得所有檢舉列表，僅管理員可存取。

#### 查詢參數

- `page` - 頁碼（預設：1）
- `limit` - 每頁數量（預設：10）
- `status` - 篩選狀態
- `reason` - 篩選檢舉原因
- `target_type` - 篩選目標類型
- `groupBy` - 群組化查詢（target|none，預設：target）
- `sort` - 排序欄位
- `order` - 排序方向

#### 群組化查詢回應

```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "_id": {
          "target_type": "meme",
          "target_id": "507f1f77bcf86cd799439011"
        },
        "reports": [...],
        "total_reports": 3,
        "reasons": ["inappropriate", "spam"],
        "latest_report": "2024-01-01T00:00:00.000Z",
        "statuses": ["pending", "processed"]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 4. 取得檢舉詳情

**GET** `/api/reports/:id`

取得單一檢舉的詳細資訊。

#### 回應範例

```json
{
  "success": true,
  "data": {
    "report": {
      "_id": "507f1f77bcf86cd799439012",
      "reporter_id": {
        "_id": "507f1f77bcf86cd799439013",
        "username": "user123",
        "avatar": "https://example.com/avatar.jpg"
      },
      "target_type": "meme",
      "target_id": "507f1f77bcf86cd799439011",
      "reason": "inappropriate",
      "description": "這個內容不當",
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "relatedReports": [
      // 同目標的其他檢舉（僅管理員可見）
    ]
  },
  "error": null
}
```

### 5. 處理檢舉（管理員）

**PUT** `/api/reports/:id/resolve`

處理單一檢舉，僅管理員可存取。

#### 請求參數

```json
{
  "status": "processed", // 必填：處理狀態 (pending|processed|rejected)
  "action": "warn_author", // 可選：處理方式
  "action_meta": {}, // 可選：處理方式詳細資訊
  "admin_comment": "處理備註" // 可選：管理員備註
}
```

#### 處理方式選項

- `none` - 無動作
- `remove_content` - 刪除內容
- `soft_hide` - 軟隱藏
- `age_gate` - 年齡限制
- `mark_nsfw` - 標記為成人內容
- `lock_comments` - 鎖定留言
- `issue_strike` - 記違規點數
- `warn_author` - 警告作者

#### 回應範例

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "status": "processed",
    "action": "warn_author",
    "admin_comment": "內容已警告處理",
    "processed_at": "2024-01-01T00:00:00.000Z",
    "handler_id": "507f1f77bcf86cd799439014"
  },
  "error": null
}
```

### 6. 批次處理檢舉（管理員）

**PUT** `/api/reports/batch/resolve`

批次處理多個檢舉，僅管理員可存取。

#### 請求參數

```json
{
  "ids": [
    // 必填：要處理的檢舉ID列表
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ],
  "status": "processed", // 必填：處理狀態
  "action": "remove_content", // 可選：處理方式
  "action_meta": {}, // 可選：處理方式詳細資訊
  "admin_comment": "批次處理完成" // 可選：管理員備註
}
```

#### 回應範例

```json
{
  "success": true,
  "data": {
    "updatedCount": 2,
    "totalCount": 2
  },
  "error": null
}
```

### 7. 取得檢舉統計（管理員）

**GET** `/api/reports/stats`

取得檢舉統計資料，僅管理員可存取。

#### 查詢參數

- `period` - 統計期間（1d|7d|30d，預設：7d）

#### 回應範例

```json
{
  "success": true,
  "data": {
    "period": "7d",
    "totalReports": 100,
    "pendingReports": 20,
    "processedReports": 60,
    "rejectedReports": 20,
    "reasonStats": [
      {
        "_id": "inappropriate",
        "count": 50
      },
      {
        "_id": "spam",
        "count": 30
      }
    ],
    "targetTypeStats": [
      {
        "_id": "meme",
        "count": 80
      },
      {
        "_id": "comment",
        "count": 20
      }
    ]
  },
  "error": null
}
```

### 8. 取得檢舉選項

**GET** `/api/reports/options`

取得檢舉系統的選項配置。

#### 回應範例

```json
{
  "success": true,
  "data": {
    "reasons": [
      { "value": "inappropriate", "label": "不當內容" },
      { "value": "hate_speech", "label": "仇恨言論" },
      { "value": "spam", "label": "垃圾訊息" },
      { "value": "copyright", "label": "版權問題" },
      { "value": "other", "label": "其他" }
    ],
    "statuses": [
      { "value": "pending", "label": "待處理" },
      { "value": "processed", "label": "已處理" },
      { "value": "rejected", "label": "已駁回" }
    ],
    "actions": [
      { "value": "none", "label": "無動作" },
      { "value": "remove_content", "label": "刪除內容" },
      { "value": "soft_hide", "label": "軟隱藏" },
      { "value": "age_gate", "label": "年齡限制" },
      { "value": "mark_nsfw", "label": "標記為成人內容" },
      { "value": "lock_comments", "label": "鎖定留言" },
      { "value": "issue_strike", "label": "記違規點數" },
      { "value": "warn_author", "label": "警告作者" }
    ]
  },
  "error": null
}
```

### 9. 刪除檢舉（管理員）

**DELETE** `/api/reports/:id`

刪除檢舉記錄，僅管理員可存取。

#### 回應範例

```json
{
  "success": true,
  "data": {
    "message": "檢舉已刪除"
  },
  "error": null
}
```

## 速率限制

檢舉系統實施以下速率限制：

- **24小時限制**：每個用戶24小時內最多可提交5次檢舉
- **7日限制**：每個用戶7日內最多可提交20次檢舉
- **品質限制**：有效率低於10%會收到警告，低於5%且累計40筆以上會被暫停檢舉功能7天

## 通知系統

檢舉系統會自動發送以下通知：

1. **檢舉提交通知** - 檢舉提交成功時發送給檢舉者
2. **檢舉處理通知** - 檢舉被處理時發送給檢舉者
3. **作者警告通知** - 內容被警告時發送給作者
4. **內容處理通知** - 內容被刪除/隱藏時發送給作者

## 錯誤代碼

| 狀態碼 | 說明         |
| ------ | ------------ |
| 400    | 請求參數錯誤 |
| 401    | 未授權       |
| 403    | 權限不足     |
| 404    | 資源不存在   |
| 409    | 重複檢舉     |
| 429    | 速率限制     |

## 範例使用

### JavaScript 範例

```javascript
// 提交檢舉
const response = await fetch('/api/reports', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    target_type: 'meme',
    target_id: '507f1f77bcf86cd799439011',
    reason: 'inappropriate',
    description: '這個迷因內容不當',
  }),
})

const result = await response.json()
console.log(result)
```

### cURL 範例

```bash
# 提交檢舉
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "target_type": "meme",
    "target_id": "507f1f77bcf86cd799439011",
    "reason": "inappropriate",
    "description": "這個迷因內容不當"
  }'

# 取得用戶檢舉列表
curl -X GET "http://localhost:3000/api/reports/my?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
