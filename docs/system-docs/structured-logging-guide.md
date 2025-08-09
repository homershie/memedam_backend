# 結構化日誌系統使用指南

本專案已實施基於 Pino 的結構化日誌系統，適用於 Render 部署環境。

## 特色功能

- **JSON 結構化輸出**：適合外部日誌平台整合
- **環境適應**：開發環境自動美化，生產環境輸出 JSON
- **性能優化**：移除 pid/hostname 噪音
- **全域可用**：可透過 `globalThis.log` 或 `logger` 使用

## 基本用法

### 導入 logger

```javascript
import { logger } from '../utils/logger.js'
// 或使用全域對象
// globalThis.log (已自動設置)
```

### 基本日誌等級

```javascript
// 資訊日誌
logger.info('伺服器啟動完成')
log.info('分析監控啟動完成')

// 警告日誌
logger.warn({ userId: '123' }, '用戶嘗試訪問受限內容')

// 錯誤日誌  
logger.error({ error: err, userId: req.user._id }, '創建迷因失敗')

// 調試日誌
logger.debug({ query: searchQuery }, '執行搜索')
```

### 結構化資料

建議使用物件作為第一個參數來包含結構化資料：

```javascript
// ✅ 好的做法
logger.info({ 
  event: 'user_login',
  userId: user._id,
  provider: 'google',
  timestamp: new Date()
}, '用戶登入成功')

// ✅ 錯誤處理
logger.error({ 
  error: error.message,
  stack: error.stack,
  memeId: meme_id,
  userId: req.user._id 
}, '上傳迷因失敗')

// ❌ 避免的做法
logger.info(`用戶 ${userId} 登入成功`) // 非結構化
```

### HTTP 請求日誌

HTTP 請求已自動通過 `pino-http` 記錄：

```javascript
// index.js 中已配置
app.use(pinoHttp({ logger }))
```

### 環境配置

```bash
# 生產環境 (JSON 輸出)
NODE_ENV=production

# 開發環境 (美化輸出)
NODE_ENV=development

# 日誌等級設置
LOG_LEVEL=info  # debug, info, warn, error
```

## 實際範例

### 控制器中的使用

```javascript
// controllers/memeController.js
export const createMeme = async (req, res) => {
  try {
    const meme = await Meme.create(memeData)
    
    logger.info({ 
      event: 'meme_created',
      memeId: meme._id,
      userId: req.user._id,
      title: meme.title 
    }, '迷因創建成功')
    
    res.status(201).json(meme)
  } catch (error) {
    logger.error({ 
      error: error.message,
      userId: req.user._id,
      data: req.body 
    }, '迷因創建失敗')
    
    res.status(500).json({ error: '創建失敗' })
  }
}
```

### 服務層中的使用

```javascript
// utils/emailService.js
export const sendVerificationEmail = async (email, token) => {
  try {
    await sendGridClient.send(emailData)
    
    logger.info({ 
      event: 'verification_email_sent',
      email,
      tokenId: token._id 
    }, '驗證郵件發送成功')
    
  } catch (error) {
    logger.error({ 
      error,
      email,
      tokenId: token._id 
    }, '驗證郵件發送失敗')
    
    throw error
  }
}
```

## 日誌輸出格式

### 開發環境（美化格式）
```
[2024-01-20 10:30:15] INFO: 用戶登入成功
  event: "user_login"
  userId: "507f1f77bcf86cd799439011"
  provider: "google"
```

### 生產環境（JSON 格式）
```json
{
  "level": 30,
  "time": "2024-01-20T10:30:15.123Z",
  "event": "user_login",
  "userId": "507f1f77bcf86cd799439011", 
  "provider": "google",
  "msg": "用戶登入成功"
}
```

## 最佳實踐

1. **使用結構化資料**：總是包含相關的上下文資訊
2. **一致的事件命名**：使用 snake_case 格式，如 `user_login`, `meme_created`
3. **包含相關 ID**：userId, memeId, requestId 等追蹤標識
4. **適當的日誌等級**：
   - `debug`: 詳細的調試資訊
   - `info`: 一般業務事件
   - `warn`: 警告但不影響功能
   - `error`: 錯誤和異常情況
5. **錯誤處理**：總是記錄錯誤的完整上下文

## 外部平台整合

結構化的 JSON 日誌可以輕鬆整合到日誌聚合平台：

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Datadog**
- **New Relic**  
- **Splunk**
- **CloudWatch** (AWS)

Render 會自動收集 stdout/stderr，無需額外的檔案輪轉配置。