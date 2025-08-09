# 使用 Render API 創建 One-Off Jobs

## 概述

根據 [Render API 文檔](https://render.com/docs/api) 和 [One-Off Jobs 文檔](https://render.com/docs/one-off-jobs)，你可以使用 Render 的 REST API 來程式化地創建和管理 One-Off Jobs。

## 設置步驟

### 1. 創建 API Key

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 進入 Account Settings 頁面
3. 創建新的 API Key
4. **重要**：API Key 只會在創建時顯示一次，請務必保存

### 2. 獲取 Service ID

1. 在 Render Dashboard 中找到你的主服務
2. 從 URL 中複製 Service ID
   - 格式：`srv-xxxxxxxxxx` (Web Services)
   - 格式：`crn-xxxxxxxxxx` (Cron Jobs)

### 3. 使用 API 創建 One-Off Job

#### 基本請求格式

```bash
curl --request POST 'https://api.render.com/v1/services/YOUR_SERVICE_ID/jobs' \
     --header 'Authorization: Bearer YOUR_API_KEY' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "startCommand": "node scripts/render-jobs.js cleanup-reminders"
     }'
```

#### 範例請求

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

## API 端點詳解

### 創建 One-Off Job

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

### 查詢 Job 狀態

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

### 列出所有 Jobs

**端點：** `GET https://api.render.com/v1/services/{serviceId}/jobs`

```bash
curl --request GET 'https://api.render.com/v1/services/srv-xxxxxxxxxx/jobs' \
     --header 'Authorization: Bearer rnd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

## 實例類型 ID

### Web Services, Private Services, Background Workers

| Instance Type ID | Instance Type | Specs              |
| ---------------- | ------------- | ------------------ |
| plan-srv-006     | Starter       | 512 MB RAM 0.5 CPU |
| plan-srv-008     | Standard      | 2 GB RAM 1 CPU     |
| plan-srv-010     | Pro           | 4 GB RAM 2 CPU     |
| plan-srv-011     | Pro Plus      | 8 GB RAM 4 CPU     |
| plan-srv-013     | Pro Max       | 16 GB RAM 4 CPU    |
| plan-srv-014     | Pro Ultra     | 32 GB RAM 8 CPU    |

### Cron Jobs

| Instance Type ID | Instance Type | Specs              |
| ---------------- | ------------- | ------------------ |
| plan-crn-003     | Starter       | 512 MB RAM 0.5 CPU |
| plan-crn-005     | Standard      | 2 GB RAM 1 CPU     |
| plan-crn-007     | Pro           | 4 GB RAM 2 CPU     |
| plan-crn-008     | Pro Plus      | 8 GB RAM 4 CPU     |

## 實用腳本

### 1. 創建所有定期任務的腳本

```bash
#!/bin/bash

# 設置變數
API_KEY="your_api_key_here"
SERVICE_ID="your_service_id_here"
BASE_URL="https://api.render.com/v1/services"

# 定義任務列表
TASKS=(
    "cleanup-reminders"
    "cleanup-users"
    "hot-content-notifications"
    "weekly-summary-notifications"
    "cleanup-notifications"
    "update-hot-scores"
    "update-content-based"
    "update-collaborative"
    "update-social-collaborative"
    "update-all-recommendations"
    "check-meme-counts"
    "check-user-counts"
)

# 創建每個任務
for task in "${TASKS[@]}"; do
    echo "創建任務: $task"

    curl --request POST "$BASE_URL/$SERVICE_ID/jobs" \
         --header "Authorization: Bearer $API_KEY" \
         --header "Content-Type: application/json" \
         --data-raw "{
            \"startCommand\": \"node scripts/render-jobs.js $task\"
         }"

    echo -e "\n---\n"
done
```

### 2. 監控任務狀態的腳本

```bash
#!/bin/bash

# 設置變數
API_KEY="your_api_key_here"
SERVICE_ID="your_service_id_here"
BASE_URL="https://api.render.com/v1/services"

# 獲取所有 jobs
echo "獲取所有 jobs..."
JOBS=$(curl --silent --request GET "$BASE_URL/$SERVICE_ID/jobs" \
     --header "Authorization: Bearer $API_KEY")

# 解析並顯示狀態
echo "$JOBS" | jq -r '.[] | "\(.id) - \(.startCommand) - \(.status) - \(.createdAt)"'
```

### 3. 手動觸發任務的腳本

```bash
#!/bin/bash

# 設置變數
API_KEY="your_api_key_here"
SERVICE_ID="your_service_id_here"
BASE_URL="https://api.render.com/v1/services"

# 檢查參數
if [ -z "$1" ]; then
    echo "使用方法: $0 <task-name>"
    echo "範例: $0 cleanup-reminders"
    exit 1
fi

TASK_NAME=$1

echo "觸發任務: $TASK_NAME"

# 創建 job
RESPONSE=$(curl --silent --request POST "$BASE_URL/$SERVICE_ID/jobs" \
     --header "Authorization: Bearer $API_KEY" \
     --header "Content-Type: application/json" \
     --data-raw "{
        \"startCommand\": \"node scripts/render-jobs.js $TASK_NAME\"
     }")

# 解析回應
JOB_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$JOB_ID" != "null" ]; then
    echo "任務已創建，Job ID: $JOB_ID"
    echo "你可以在 Render Dashboard 中查看執行狀態"
else
    echo "創建任務失敗:"
    echo "$RESPONSE"
fi
```

## 錯誤處理

### 常見錯誤

1. **401 Unauthorized**
   - 檢查 API Key 是否正確
   - 確認 API Key 是否已啟用

2. **404 Not Found**
   - 檢查 Service ID 是否正確
   - 確認服務是否存在

3. **400 Bad Request**
   - 檢查 `startCommand` 格式是否正確
   - 確認 JSON 格式是否有效

### 調試技巧

```bash
# 啟用詳細輸出
curl -v --request POST 'https://api.render.com/v1/services/YOUR_SERVICE_ID/jobs' \
     --header 'Authorization: Bearer YOUR_API_KEY' \
     --header 'Content-Type: application/json' \
     --data-raw '{
        "startCommand": "node scripts/render-jobs.js cleanup-reminders"
     }'
```

## 最佳實踐

1. **API Key 安全**
   - 不要將 API Key 提交到版本控制
   - 使用環境變數存儲 API Key
   - 定期輪換 API Key

2. **錯誤處理**
   - 實現適當的錯誤處理邏輯
   - 記錄 API 請求的響應

3. **監控**
   - 定期檢查任務執行狀態
   - 設置失敗通知

4. **資源管理**
   - 選擇合適的實例類型
   - 避免同時執行太多任務

## 參考文檔

- [Render API 文檔](https://render.com/docs/api)
- [One-Off Jobs 文檔](https://render.com/docs/one-off-jobs)
- [API 參考](https://api-docs.render.com/)
