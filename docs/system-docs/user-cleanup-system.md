# 用戶清理系統

## 概述

用戶清理系統是一個自動化的功能，用於管理未驗證 email 的用戶帳號。系統會自動刪除註冊超過一年但未驗證 email 的用戶，並在刪除前一個月發送提醒通知。

## 功能特點

### 1. 自動提醒機制

- **觸發條件**: 用戶註冊超過 11 個月但未驗證 email
- **執行時間**: 每天凌晨 2 點
- **提醒內容**: 發送 email 提醒用戶驗證 email，否則帳號將被刪除

### 2. 自動刪除機制

- **觸發條件**: 用戶註冊超過 1 年但未驗證 email
- **執行時間**: 每天凌晨 3 點
- **刪除方式**: 軟刪除（標記為 `deleted` 狀態）

### 3. 管理員手動控制

- 提供 API 端點供管理員手動執行清理任務
- 提供統計資訊查看功能

## 技術實現

### 核心文件

1. **`utils/userCleanupScheduler.js`**
   - 主要的排程任務實現
   - 包含自動提醒和刪除邏輯
   - 提供手動執行功能

2. **`controllers/userController.js`**
   - 新增三個管理員專用 API 端點
   - 提供手動執行和統計功能

3. **`routes/userRoutes.js`**
   - 新增管理員專用路由
   - 包含完整的 Swagger 文檔

### 主要函數

#### 自動化函數

- `getUsersNeedingReminder()`: 獲取需要發送提醒的用戶
- `getUsersToDelete()`: 獲取需要刪除的用戶
- `sendDeletionReminderEmail()`: 發送刪除提醒 email
- `sendDeletionNotificationEmail()`: 發送刪除通知 email
- `deleteUserAccount()`: 刪除用戶帳號

#### 排程任務

- `sendDeletionReminders()`: 發送刪除提醒任務
- `deleteUnverifiedUsers()`: 刪除未驗證用戶任務

#### 管理員 API

- `sendDeletionReminders()`: 手動執行刪除提醒
- `deleteUnverifiedUsers()`: 手動執行刪除未驗證用戶
- `getUnverifiedUsersStats()`: 獲取未驗證用戶統計

## API 端點

### 管理員專用端點

#### 1. 手動執行刪除提醒

```
POST /api/users/admin/send-deletion-reminders
```

- **權限**: 管理員
- **功能**: 手動發送提醒 email 給註冊超過 11 個月但未驗證的用戶

#### 2. 手動執行刪除未驗證用戶

```
POST /api/users/admin/delete-unverified-users
```

- **權限**: 管理員
- **功能**: 手動刪除註冊超過 1 年但未驗證的用戶

#### 3. 獲取未驗證用戶統計

```
GET /api/users/admin/unverified-stats
```

- **權限**: 管理員
- **功能**: 獲取未驗證用戶的統計資訊

**回應格式**:

```json
{
  "success": true,
  "data": {
    "totalUnverified": 150,
    "usersNeedingReminder": 25,
    "usersToDelete": 10,
    "nextReminderDate": "2024-01-15T02:00:00.000Z",
    "nextDeletionDate": "2024-01-15T03:00:00.000Z"
  }
}
```

## Email 模板

### 刪除提醒 Email

- **主旨**: "MemeDam - 重要提醒：您的帳號即將被刪除"
- **內容**: 提醒用戶驗證 email，否則帳號將在指定日期被刪除
- **按鈕**: 提供直接驗證 email 的連結

### 刪除通知 Email

- **主旨**: "MemeDam - 您的帳號已被刪除"
- **內容**: 通知用戶帳號已被刪除，並說明刪除原因
- **建議**: 提供重新註冊的指引

## 配置設定

### 時間設定

- **提醒時間**: 註冊後 11 個月
- **刪除時間**: 註冊後 12 個月
- **執行時間**: 每天凌晨 2 點（提醒）、3 點（刪除）

### 環境變數

- `FRONTEND_URL`: 前端 URL，用於生成驗證連結
- `MONGODB_URI`: 資料庫連接字串

## 安全考量

### 1. 權限控制

- 所有管理員 API 都需要管理員權限
- 使用 JWT token 驗證

### 2. 軟刪除

- 不直接從資料庫刪除用戶記錄
- 標記為 `deleted` 狀態，保留資料完整性

### 3. 日誌記錄

- 所有操作都有詳細的日誌記錄
- 包含成功和失敗的統計資訊

### 4. 錯誤處理

- 完善的錯誤處理機制
- 單個用戶處理失敗不影響其他用戶

## 測試

### 測試文件

- `test/user-cleanup-tests/user-cleanup-test.js`
- 包含完整的功能測試

### 測試內容

1. 獲取需要提醒的用戶
2. 獲取需要刪除的用戶
3. 手動執行刪除提醒任務
4. 手動執行刪除未驗證用戶任務
5. 創建和驗證測試用戶
6. 統計資訊測試
7. Email 發送功能測試

### 執行測試

```bash
node test/user-cleanup-tests/user-cleanup-test.js
```

## 監控和維護

### 日誌監控

- 所有操作都有詳細的日誌記錄
- 可以通過日誌追蹤系統運行狀況

### 統計監控

- 提供 API 端點查看統計資訊
- 可以監控未驗證用戶的數量變化

### 手動干預

- 管理員可以手動執行清理任務
- 可以查看詳細的統計資訊

## 注意事項

1. **時區設定**: 系統使用台灣時區 (Asia/Taipei)
2. **資料庫索引**: 建議在 `createdAt` 和 `email_verified` 字段上建立索引
3. **Email 服務**: 需要確保 SendGrid 配置正確
4. **備份策略**: 建議定期備份用戶資料
5. **監控告警**: 建議設置監控告警，確保系統正常運行

## 未來改進

1. **可配置的時間設定**: 允許通過環境變數配置提醒和刪除時間
2. **批量處理優化**: 對於大量用戶的處理優化
3. **更詳細的統計**: 提供更詳細的統計資訊和圖表
4. **用戶通知設定**: 允許用戶設定是否接收此類通知
5. **恢復機制**: 提供被誤刪除用戶的恢復機制
