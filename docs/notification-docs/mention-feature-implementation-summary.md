# 提及功能後端實現總結

## 概述
本文檔總結了為支持前端提及功能而進行的後端更新。

## 實現的功能

### 1. 用戶搜索 API
**端點**: `GET /api/users/search`

**參數**:
- `q` (必需): 搜索關鍵字
- `limit` (可選): 返回結果數量限制 (1-50，默認10)

**返回格式**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "用戶ID",
      "username": "用戶名",
      "display_name": "顯示名稱",
      "avatar": "頭像URL",
      "bio": "個人簡介",
      "follower_count": 追蹤者數量,
      "meme_count": 迷因數量
    }
  ],
  "count": 返回的用戶數量
}
```

**特性**:
- 根據用戶名和顯示名稱進行模糊搜索
- 按追蹤者數量和迷因數量排序
- 參數驗證和錯誤處理
- 完整的 Swagger 文檔

### 2. Comment 模型更新
**新增字段**: `mentioned_users`

**字段定義**:
```javascript
mentioned_users: [{
  type: String,
  trim: true,
  maxlength: [50, '用戶名長度不能超過50字元'],
  validate: {
    validator: function(v) {
      if (!v) return true
      // 驗證用戶名格式（只允許字母、數字、下劃線）
      return /^[a-zA-Z0-9_]+$/.test(v)
    },
    message: '用戶名只能包含字母、數字和下劃線'
  }
}]
```

**功能**:
- 存儲被提及的用戶名列表
- 自動去重
- 格式驗證

### 3. 通知服務 (已存在)
**文件**: `utils/notificationService.js`

**函數**: `createMentionNotifications`

**功能**:
- 解析內容中的 @提及
- 查找被提及的用戶
- 發送通知給被提及的用戶
- 避免給自己發送通知

### 4. 評論控制器更新
**文件**: `controllers/commentController.js`

**新增功能**:
- `extractMentionedUsers` 輔助函數
- 在創建評論時自動提取並保存提及的用戶名
- 與通知服務集成

## 技術細節

### 提及解析邏輯
```javascript
const extractMentionedUsers = (content) => {
  const mentionRegex = /@(\w+)/g
  const mentions = content.match(mentionRegex)
  
  if (!mentions || mentions.length === 0) return []
  
  // 移除 @ 符號並去重
  const usernames = mentions.map(mention => mention.substring(1))
  return [...new Set(usernames)] // 去重
}
```

### 搜索邏輯
```javascript
const users = await User.find({
  $or: [
    { username: { $regex: searchQuery, $options: 'i' } },
    { display_name: { $regex: searchQuery, $options: 'i' } }
  ]
})
.select('username display_name avatar bio follower_count meme_count')
.limit(limitNum)
.sort({ follower_count: -1, meme_count: -1 })
```

## API 使用示例

### 搜索用戶
```bash
GET /api/users/search?q=john&limit=5
```

### 創建帶提及的評論
```bash
POST /api/comments
{
  "content": "這是一個很棒的迷因！@john @alice 你們也來看看",
  "meme_id": "迷因ID"
}
```

評論將自動保存：
- `content`: 原始內容
- `mentioned_users`: ["john", "alice"]

## 數據庫變更
- Comment 集合添加了 `mentioned_users` 字段
- 無需進行數據遷移，現有評論的該字段為空數組

## 前後端集成
1. 前端可以使用搜索 API 實現用戶名自動完成
2. 評論中的提及會自動解析並發送通知
3. 被提及的用戶會收到實時通知

## 測試
創建了測試腳本 `test/mention-feature-test.js` 用於驗證功能：
```bash
node test/mention-feature-test.js
```

## 安全考慮
- 搜索 API 有速率限制
- 用戶名格式驗證
- 參數長度限制
- 防止給自己發送通知

## 性能優化
- 用戶名搜索使用索引
- 通知異步發送，不阻塞評論創建
- 搜索結果數量限制
- 提及用戶去重