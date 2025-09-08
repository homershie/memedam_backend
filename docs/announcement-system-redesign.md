# 公告系統重新設計文檔

## 概述

本文檔詳細說明公告系統的重新設計方案，包含後端模型調整、前端組件更新以及完整的實作細節。

## 背景

目前的公告系統存在以下問題：

1. `content` 欄位只支援純文字，無法滿足富文本編輯需求
2. 前端預覽邏輯簡單，無法正確處理複雜內容
3. 無法與 Meme 系統保持一致的內容格式

## 設計目標

1. **支援富文本編輯**：整合 TipTap 編輯器，支援格式化文字、連結、圖片等
2. **一致的內容格式**：與 Meme 系統的 `detail_content` 保持類似的設計理念
3. **靈活的格式支援**：同時支援純文字和 JSON 格式，向後相容
4. **優化的預覽體驗**：在列表頁面和卡片中提供準確的內容預覽

## 後端設計

### 1. 資料庫模型調整

#### Announcement.js 更新

```javascript
// memedam_backend/models/Announcement.js

// 公告內容（支援純文字或結構化JSON）
content: {
  type: mongoose.Schema.Types.Mixed, // 支援純文字或JSON物件
  required: [true, '公告內容為必填'],
  validate: {
    validator: function (v) {
      if (v === null || v === undefined) return false
      if (typeof v === 'string') {
        return v.trim().length >= 1 && v.length <= 10000 // 純文字長度限制
      }
      if (typeof v === 'object') {
        return v && typeof v === 'object' // JSON格式驗證
      }
      return false
    },
    message: '公告內容格式不正確',
  },
},

// 內容格式類型（用於區分純文字或JSON）
content_format: {
  type: String,
  enum: ['plain', 'json'],
  default: 'plain',
  required: true,
},
```

### 2. 控制器驗證邏輯

#### announcementController.js 更新

```javascript
// memedam_backend/controllers/announcementController.js

export const validateCreateAnnouncement = [
  body('title').isLength({ min: 1, max: 100 }).withMessage('標題必填，且長度需在 1~100 字'),
  body('content').custom((value) => {
    if (typeof value === 'string') {
      if (value.trim().length < 1) throw new Error('內容不能為空')
      if (value.length > 10000) throw new Error('內容長度不能超過10000字')
    } else if (typeof value === 'object') {
      if (!value) throw new Error('JSON內容不能為空')
    } else {
      throw new Error('內容格式不正確')
    }
    return true
  }),
  body('content_format')
    .optional()
    .isIn(['plain', 'json'])
    .withMessage('內容格式必須是 plain 或 json'),
]
```

## 前端設計

### 1. 共用工具函數

#### contentUtils.js

建立共用的內容處理工具函數，支援：

- 從 JSON 內容提取純文字
- 將 JSON 內容渲染為 HTML
- 內容截斷功能
- 格式驗證

```javascript
// memedam/src/utils/contentUtils.js

// 主要功能函數
export const extractTextFromJson = (content) => {
  /* ... */
}
export const renderContentToHtml = (content, format = 'plain') => {
  /* ... */
}
export const truncateContent = (content, format = 'plain', maxLength = 60) => {
  /* ... */
}
export const validateContent = (content, format = 'plain') => {
  /* ... */
}
export const getContentStats = (content, format = 'plain') => {
  /* ... */
}
```

### 2. 組件更新

#### AnnouncementCard.vue 更新

```javascript
// memedam/src/components/AnnouncementCard.vue

import { extractTextFromJson, truncateContent } from '@/utils/contentUtils'

// 取得內容預覽（支援JSON和純文字）
const getContentPreview = (content, maxLength = 60) => {
  if (!content) return '無內容'

  let plainText = ''

  // 如果是JSON格式，解析並提取純文字
  if (typeof content === 'object' && content !== null) {
    plainText = extractTextFromJson(content)
  } else {
    // 純文字格式，移除HTML標籤
    plainText = String(content).replace(/<[^>]*>/g, '')
  }

  // 限制字數
  return plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText
}
```

#### 公告詳情頁面更新

```javascript
// memedam/src/pages/announcements/[id].vue

import { renderContentToHtml, extractTextFromJson } from '@/utils/contentUtils'

// 格式化內容顯示
const formatContent = (content, format = 'plain') => {
  if (!content) return ''

  if (format === 'json' && typeof content === 'object') {
    return renderContentToHtml(content, 'json')
  }

  // 純文字格式，轉換換行符
  return String(content).replace(/\n/g, '<br>')
}

// 截斷內容
const truncateContent = (content, format = 'plain', maxLength) => {
  if (!content) return ''

  const plainText = format === 'json' ? extractTextFromJson(content) : String(content)

  return plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText
}
```

#### 公告列表頁面更新

```javascript
// memedam/src/pages/announcements/index.vue

import { truncateContent } from '@/utils/contentUtils'

const truncate = (content, format = 'plain', maxLength = 120) => {
  return truncateContent(content, format, maxLength)
}
```

### 3. 後台管理頁面更新

#### announcements.vue 更新

```javascript
// memedam/src/pages/admin/announcements.vue

<template>
  <!-- 內容編輯區域 -->
  <div>
    <label for="content" class="block font-bold mb-3">內容</label>
    <TipTapEditor
      v-model="announcement.content"
      :output-json="true"
      class="border rounded-lg"
      placeholder="請輸入公告內容..."
    />
    <small v-if="submitted && !announcement.content" class="text-red-500">
      內容為必填項目。
    </small>
  </div>
</template>
```

## 實作範例

### 1. 純文字格式（相容性設計）

```javascript
{
  content: "這是一則簡單的公告內容",
  content_format: "plain"
}
```

### 2. JSON格式（支援富文本）

```javascript
{
  content: {
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "這是一則" },
          { type: "text", text: "重要", marks: [{ type: "bold" }] },
          { type: "text", text: "公告" }
        ]
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "包含" },
          {
            type: "text",
            text: "連結",
            marks: [{
              type: "link",
              attrs: { href: "https://example.com" }
            }]
          }
        ]
      }
    ]
  },
  content_format: "json"
}
```

## 支援的 TipTap 功能

### 文字格式

- **粗體** (`<strong>`)
- _斜體_ (`<em>`)
- <u>底線</u> (`<u>`)
- ~~刪除線~~ (`<del>`)
- `程式碼` (`<code>`)

### 結構元素

- 標題 H1-H3 (`<h1>`, `<h2>`, `<h3>`)
- 段落 (`<p>`)
- 引用 (`<blockquote>`)
- 清單（有序/無序） (`<ul>`, `<ol>`, `<li>`)

### 進階功能

- 連結 (`<a>`)
- 分隔線 (`<hr>`)
- 圖片嵌入（未來支援）
- 影片嵌入（未來支援）

## 實作說明

本次實作將直接採用新設計，舊公告將會刪除重傳。

### 實作順序

1. **資料庫結構調整**：直接更新 `Announcement.js` 模型
2. **後端驗證邏輯**：更新控制器驗證規則
3. **前端工具函數**：建立 `contentUtils.js` 共用工具
4. **組件更新**：逐一更新各個組件使用新的工具函數
5. **後台整合**：整合 TipTap 編輯器到管理介面
6. **測試驗證**：確保新格式內容能正常運作
7. **資料清理**：刪除舊公告，重新建立新內容

## 測試案例

### 1. 自動格式辨識測試

```javascript
// 測試自動判斷格式功能
const plainContent = '這是純文字內容'
const jsonContent = {
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World', marks: [{ type: 'bold' }] },
      ],
    },
  ],
}

// 無需指定格式，系統會自動判斷
console.log(truncateContent(plainContent, null, 10)) // "這是純文字..."
console.log(truncateContent(jsonContent, null, 20)) // "Hello World"
```

### 2. 富文本渲染測試

```javascript
// 測試完整的富文本渲染
const richContent = {
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '這是' },
        { type: 'text', text: '粗體文字', marks: [{ type: 'bold' }] },
        { type: 'text', text: '和' },
        {
          type: 'text',
          text: '連結',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
      ],
    },
  ],
}

console.log(renderContentToHtml(richContent, 'json'))
// 輸出: <p>這是<strong>粗體文字</strong>和<a href="https://example.com">連結</a></p>
```

## 效能考量

### 快取策略

- 內容解析結果可以快取，避免重複計算
- 預覽文字生成可以快取
- HTML渲染結果可以快取

### 記憶體管理

- 及時清理大型 JSON 物件
- 使用物件池重用常用元素
- 避免在渲染過程中建立過多臨時物件

## 錯誤處理

### 前端錯誤處理

```javascript
try {
  const html = renderContentToHtml(content, format)
  // 使用渲染結果
} catch (error) {
  console.error('內容渲染失敗:', error)
  // 顯示錯誤訊息或備用內容
}
```

### 後端錯誤處理

```javascript
try {
  // 處理內容
} catch (error) {
  console.error('內容處理失敗:', error)
  // 返回預設值或錯誤訊息
}
```

## 擴展性設計

### 未來支援的功能

1. **圖片上傳和嵌入**
2. **影片嵌入**
3. **表格支援**
4. **數學公式**
5. **程式碼高亮**
6. **註腳和參考文獻**

### 自訂渲染器

```javascript
// 自訂渲染器介面
interface ContentRenderer {
  render(node: any): string
  extractText(node: any): string
}

// 註冊自訂渲染器
registerRenderer('custom', new CustomRenderer())
```

## 總結

這次重新設計讓公告系統具備了以下優點：

1. **強大的編輯能力**：支援完整的富文本編輯功能
2. **一致的架構設計**：與 Meme 系統保持一致
3. **良好的可維護性**：共用工具函數，集中管理邏輯
4. **智慧內容處理**：自動判斷並處理不同格式的內容
5. **優化的使用者體驗**：更好的預覽和顯示效果

通過這次重新設計，公告系統將能夠提供更豐富的內容呈現方式，同時保持良好的開發體驗和系統效能。

---

_最後更新：2024-12-19_
_相關檔案：`Announcement.js`, `contentUtils.js`, `TipTapEditor.vue`_
