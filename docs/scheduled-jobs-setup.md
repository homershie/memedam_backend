# Render 定期任務設置指南

## 概述

本指南將幫助你設置和配置 Render 的定期任務，以自動執行各種維護、清理和更新操作。

## 🎯 定期任務清單

### 用戶管理任務

| 任務名稱            | 描述             | 執行頻率 | 執行時間  | 命令                                            |
| ------------------- | ---------------- | -------- | --------- | ----------------------------------------------- |
| `cleanup-reminders` | 發送帳號刪除提醒 | 每天     | 凌晨 2:00 | `node scripts/render-jobs.js cleanup-reminders` |
| `cleanup-users`     | 刪除未驗證用戶   | 每天     | 凌晨 3:00 | `node scripts/render-jobs.js cleanup-users`     |

### 通知系統任務

| 任務名稱                       | 描述             | 執行頻率 | 執行時間   | 命令                                                       |
| ------------------------------ | ---------------- | -------- | ---------- | ---------------------------------------------------------- |
| `hot-content-notifications`    | 發送熱門內容通知 | 每天     | 上午 9:00  | `node scripts/render-jobs.js hot-content-notifications`    |
| `weekly-summary-notifications` | 發送週報摘要通知 | 每週一   | 上午 10:00 | `node scripts/render-jobs.js weekly-summary-notifications` |
| `cleanup-notifications`        | 清理舊通知       | 每天     | 凌晨 4:00  | `node scripts/render-jobs.js cleanup-notifications`        |

### 推薦系統任務

| 任務名稱                      | 描述                 | 執行頻率 | 執行時間   | 命令                                                      |
| ----------------------------- | -------------------- | -------- | ---------- | --------------------------------------------------------- |
| `update-hot-scores`           | 更新熱門分數         | 每小時   | 每小時整點 | `node scripts/render-jobs.js update-hot-scores`           |
| `update-content-based`        | 更新內容基礎推薦     | 每天     | 凌晨 5:00  | `node scripts/render-jobs.js update-content-based`        |
| `update-collaborative`        | 更新協同過濾推薦     | 每天     | 凌晨 6:00  | `node scripts/render-jobs.js update-collaborative`        |
| `update-social-collaborative` | 更新社交協同過濾推薦 | 每天     | 凌晨 7:00  | `node scripts/render-jobs.js update-social-collaborative` |
| `update-all-recommendations`  | 更新所有推薦系統     | 每天     | 上午 8:00  | `node scripts/render-jobs.js update-all-recommendations`  |

### 維護任務

| 任務名稱            | 描述               | 執行頻率 | 執行時間  | 命令                                            |
| ------------------- | ------------------ | -------- | --------- | ----------------------------------------------- |
| `check-meme-counts` | 檢查並修正迷因計數 | 每天     | 凌晨 1:00 | `node scripts/render-jobs.js check-meme-counts` |
| `check-user-counts` | 檢查並修正用戶計數 | 每天     | 凌晨 1:00 | `node scripts/render-jobs.js check-user-counts` |

## 🚀 設置步驟

### 步驟 1: 查看定期任務配置

```bash
# 查看所有定期任務配置
node scripts/schedule-jobs.js show
```

### 步驟 2: 創建所有定期任務

```bash
# 創建所有定期任務（一次性創建）
node scripts/schedule-jobs.js create
```

### 步驟 3: 在 Render Dashboard 中設置 Cron Jobs

1. **登入 Render Dashboard**
   - 訪問 [https://dashboard.render.com](https://dashboard.render.com)

2. **創建 Cron Job 服務**
   - 點擊 "New" → "Cron Job"
   - 選擇你的主服務作為 base service

3. **設置基本配置**
   - **Name**: `定期任務服務`
   - **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js cleanup-reminders`
   - **Schedule**: `0 2 * * *` (每天凌晨2點)

4. **設置環境變數**
   - 確保所有必要的環境變數都已設置
   - 參考 `docs/render-one-off-jobs.md` 中的環境變數設置

### 步驟 4: 設置多個 Cron Jobs

對於不同頻率的任務，你需要創建多個 Cron Job 服務：

#### 每小時執行的任務

- **Name**: `每小時任務`
- **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js update-hot-scores`
- **Schedule**: `0 * * * *`

#### 每天執行的任務

- **Name**: `每日維護任務`
- **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js cleanup-reminders`
- **Schedule**: `0 2 * * *`

#### 每週執行的任務

- **Name**: `每週任務`
- **Start Command**: `cd /opt/render/project/src && node scripts/render-jobs.js weekly-summary-notifications`
- **Schedule**: `0 10 * * 1`

## 📅 Cron 表達式說明

| 表達式        | 說明           | 範例         |
| ------------- | -------------- | ------------ |
| `0 2 * * *`   | 每天凌晨2點    | 用戶清理任務 |
| `0 * * * *`   | 每小時整點     | 熱門分數更新 |
| `0 10 * * 1`  | 每週一上午10點 | 週報通知     |
| `0 1-6 * * *` | 每天凌晨1-6點  | 維護任務     |

## 🔧 高級配置

### 使用 API 自動化設置

如果你想要完全自動化設置過程，可以使用我們的 API 客戶端：

```bash
# 創建單個任務
node scripts/render-api-client.js create cleanup-reminders

# 批量創建任務
node scripts/schedule-jobs.js create
```

### 監控和警報設置

1. **設置失敗通知**
   - 在 Render Dashboard 中設置失敗通知
   - 配置 Slack 或 Email 通知

2. **監控任務執行**
   - 定期檢查任務執行狀態
   - 查看任務日誌和錯誤信息

## 🎯 最佳實踐

### 1. 任務時間安排

- **避免重疊**：確保任務不會同時執行
- **合理分配**：將耗時任務安排在低峰期
- **考慮時區**：注意服務器時區設置

### 2. 資源管理

- **監控資源使用**：注意 CPU 和記憶體使用
- **避免過載**：不要同時執行太多任務
- **優化執行時間**：儘量縮短任務執行時間

### 3. 錯誤處理

- **設置重試機制**：對於重要任務設置自動重試
- **記錄錯誤日誌**：詳細記錄錯誤信息
- **設置警報**：失敗時及時通知

### 4. 測試和驗證

- **先在測試環境驗證**：確保任務功能正常
- **逐步部署**：先部署少量任務，再逐步增加
- **監控執行結果**：定期檢查任務執行效果

## 📊 監控和維護

### 查看任務狀態

```bash
# 列出所有任務
node scripts/render-api-client.js list

# 查看特定任務狀態
node scripts/render-api-client.js status <job-id>
```

### 常見問題排查

1. **任務執行失敗**
   - 檢查環境變數設置
   - 查看任務日誌
   - 確認數據庫連接

2. **任務執行時間過長**
   - 優化任務邏輯
   - 檢查資源使用
   - 考慮分批處理

3. **任務未按時執行**
   - 檢查 Cron 表達式
   - 確認時區設置
   - 查看服務狀態

## 📝 注意事項

1. **備份重要數據**：執行清理任務前務必備份
2. **測試環境驗證**：先在測試環境中驗證所有任務
3. **監控執行效果**：定期檢查任務執行結果
4. **更新文檔**：任務變更時及時更新文檔

## 🎉 完成設置

完成以上步驟後，你的系統將具備完整的自動化維護能力：

- ✅ 自動用戶管理（清理和提醒）
- ✅ 自動通知系統（熱門內容和週報）
- ✅ 自動推薦系統更新
- ✅ 自動維護和數據一致性檢查

這樣可以大大減少手動維護工作，提高系統穩定性和用戶體驗。
