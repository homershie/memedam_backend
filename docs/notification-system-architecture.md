# 通知系統架構文檔

## 概述

本通知系統採用事件/收件狀態分離模型，將通知事件（Notification）和收件狀態（NotificationReceipt）分離，實現更好的資料管理、審計追蹤和用戶體驗。

## 架構設計

### 核心概念

1. **通知事件（Notification）**：記錄系統中發生的各種事件，如按讚、評論、追蹤等
2. **收件狀態（NotificationReceipt）**：記錄每位用戶對特定通知事件的接收狀態
3. **軟刪除**：用戶刪除通知時只標記收件狀態為已刪除，保留事件資料
4. **硬刪除**：管理員可以完全刪除通知事件和相關收件狀態

### 資料模型

#### 通知事件（notifications）

```javascript
{
  _id: ObjectId,
  actorId: ObjectId,        // 觸發者ID
  verb: String,             // 動作類型：follow, like, comment, mention, system, announcement
  objectType: String,       // 物件類型：post, comment, user, meme, collection
  objectId: ObjectId,       // 物件ID
  payload: Object,          // 額外資料
  title: String,            // 系統通知標題
  content: String,          // 系統通知內容
  url: String,              // 點擊跳轉連結
  actionText: String,       // 操作按鈕文字
  expireAt: Date,           // 過期時間
  createdAt: Date,
  updatedAt: Date
}
```

#### 收件狀態（notification_receipts）

```javascript
{
  _id: ObjectId,
  notificationId: ObjectId, // 對應的通知事件ID
  userId: ObjectId,         // 收件者ID
  readAt: Date,             // 已讀時間
  deletedAt: Date,          // 使用者刪除時間（軟刪）
  archivedAt: Date,         // 封存時間
  createdAt: Date,
  updatedAt: Date
}
```

### 索引設計

```javascript
// 通知事件索引
{ actorId: 1, verb: 1, objectType: 1, objectId: 1 }
{ createdAt: -1 }

// 收件狀態索引
{ userId: 1, deletedAt: 1, createdAt: -1 }  // 主要查詢索引
{ notificationId: 1, userId: 1 }            // 唯一約束
{ userId: 1, readAt: 1 }                    // 未讀查詢
{ userId: 1, archivedAt: 1 }                // 封存查詢
```

## API 設計

### 使用者端 API

#### 取得通知列表

```
GET /api/notifications
Query Parameters:
- page: 頁碼（預設1）
- limit: 每頁數量（預設20）
- verb: 篩選動作類型
- unread: 只顯示未讀通知
- archived: 篩選封存狀態

Response:
{
  success: true,
  data: [NotificationWithEvent],
  unreadCount: number,
  pagination: { page, limit, total, pages }
}
```

#### 取得單一通知

```
GET /api/notifications/:receiptId
Response: NotificationWithEvent
```

#### 更新通知狀態

```
PATCH /api/notifications/:receiptId
Body: { read?: boolean, archived?: boolean }
Response: NotificationWithEvent
```

#### 軟刪除通知

```
DELETE /api/notifications/:receiptId
Response: 204 No Content
```

#### 標記為已讀

```
PATCH /api/notifications/:receiptId/read
Response: NotificationWithEvent
```

#### 標記全部已讀

```
PATCH /api/notifications/read/all
Response: { updatedCount: number }
```

#### 批次刪除

```
DELETE /api/notifications
Body: { ids?: string[], olderThan?: Date, unreadOnly?: boolean }
Response: { deletedCount: number }
```

#### 取得未讀數量

```
GET /api/notifications/unread/count
Response: { unreadCount: number }
```

### 管理員端 API

#### 建立通知事件

```
POST /api/notifications/admin
Body: CreateNotificationRequest
Response: NotificationEvent
```

#### 硬刪除通知事件

```
DELETE /api/notifications/admin/:notificationId?hard=true
Response: { message: string, deletedReceipts: number }
```

#### 清理孤兒收件狀態

```
POST /api/notifications/admin/cleanup-orphans
Response: { message: string, deletedCount: number }
```

#### 清理過期收件狀態

```
POST /api/notifications/admin/cleanup-expired
Response: { message: string, deletedCount: number }
```

## 服務層

### NotificationService

提供高級通知操作：

- `createNotificationEvent()`: 創建通知事件並建立收件狀態
- `addReceiptsToNotification()`: 為現有通知添加新收件者
- `createBulkNotification()`: 批量創建通知
- `createInteractionNotification()`: 處理用戶互動通知
- `cleanupExpiredNotifications()`: 清理過期通知
- `getNotificationStats()`: 獲取通知統計
- `getNotificationTypeStats()`: 獲取類型統計

### NotificationUtils

提供底層工具函數：

- `getUserReceiptQuery()`: 建構用戶查詢條件
- `getBatchDeleteQuery()`: 建構批次刪除條件
- `ensureReceiptOwner()`: 確保收件狀態所有權
- `softDeleteReceipt()`: 軟刪除收件狀態
- `markReceiptRead()`: 標記已讀狀態
- `markReceiptArchived()`: 標記封存狀態
- `batchSoftDeleteReceipts()`: 批次軟刪除
- `getUnreadReceiptCount()`: 取得未讀數量
- `cleanupOrphanReceipts()`: 清理孤兒收件狀態
- `cleanupExpiredDeletedReceipts()`: 清理過期已刪除收件狀態

## 安全設計

### 權限控制

1. **使用者權限**：只能操作自己的收件狀態
2. **管理員權限**：可以創建、硬刪除通知事件
3. **所有權驗證**：所有操作都驗證收件狀態所有權

### 錯誤處理

1. **404 錯誤**：通知不存在或非擁有者（降低 ID 探測）
2. **403 錯誤**：權限不足
3. **400 錯誤**：請求參數錯誤
4. **冪等操作**：重複刪除/更新不報錯

### 資料一致性

1. **事務處理**：重要操作使用 MongoDB 事務
2. **索引優化**：確保查詢效能
3. **軟刪除**：保留審計資料
4. **定期清理**：自動清理過期資料

## 效能優化

### 查詢優化

1. **複合索引**：`{ userId: 1, deletedAt: 1, createdAt: -1 }`
2. **分頁查詢**：支援游標分頁
3. **條件篩選**：支援多種篩選條件
4. **關聯查詢**：使用 populate 減少查詢次數

### 資料清理

1. **定期清理**：90天後清理通知事件
2. **軟刪除清理**：30天後清理已刪除收件狀態
3. **孤兒清理**：清理無對應通知事件的收件狀態

## 使用範例

### 創建按讚通知

```javascript
import { createInteractionNotification } from '../services/notificationService.js'

const result = await createInteractionNotification({
  actorId: userId,
  verb: 'like',
  objectType: 'meme',
  objectId: memeId,
  recipientId: memeOwnerId,
  payload: { memeTitle: '有趣的迷因' },
})
```

### 創建系統公告

```javascript
import { createBulkNotification } from '../services/notificationService.js'

const result = await createBulkNotification(
  {
    actorId: systemUserId,
    verb: 'system',
    objectType: 'announcement',
    objectId: announcementId,
    title: '系統維護通知',
    content: '系統將於今晚進行維護',
  },
  {
    allUsers: true,
  },
)
```

### 用戶操作通知

```javascript
// 取得通知列表
const response = await fetch('/api/notifications?page=1&limit=20', {
  headers: { Authorization: `Bearer ${token}` },
})

// 標記為已讀
await fetch(`/api/notifications/${receiptId}/read`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}` },
})

// 軟刪除通知
await fetch(`/api/notifications/${receiptId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` },
})
```

## 測試策略

### 單元測試

- 控制器功能測試
- 服務層邏輯測試
- 工具函數測試
- 模型驗證測試

### 整合測試

- API 端點測試
- 資料庫操作測試
- 權限驗證測試
- 錯誤處理測試

### 效能測試

- 大量資料查詢測試
- 索引效能測試
- 並發操作測試

## 部署注意事項

### 資料庫遷移

1. 創建新的集合：`notifications`, `notification_receipts`
2. 建立必要的索引
3. 設定定期清理任務

### 環境配置

1. 設定 MongoDB 連接
2. 配置 JWT 密鑰
3. 設定日誌級別

### 監控

1. 監控通知創建頻率
2. 監控查詢效能
3. 監控資料庫大小
4. 監控錯誤率

## 未來擴展

### 功能擴展

1. **推送通知**：整合 FCM/APNS
2. **郵件通知**：整合 SMTP 服務
3. **通知模板**：支援多語言模板
4. **通知偏好**：用戶自定義通知設定

### 效能擴展

1. **快取層**：Redis 快取熱門通知
2. **非同步處理**：使用消息佇列
3. **分片策略**：按用戶分片資料
4. **CDN 整合**：靜態資源加速

### 分析擴展

1. **通知分析**：點擊率、轉換率
2. **用戶行為**：通知偏好分析
3. **效能監控**：響應時間、吞吐量
4. **A/B 測試**：通知內容測試
