# Meme 來源資料結構遷移文件

## 概述

本次遷移將 Meme 模型的 `source_url` 欄位升級為 `sources` 陣列，支援多個來源的引用，每個來源包含名稱和網址。

## 變更內容

### 後端變更

1. **資料模型更新** (`models/Meme.js`)
   - 移除 `source_url` 字串欄位
   - 新增 `sources` 陣列欄位，包含 `name` 和 `url` 子欄位
   - 加入完整的驗證規則

2. **資料結構**

   ```javascript
   // 舊格式
   source_url: 'https://example.com'

   // 新格式
   sources: [
     {
       name: '原始影片',
       url: 'https://example.com/video',
     },
     {
       name: '參考文章',
       url: 'https://example.com/article',
     },
   ]
   ```

### 前端變更

1. **投稿頁面** (`src/pages/memes/post.vue`)
   - 將單一輸入框改為動態新增的來源列表
   - 支援使用 "pi-plus" 圖示新增欄位
   - 每個來源包含名稱和網址輸入框

2. **編輯頁面** (`src/pages/memes/edit/[id].vue`)
   - 同樣支援動態來源管理
   - 自動轉換舊格式資料

## 遷移步驟

### 1. 執行遷移腳本

**Windows:**

```bash
scripts/run-meme-sources-migration.bat
```

**Linux/Mac:**

```bash
chmod +x scripts/run-meme-sources-migration.sh
./scripts/run-meme-sources-migration.sh
```

**手動執行:**

```bash
node scripts/migrations/2025-01-meme-sources-migration.js
```

### 2. 驗證遷移結果

遷移腳本會自動：

- 統計處理的迷因數量
- 報告成功/失敗/跳過的數量
- 驗證遷移完整性

### 3. 部署新版本

1. 部署後端更新
2. 部署前端更新
3. 測試新功能

## 向後相容性

- 舊的 `source_url` 欄位在資料庫中保留
- 前端會自動將舊格式轉換為新格式
- 遷移腳本會將現有資料轉換為新格式

## 功能特色

### 新增功能

- ✅ 支援多個來源引用
- ✅ 每個來源可自訂名稱
- ✅ 動態新增/移除來源欄位
- ✅ 完整的表單驗證
- ✅ 自動過濾空資料

### 使用者體驗

- ✅ 直觀的介面設計
- ✅ 即時驗證
- ✅ 清晰的錯誤提示
- ✅ 響應式設計

## 注意事項

1. **資料完整性**: 遷移過程中請確保資料庫備份
2. **測試環境**: 建議先在測試環境執行遷移
3. **監控**: 遷移後監控系統運行狀況
4. **回滾**: 如需回滾，可恢復資料庫備份

## 技術細節

### 驗證規則

- 來源名稱：必填，1-100字元
- 來源網址：必填，有效HTTP/HTTPS URL
- 陣列驗證：確保所有項目格式正確

### 效能考量

- 遷移腳本分批處理，避免記憶體溢出
- 資料庫索引保持不變
- 查詢效能不受影響

## 聯絡資訊

如有問題請聯繫開發團隊或查看相關文件。
