# 🚀 Render 定期任務快速設置指南

## 概述

這個指南將幫助你快速設置 Render 的定期任務，實現系統的自動化維護。

## ✅ 前提條件

1. ✅ 已測試 One-Off Jobs 功能正常
2. ✅ 已設置 `RENDER_API_KEY` 和 `RENDER_SERVICE_ID` 環境變數
3. ✅ 已確認腳本在 Render 環境中能正常執行

## 🎯 快速設置步驟

### 步驟 1: 查看定期任務配置

```bash
# 查看所有定期任務配置
node scripts/schedule-jobs.js show
```

### 步驟 2: 批量創建定期任務

```bash
# 創建所有定期任務（一次性創建）
node scripts/schedule-jobs.js create
```

### 步驟 3: 在 Render Dashboard 中設置 Cron Jobs

#### 3.1 創建每小時任務

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 點擊 "New" → "Cron Job"
3. 設置：
   - **Name**: `每小時任務`
   - **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js update-hot-scores`
   - **Schedule**: `0 * * * *`

#### 3.2 創建每日任務

1. 點擊 "New" → "Cron Job"
2. 設置：
   - **Name**: `每日維護任務`
   - **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js cleanup-reminders`
   - **Schedule**: `0 2 * * *`

#### 3.3 創建每週任務

1. 點擊 "New" → "Cron Job"
2. 設置：
   - **Name**: `每週任務`
   - **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js weekly-summary-notifications`
   - **Schedule**: `0 10 * * 1`

## 📅 任務執行時間表

| 時間   | 任務                 | 頻率   |
| ------ | -------------------- | ------ |
| 01:00  | 檢查並修正計數       | 每天   |
| 02:00  | 發送帳號刪除提醒     | 每天   |
| 03:00  | 刪除未驗證用戶       | 每天   |
| 04:00  | 清理舊通知           | 每天   |
| 05:00  | 更新內容基礎推薦     | 每天   |
| 06:00  | 更新協同過濾推薦     | 每天   |
| 07:00  | 更新社交協同過濾推薦 | 每天   |
| 08:00  | 更新所有推薦系統     | 每天   |
| 09:00  | 發送熱門內容通知     | 每天   |
| 10:00  | 發送週報摘要通知     | 每週一 |
| 每小時 | 更新熱門分數         | 每小時 |

## 🔧 監控和管理

### 查看任務狀態

```bash
# 列出所有任務
node scripts/render-api-client.js list

# 查看特定任務狀態
node scripts/render-api-client.js status <job-id>
```

### 手動觸發任務

```bash
# 手動觸發單個任務
node scripts/render-api-client.js create cleanup-reminders
node scripts/render-api-client.js create update-hot-scores
```

## 🎯 高級配置

### 自定義任務時間

如果需要調整任務執行時間，可以編輯 `scripts/schedule-jobs.js` 中的配置：

```javascript
const SCHEDULED_JOBS = [
  {
    name: 'cleanup-reminders',
    description: '發送帳號刪除提醒',
    command: 'cd /opt/render/project/src && node scripts/render-jobs.js cleanup-reminders',
    schedule: '0 2 * * *', // 修改這裡的時間
    category: '用戶管理',
  },
  // ... 其他任務
]
```

### 添加新任務

1. 在 `scripts/render-jobs.js` 中添加新任務
2. 在 `scripts/schedule-jobs.js` 中添加配置
3. 重新運行設置腳本

## 📊 監控和警報

### 設置失敗通知

1. 在 Render Dashboard 中設置失敗通知
2. 配置 Slack 或 Email 通知
3. 定期檢查任務執行狀態

### 查看日誌

1. 在 Render Dashboard 中點擊任務
2. 查看 "Logs" 標籤
3. 分析錯誤信息和執行結果

## 🎉 完成設置

完成以上步驟後，你的系統將具備：

- ✅ **自動用戶管理**：定期清理未驗證用戶和發送提醒
- ✅ **自動通知系統**：發送熱門內容和週報通知
- ✅ **自動推薦系統更新**：保持推薦系統的準確性
- ✅ **自動維護**：數據一致性檢查和修正

## 📝 注意事項

1. **備份數據**：執行清理任務前務必備份重要數據
2. **測試驗證**：先在測試環境中驗證所有任務
3. **監控執行**：定期檢查任務執行效果
4. **及時更新**：任務變更時及時更新文檔

## 🆘 故障排除

### 常見問題

1. **任務執行失敗**
   - 檢查環境變數設置
   - 查看任務日誌
   - 確認數據庫連接

2. **任務未按時執行**
   - 檢查 Cron 表達式
   - 確認時區設置
   - 查看服務狀態

3. **路徑問題**
   - 確認使用正確的路徑：`cd /opt/render/project/src && node scripts/render-jobs.js <task-name>`

### 聯繫支援

如果遇到問題，可以：

1. 查看 [Render 官方文檔](https://render.com/docs)
2. 檢查任務日誌和錯誤信息
3. 聯繫 Render 支援團隊

---

**🎯 恭喜！你的 Render 定期任務系統已經設置完成！**
