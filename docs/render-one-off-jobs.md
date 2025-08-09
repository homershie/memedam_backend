# Render One-Off Jobs 使用指南

## 概述

Render 的 One-Off Jobs 功能可以讓你執行一次性的任務，非常適合用來執行定期維護、數據清理、推薦系統更新等任務。這些任務原本是通過 `node-cron` 在應用程式中定期執行的，但使用 One-Off Jobs 可以：

1. **降低主應用程式的負載** - 將耗時的任務從主服務中分離出來
2. **更好的資源管理** - 只在需要時才啟動計算資源
3. **更靈活的排程** - 可以根據需要手動觸發或設置不同的執行頻率
4. **更好的監控** - 每個任務都有獨立的日誌和執行狀態

## 可用的任務

### 用戶管理任務

#### 1. 發送帳號刪除提醒 (`cleanup-reminders`)

- **功能**：向註冊超過11個月但未驗證的用戶發送刪除提醒郵件
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js cleanup-reminders`

#### 2. 刪除未驗證用戶 (`cleanup-users`)

- **功能**：刪除註冊超過一年但未驗證的用戶帳號
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js cleanup-users`

### 通知系統任務

#### 3. 發送熱門內容通知 (`hot-content-notifications`)

- **功能**：向用戶發送熱門迷因內容通知
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js hot-content-notifications`

#### 4. 發送週報摘要通知 (`weekly-summary-notifications`)

- **功能**：向用戶發送每週活動摘要通知
- **執行頻率**：建議每週一執行一次
- **命令**：`node scripts/render-jobs.js weekly-summary-notifications`

#### 5. 清理舊通知 (`cleanup-notifications`)

- **功能**：清理30天前的舊通知
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js cleanup-notifications`

### 推薦系統任務

#### 6. 更新熱門分數 (`update-hot-scores`)

- **功能**：更新所有迷因的熱門分數
- **執行頻率**：建議每小時執行一次
- **命令**：`node scripts/render-jobs.js update-hot-scores`

#### 7. 更新內容基礎推薦 (`update-content-based`)

- **功能**：更新用戶偏好快取
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js update-content-based`

#### 8. 更新協同過濾推薦 (`update-collaborative`)

- **功能**：更新協同過濾推薦快取
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js update-collaborative`

#### 9. 更新社交協同過濾推薦 (`update-social-collaborative`)

- **功能**：更新社交協同過濾推薦快取
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js update-social-collaborative`

#### 10. 更新所有推薦系統 (`update-all-recommendations`)

- **功能**：一次性更新所有推薦系統
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js update-all-recommendations`

### 維護任務

#### 11. 檢查並修正迷因計數 (`check-meme-counts`)

- **功能**：檢查並修正迷因的讚數、留言數、觀看數等計數
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js check-meme-counts`

#### 12. 檢查並修正用戶計數 (`check-user-counts`)

- **功能**：檢查並修正用戶的追蹤數、迷因數等計數
- **執行頻率**：建議每天執行一次
- **命令**：`node scripts/render-jobs.js check-user-counts`

## 設置步驟

### 方法 1: 使用 Render Dashboard

#### 1. 在 Render Dashboard 中創建 One-Off Job

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 選擇你的專案
3. 點擊 "New" → **"Cron Job"** (這是創建 One-Off Job 的正確選項)
4. 選擇你的主服務作為 base service
5. 設置以下參數：
   - **Name**：任務名稱（例如：`cleanup-reminders`）
   - **Start Command**：`node scripts/render-jobs.js cleanup-reminders`
   - **Instance Type**：根據任務複雜度選擇（建議從 Standard 開始）
   - **Schedule**：可以設置為 `0 2 * * *`（每天凌晨2點）或留空手動執行

### 方法 2: 使用 Render API

#### 1. 創建 API Key

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 進入 Account Settings 頁面
3. 創建新的 API Key
4. **重要**：API Key 只會在創建時顯示一次，請務必保存

**⚠️ 安全提醒：**

- 不要將 API Key 直接寫在程式碼中
- 不要將 API Key 提交到版本控制系統
- 使用環境變數來存儲 API Key

#### 2. 獲取 Service ID

1. 在 Render Dashboard 中找到你的主服務
2. 從 URL 中複製 Service ID
   - 格式：`srv-xxxxxxxxxx` (Web Services)
   - 格式：`crn-xxxxxxxxxx` (Cron Jobs)

#### 3. 使用 API 創建 One-Off Job

##### 基本請求格式

```bash
curl --request POST 'https://api.render.com/v1/services/YOUR_SERVICE_ID/jobs' \
     --header 'Authorization: Bearer YOUR_API_KEY' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "startCommand": "cd /opt/render/project/src && node scripts/render-jobs.js cleanup-reminders"
     }'
```

##### 使用我們的 API 客戶端

我們提供了一個 Node.js API 客戶端來簡化操作：

```bash
# 設置環境變數
export RENDER_API_KEY="your_api_key_here"
export RENDER_SERVICE_ID="your_service_id_here"

# 創建任務（自動處理路徑問題）
node scripts/render-api-client.js create cleanup-reminders

# 查看任務狀態
node scripts/render-api-client.js status job-c3rfdgg6n88pa7t3a6ag

# 列出所有任務
node scripts/render-api-client.js list

# 取消任務
node scripts/render-api-client.js cancel job-c3rfdgg6n88pa7t3a6ag
```

##### 範例請求

```bash
# 創建用戶清理提醒任務
curl --request POST 'https://api.render.com/v1/services/srv-xxxxxxxxxx/jobs' \
     --header 'Authorization: Bearer rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "startCommand": "node scripts/render-jobs.js cleanup-reminders"
     }'

# 創建熱門分數更新任務
curl --request POST 'https://api.render.com/v1/services/srv-xxxxxxxxxx/jobs' \
     --header 'Authorization: Bearer rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "startCommand": "node scripts/render-jobs.js update-hot-scores"
     }'

# 創建推薦系統更新任務
curl --request POST 'https://api.render.com/v1/services/srv-xxxxxxxxxx/jobs' \
     --header 'Authorization: Bearer rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "startCommand": "node scripts/render-jobs.js update-all-recommendations"
     }'
```

#### 4. API 端點詳解

##### 創建 One-Off Job

**端點：** `POST https://api.render.com/v1/services/{serviceId}/jobs`

**請求參數：**

```json
{
  "startCommand": "string", // 必需：要執行的命令
  "planId": "string" // 可選：實例類型 ID
}
```

**回應格式：**

```json
{
  "id": "job-c3rfdgg6n88pa7t3a6ag",
  "serviceId": "srv-xxxxxxxxxx",
  "startCommand": "node scripts/render-jobs.js cleanup-reminders",
  "planId": "plan-srv-008",
  "createdAt": "2025-03-20T12:16:02.544199-04:00"
}
```

##### 查詢 Job 狀態

**端點：** `GET https://api.render.com/v1/services/{serviceId}/jobs/{jobId}`

```bash
curl --request GET 'https://api.render.com/v1/services/srv-xxxxxxxxxx/jobs/job-c3rfdgg6n88pa7t3a6ag' \
     --header 'Authorization: Bearer rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

**回應格式：**

```json
{
  "id": "job-c3rfdgg6n88pa7t3a6ag",
  "serviceId": "srv-xxxxxxxxxx",
  "startCommand": "node scripts/render-jobs.js cleanup-reminders",
  "planId": "plan-srv-008",
  "createdAt": "2025-03-20T07:20:05.777035-07:00",
  "startedAt": "2025-03-20T07:24:12.987032-07:00",
  "finishedAt": "2025-03-20T07:27:14.234587-07:00",
  "status": "succeeded"
}
```

##### 列出所有 Jobs

**端點：** `GET https://api.render.com/v1/services/{serviceId}/jobs`

```bash
curl --request GET 'https://api.render.com/v1/services/srv-xxxxxxxxxx/jobs' \
     --header 'Authorization: Bearer rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

#### 5. 實例類型 ID

##### Web Services, Private Services, Background Workers

| Instance Type ID | Instance Type | Specs              |
| ---------------- | ------------- | ------------------ |
| plan-srv-006     | Starter       | 512 MB RAM 0.5 CPU |
| plan-srv-008     | Standard      | 2 GB RAM 1 CPU     |
| plan-srv-010     | Pro           | 4 GB RAM 2 CPU     |
| plan-srv-011     | Pro Plus      | 8 GB RAM 4 CPU     |
| plan-srv-013     | Pro Max       | 16 GB RAM 4 CPU    |
| plan-srv-014     | Pro Ultra     | 32 GB RAM 8 CPU    |

##### Cron Jobs

| Instance Type ID | Instance Type | Specs              |
| ---------------- | ------------- | ------------------ |
| plan-crn-003     | Starter       | 512 MB RAM 0.5 CPU |
| plan-crn-005     | Standard      | 2 GB RAM 1 CPU     |
| plan-crn-007     | Pro           | 4 GB RAM 2 CPU     |
| plan-crn-008     | Pro Plus      | 8 GB RAM 4 CPU     |

### 2. 設置環境變數

確保你的 One-Off Job 有相同的環境變數：

#### 在 `.env` 檔案中設置（本地開發）

```bash
# Render API 設定
RENDER_API_KEY=your_actual_api_key_here
RENDER_SERVICE_ID=your_service_id_here

# 其他必要的環境變數
MONGODB_URI=mongodb://localhost:27017/memedam
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

#### 在 Render Dashboard 中設置（生產環境）

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 選擇你的服務
3. 進入 "Environment" 頁面
4. 添加以下環境變數：
   - `RENDER_API_KEY` = `your_actual_api_key_here`
   - `RENDER_SERVICE_ID` = `your_service_id_here`

**重要安全提醒：**

- 將 `.env` 檔案添加到 `.gitignore` 中
- 不要將真實的 API Key 提交到版本控制
- 使用不同的 API Key 用於開發和生產環境

### 3. 設置自動執行（可選）

如果你想要自動執行這些任務，可以：

1. **使用 Render 的 Cron Jobs**：
   - 創建一個 Cron Job 服務
   - 設置定時執行腳本

2. **使用外部排程服務**：
   - GitHub Actions
   - AWS EventBridge
   - 其他排程服務

3. **使用 API 自動化**：
   - 創建腳本定期調用 API
   - 使用 CI/CD 流程觸發任務

## 監控和日誌

### 查看執行狀態

1. 在 Render Dashboard 中點擊你的 One-Off Job
2. 查看 "Jobs" 頁面
3. 點擊特定的 job 查看詳細資訊

### 查看日誌

1. 在 job 詳情頁面點擊 "Logs" 標籤
2. 查看實時日誌輸出
3. 日誌會包含執行時間、成功/失敗狀態、錯誤訊息等

## 最佳實踐

### 1. 任務設計

- **單一職責**：每個任務只做一件事
- **錯誤處理**：確保任務有適當的錯誤處理
- **日誌記錄**：記錄重要的執行資訊
- **超時處理**：設置適當的超時時間

### 2. 資源管理

- **實例類型**：根據任務複雜度選擇合適的實例類型
- **執行時間**：避免長時間運行的任務
- **並發限制**：避免同時執行太多任務

### 3. 監控和警報

- **設置警報**：當任務失敗時發送通知
- **定期檢查**：定期檢查任務執行狀態
- **性能監控**：監控任務的執行時間和資源使用

## 範例配置

### 每日維護任務

```bash
# 每天凌晨 2 點執行
node scripts/render-jobs.js cleanup-reminders
node scripts/render-jobs.js cleanup-users
node scripts/render-jobs.js cleanup-notifications
node scripts/render-jobs.js check-meme-counts
node scripts/render-jobs.js check-user-counts
```

### 推薦系統更新

```bash
# 每小時更新熱門分數
node scripts/render-jobs.js update-hot-scores

# 每天更新推薦系統
node scripts/render-jobs.js update-all-recommendations
```

### 通知系統

```bash
# 每天發送熱門內容通知
node scripts/render-jobs.js hot-content-notifications

# 每週一發送週報
node scripts/render-jobs.js weekly-summary-notifications
```

## 故障排除

### 常見問題

1. **任務執行失敗**
   - 檢查環境變數是否正確設置
   - 查看日誌中的錯誤訊息
   - 確認數據庫連接是否正常

2. **任務執行時間過長**
   - 考慮增加實例類型
   - 優化任務邏輯
   - 分批處理大量數據

3. **資源不足**
   - 升級實例類型
   - 優化任務效率
   - 減少並發執行

### 聯繫支援

如果遇到問題，可以：

1. 查看 Render 的官方文檔
2. 在 Render 社群中尋求幫助
3. 聯繫 Render 支援團隊

## 遷移計劃

### 從 node-cron 遷移到 One-Off Jobs

1. **第一階段**：設置 One-Off Jobs 並測試
2. **第二階段**：逐步將任務從 node-cron 遷移
3. **第三階段**：完全移除 node-cron 依賴

### 遷移檢查清單

- [ ] 創建所有必要的 One-Off Jobs
- [ ] 測試每個任務的執行
- [ ] 設置適當的監控和警報
- [ ] 更新文檔和團隊培訓
- [ ] 移除舊的 node-cron 代碼
