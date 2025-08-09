# 🕐 Node-Cron 定期任務系統

## 概述

**迷因典**使用 `node-cron` 來管理所有的定期任務，包括用戶管理、通知系統、推薦系統更新和維護任務。所有任務都已整合到應用程式中，在服務器啟動時自動開始執行。

## 📅 任務時間表

### 每小時任務

| 時間   | 任務           | 調度器           | 說明                 |
| ------ | -------------- | ---------------- | -------------------- |
| 每小時 | 更新熱門分數   | 推薦系統調度器   | 更新所有迷因的熱門分數 |

### 每日任務

| 時間      | 任務                   | 調度器           | 說明                       |
| --------- | ---------------------- | ---------------- | -------------------------- |
| 凌晨 1:00 | 檢查並修正迷因計數     | 維護調度器       | 修正讚數、留言數、觀看數等 |
| 凌晨 1:00 | 檢查並修正用戶計數     | 維護調度器       | 修正追蹤數、迷因數等       |
| 凌晨 2:00 | 發送帳號刪除提醒       | 用戶清理調度器   | 向未驗證用戶發送提醒       |
| 凌晨 3:00 | 刪除未驗證用戶         | 用戶清理調度器   | 刪除註冊超過一年的未驗證用戶 |
| 凌晨 4:00 | 清理舊通知             | 通知調度器       | 清理 30 天前的舊通知       |
| 凌晨 5:00 | 更新內容基礎推薦       | 推薦系統調度器   | 更新用戶偏好快取           |
| 凌晨 6:00 | 更新協同過濾推薦       | 推薦系統調度器   | 更新協同過濾推薦快取       |
| 凌晨 7:00 | 更新社交協同過濾推薦   | 推薦系統調度器   | 更新社交協同過濾推薦快取   |
| 上午 9:00 | 發送熱門內容通知       | 通知調度器       | 向用戶發送熱門迷因通知     |

### 每週任務

| 時間                 | 任務               | 調度器       | 說明                     |
| -------------------- | ------------------ | ------------ | ------------------------ |
| 週日凌晨 4:00        | 每週完整數據檢查   | 維護調度器   | 全面檢查數據一致性       |
| 週一上午 10:00       | 發送週報摘要通知   | 通知調度器   | 向用戶發送週報摘要       |

## 🔧 調度器架構

### 1. 維護調度器 (`utils/maintenance.js`)

負責數據一致性檢查和修正任務。

**啟動方式：**
```javascript
import maintenanceScheduler from './utils/maintenance.js'
maintenanceScheduler.startAllTasks()
```

**任務列表：**
- **每日迷因統計檢查**：檢查並修正迷因的讚數、留言數、觀看數
- **每日用戶統計檢查**：檢查並修正用戶的追蹤數、迷因數
- **每週完整檢查**：全面的數據一致性檢查

### 2. 通知調度器 (`utils/notificationScheduler.js`)

管理所有用戶通知相關的定期任務。

**啟動方式：**
```javascript
import { startNotificationScheduler } from './utils/notificationScheduler.js'
startNotificationScheduler()
```

**任務列表：**
- **熱門內容通知**：推送熱門迷因給活躍用戶
- **週報摘要通知**：發送用戶週活動摘要
- **清理舊通知**：清理 30 天前的舊通知

### 3. 用戶清理調度器 (`utils/userCleanupScheduler.js`)

處理用戶帳號管理和清理任務。

**啟動方式：**
```javascript
import { startUserCleanupScheduler } from './utils/userCleanupScheduler.js'
startUserCleanupScheduler()
```

**任務列表：**
- **刪除提醒**：向註冊超過 11 個月但未驗證的用戶發送提醒
- **帳號刪除**：刪除註冊超過一年但未驗證的用戶帳號

### 4. 推薦系統調度器 (`utils/recommendationScheduler.js`)

管理推薦系統的定期更新任務。

**啟動方式：**
```javascript
import { startRecommendationScheduler } from './utils/recommendationScheduler.js'
startRecommendationScheduler()
```

**任務列表：**
- **熱門分數更新**：每小時更新所有迷因的熱門分數
- **內容基礎推薦更新**：更新用戶偏好快取
- **協同過濾推薦更新**：更新協同過濾推薦快取
- **社交協同過濾推薦更新**：更新社交協同過濾推薦快取

## 🚀 啟動和管理

### 自動啟動

所有調度器在應用程式啟動時自動啟動（在 `index.js` 中配置）：

```javascript
// 啟動所有調度器
maintenanceScheduler.startAllTasks()
startNotificationScheduler()
startUserCleanupScheduler()
startRecommendationScheduler()
```

### 手動控制

#### 停止所有調度器
```javascript
maintenanceScheduler.stopAllTasks()
stopNotificationScheduler()
stopUserCleanupScheduler()
stopRecommendationScheduler()
```

#### 查看調度器狀態
```javascript
// 維護調度器狀態
const maintenanceStatus = maintenanceScheduler.getTasksStatus()

// 推薦系統調度器狀態
const recommendationStatus = await getRecommendationSystemStatus()
```

## 🔍 手動觸發任務

### 維護任務
```javascript
// 手動執行完整數據檢查
await maintenanceScheduler.runFullCheck()
```

### 通知任務
```javascript
import { manualTriggers } from './utils/notificationScheduler.js'

// 手動發送熱門內容通知
await manualTriggers.sendHotContentNotifications()

// 手動發送週報摘要通知
await manualTriggers.sendWeeklySummaryNotifications()

// 手動清理舊通知
await manualTriggers.cleanupOldNotificationsTask()
```

### 用戶清理任務
```javascript
import { 
  manualSendDeletionReminders, 
  manualDeleteUnverifiedUsers 
} from './utils/userCleanupScheduler.js'

// 手動發送刪除提醒
await manualSendDeletionReminders()

// 手動刪除未驗證用戶
await manualDeleteUnverifiedUsers()
```

### 推薦系統任務
```javascript
import { 
  updateHotScores,
  updateContentBasedCache,
  updateCollaborativeFilteringCacheScheduler,
  updateSocialCollaborativeFilteringCacheScheduler,
  updateAllRecommendationSystems
} from './utils/recommendationScheduler.js'

// 手動更新熱門分數
await updateHotScores()

// 手動更新所有推薦系統
await updateAllRecommendationSystems()
```

## 📊 監控和日誌

### 日誌記錄

所有調度器都使用統一的日誌系統（`utils/logger.js`）記錄執行狀態：

```javascript
// 成功執行
logger.info('任務執行完成', { task: 'updateHotScores', duration: 1500 })

// 執行失敗
logger.error('任務執行失敗', { task: 'cleanup-reminders', error: error.message })
```

### 執行狀態

每個調度器都會在控制台輸出執行狀態：

```
✅ 推薦系統調度器已啟動
- 熱門分數更新：每小時整點
- 內容基礎推薦更新：每天凌晨5點
- 協同過濾推薦更新：每天凌晨6點
- 社交協同過濾推薦更新：每天凌晨7點
```

## ⚙️ 配置和自定義

### 時區設置

所有任務都使用台北時區（`Asia/Taipei`）：

```javascript
cron.schedule('0 1 * * *', async () => {
  // 任務邏輯
}, {
  timezone: 'Asia/Taipei'
})
```

### 修改執行時間

要修改任務執行時間，請編輯對應調度器檔案中的 cron 表達式：

```javascript
// 範例：將熱門內容通知從上午9點改為上午11點
cron.schedule('0 11 * * *', () => {
  sendHotContentNotifications()
}, {
  timezone: 'Asia/Taipei'
})
```

### Cron 表達式參考

```
* * * * * *
│ │ │ │ │ │
│ │ │ │ │ └─ 年份 (可選)
│ │ │ │ └─── 星期 (0-7，0 和 7 都是星期日)
│ │ │ └───── 月份 (1-12)
│ │ └─────── 日期 (1-31)
│ └───────── 小時 (0-23)
└─────────── 分鐘 (0-59)
```

**範例：**
- `0 * * * *`：每小時整點
- `0 9 * * *`：每天上午 9 點
- `0 10 * * 1`：每週一上午 10 點
- `0 4 * * 0`：每週日凌晨 4 點

## 🛠️ 開發和測試

### 測試調度器

可以使用較短的時間間隔來測試調度器：

```javascript
// 測試用：每分鐘執行一次
cron.schedule('* * * * *', async () => {
  console.log('測試任務執行')
})
```

### 禁用特定任務

可以在調度器中添加條件來禁用特定任務：

```javascript
if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 1 * * *', async () => {
    // 只在非測試環境執行
  })
}
```

## 📝 最佳實踐

1. **錯誤處理**：每個任務都應包含適當的錯誤處理
2. **日誌記錄**：記錄任務開始、完成和錯誤狀態
3. **資源管理**：避免長時間運行的任務阻塞應用程式
4. **冪等性**：確保任務可以安全地重複執行
5. **監控**：定期檢查任務執行狀態和日誌

## 🔧 故障排除

### 常見問題

1. **任務未執行**
   - 檢查調度器是否已啟動
   - 確認 cron 表達式正確
   - 查看日誌中的錯誤信息

2. **任務執行失敗**
   - 檢查數據庫連接
   - 確認必要的環境變數已設置
   - 查看具體的錯誤日誌

3. **時間不正確**
   - 確認時區設置為 `Asia/Taipei`
   - 檢查服務器時間

### 調試

啟用詳細日誌來調試問題：

```javascript
// 在調度器中添加調試日誌
console.log(`任務開始執行: ${new Date().toISOString()}`)
logger.debug('Task execution details', { taskName, parameters })
```

## 📚 相關文檔

- [維護任務文檔](../utils/maintenance.js)
- [通知系統文檔](../utils/notificationScheduler.js)
- [用戶清理文檔](../utils/userCleanupScheduler.js)
- [推薦系統文檔](../utils/recommendationScheduler.js)

---

**注意**：所有定期任務現在都通過 node-cron 在應用程式內部執行，無需額外的外部服務或配置。