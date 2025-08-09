# Render One-Off Jobs 使用指南

## 概述

這個專案已經準備好使用 Render 的 One-Off Jobs 功能來執行定期任務。這些任務原本是通過 `node-cron` 在應用程式中定期執行的，但使用 One-Off Jobs 可以：

- 降低主應用程式的負載
- 更好的資源管理
- 更靈活的排程
- 更好的監控

## 快速開始

### 1. 可用的任務

#### 用戶管理

- `cleanup-reminders` - 發送帳號刪除提醒
- `cleanup-users` - 刪除未驗證用戶

#### 通知系統

- `hot-content-notifications` - 發送熱門內容通知
- `weekly-summary-notifications` - 發送週報摘要通知
- `cleanup-notifications` - 清理舊通知

#### 推薦系統

- `update-hot-scores` - 更新熱門分數
- `update-content-based` - 更新內容基礎推薦
- `update-collaborative` - 更新協同過濾推薦
- `update-social-collaborative` - 更新社交協同過濾推薦
- `update-all-recommendations` - 更新所有推薦系統

#### 維護任務

- `check-meme-counts` - 檢查並修正迷因計數
- `check-user-counts` - 檢查並修正用戶計數

### 2. 在 Render 中設置

1. 登入 [Render Dashboard](https://dashboard.render.com)
2. 選擇你的專案
3. 點擊 "New" → "One-Off Job"
4. 選擇你的主服務作為 base service
5. 設置以下參數：
   - **Name**：任務名稱（例如：`cleanup-reminders`）
   - **Start Command**：`node scripts/render-jobs.js cleanup-reminders`
   - **Instance Type**：根據任務複雜度選擇（建議從 Standard 開始）

### 3. 測試腳本

在本地測試腳本：

```bash
# 測試所有可用命令
node scripts/test-render-jobs.js

# 測試特定命令
node scripts/test-render-jobs.js cleanup-reminders
node scripts/test-render-jobs.js update-hot-scores
```

## 詳細文檔

- [完整使用指南](docs/render-one-off-jobs.md)
- [API 文檔](docs/api-docs/)

## 遷移計劃

### 第一階段：設置和測試

- [x] 創建 One-Off Jobs 腳本
- [x] 創建測試腳本
- [x] 編寫文檔
- [ ] 在 Render 中設置 One-Off Jobs
- [ ] 測試每個任務的執行

### 第二階段：逐步遷移

- [ ] 將任務從 node-cron 遷移到 One-Off Jobs
- [ ] 設置適當的監控和警報
- [ ] 更新團隊培訓

### 第三階段：完全遷移

- [ ] 移除 node-cron 依賴
- [ ] 清理舊的代碼
- [ ] 最終測試和驗證

## 支援

如果遇到問題，請：

1. 查看 [完整文檔](docs/render-one-off-jobs.md)
2. 檢查 [故障排除指南](docs/render-one-off-jobs.md#故障排除)
3. 聯繫開發團隊
