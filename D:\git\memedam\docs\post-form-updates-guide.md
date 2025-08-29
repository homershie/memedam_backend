# 投稿表單更新指南

## 概述

本次更新為投稿表單添加了三個主要功能：
1. 可編輯的 Slug 欄位
2. 來源（Source）和場景（Scene）選擇器
3. 變體/混剪（Variant）關聯功能

## 使用方法

### 1. 替換檔案

將 `post-updated.vue` 重命名為 `post.vue`：

```bash
cd D:\git\memedam\src\pages\memes
mv post.vue post-backup.vue
mv post-updated.vue post.vue
```

### 2. 安裝依賴

```bash
cd D:\git\memedam
npm install @vueuse/core
```

### 3. 功能說明

#### Slug 欄位
- 自動從標題生成建議值
- 支援手動編輯（只允許小寫字母、數字、連字號）
- 即時檢查唯一性（debounce 500ms）
- 顯示預覽 URL
- 系統保留字檢查

#### 來源選擇器
- 勾選「此迷因有來源？」啟用
- 搜尋既有來源（輸入 2+ 字元）
- 可創建新來源（包含 type、title、slug 等欄位）
- 選擇來源後可選擇場景
- 可創建新場景（包含時間、引言等）

#### 變體選擇器
- 勾選「這是某迷因的變體/混剪」啟用
- 搜尋既有迷因
- 顯示縮圖和作者資訊
- 自動提示系譜計算

## API 端點

所有 API 請求都使用 `apiService` 統一處理：

- `GET /api/memes/slug-available?slug=xxx` - 檢查 slug 唯一性
- `GET /api/sources/search?q=xxx&limit=10` - 搜尋來源
- `POST /api/sources` - 創建新來源
- `GET /api/sources/:id/scenes` - 獲取場景列表
- `POST /api/scenes` - 創建新場景
- `GET /api/memes/search?q=xxx&limit=10` - 搜尋迷因

## 檔案結構

```
D:\git\memedam\src\
├── pages\memes\
│   └── post.vue (更新後的投稿頁面)
├── components\
│   ├── SourceScenePicker.vue (來源/場景選擇器)
│   └── MemeRemoteSelect.vue (迷因變體選擇器)
└── services\
    ├── sourceService.js (來源 API 服務)
    └── sceneService.js (場景 API 服務)
```

## 注意事項

1. 所有欄位使用 snake_case 命名（source_id, scene_id, variant_of）
2. API 請求統一使用 `apiService.http` 或 `apiService.httpAuth`
3. 錯誤處理包含 409 slug 重複的特殊處理
4. 表單驗證會檢查所有必填欄位

## 測試建議

1. 測試 slug 自動生成和手動編輯
2. 測試來源搜尋和創建
3. 測試場景選擇和創建
4. 測試變體關聯
5. 測試表單提交和錯誤處理