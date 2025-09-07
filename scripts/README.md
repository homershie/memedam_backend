# Scripts 目錄結構說明

本目錄包含了專案中使用的各種工具腳本，按功能分類組織以提升維護性。

## 目錄結構

```
scripts/
├── diagnostics/          # 系統診斷腳本
│   ├── diagnose-notifications.js
│   ├── diagnose-redis-queue.js
│   └── README-diagnostics.md
├── maintenance/          # 系統維護腳本
│   ├── cleanupNotifications.js
│   └── clear-cache.js
├── data/                 # 測試資料腳本
│   ├── create-test-announcements.js
│   └── create-test-reports.js
└── runners/              # 應用啟動腳本
    ├── notification-worker.js
    ├── start-dev.js
    ├── start-prod.js
    └── start-test.js
```

## 各目錄說明

### diagnostics/ - 系統診斷腳本

用於診斷系統各個組件健康的 Vitest 測試腳本。

**常用命令：**

```bash
# 診斷通知系統
npm run diagnose:notifications

# 診斷 Redis 隊列
npm run diagnose:redis-queue

# 執行所有診斷
npm run diagnose:all
```

詳細說明請參閱 [`diagnostics/README-diagnostics.md`](diagnostics/README-diagnostics.md)

### maintenance/ - 系統維護腳本

用於清理和維護系統的腳本。

**腳本說明：**

- `cleanupNotifications.js` - 清理過期的通知事件和收件狀態
- `clear-cache.js` - 清除推薦系統相關的快取

### data/ - 測試資料腳本

用於創建測試資料的腳本。

**腳本說明：**

- `create-test-announcements.js` - 創建測試公告資料
- `create-test-reports.js` - 創建測試檢舉資料

### runners/ - 應用啟動腳本

用於啟動應用程式的腳本。

**腳本說明：**

- `start-dev.js` - 開發環境啟動腳本
- `start-prod.js` - 生產環境啟動腳本
- `start-test.js` - 測試環境啟動腳本
- `notification-worker.js` - 通知隊列工作者

**常用命令：**

```bash
# 啟動開發環境
npm run start:dev

# 啟動生產環境
npm run start:prod

# 啟動測試環境
npm run start:test

# 啟動通知工作者
npm run notification-worker
```

## 開發指南

### 添加新腳本

1. 根據腳本用途選擇合適的子目錄
2. 如果沒有適合的目錄，請考慮創建新的子目錄
3. 更新此 README.md 文件
4. 在 `package.json` 中添加對應的 npm script（如需要）

### 腳本命名規範

- 使用小寫字母和連字符號
- 清楚描述腳本的功能
- 對於測試腳本，使用 `test-` 前綴
- 對於診斷腳本，使用 `diagnose-` 前綴

## 注意事項

- 診斷腳本必須使用 Vitest 運行，不能直接用 Node.js 執行
- 所有腳本都應包含適當的錯誤處理
- 建議為重要的腳本添加說明文檔
