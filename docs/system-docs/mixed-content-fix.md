# Mixed Content 錯誤修復指南

## 問題描述

當前端部署在 HTTPS 環境 (`https://www.memedam.com`) 時，如果嘗試載入 HTTP 資源，瀏覽器會顯示 `blocked:mixed-content` 錯誤。

## 錯誤原因

1. **前端使用 HTTPS**：`https://www.memedam.com`
2. **後端可能使用 HTTP**：程式碼中有多處使用 `http://localhost:4000` 或 `http://` 開頭的 URL
3. **瀏覽器安全政策**：現代瀏覽器會阻止 HTTPS 頁面載入 HTTP 資源

## 解決方案

### 1. 更新 CORS 配置

在 `index.js` 中更新了 CORS 配置：

```javascript
// 定義允許的來源
const allowedOrigins = [
  'https://memedam.com',
  'https://www.memedam.com',
  'https://api.memedam.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4000',
]

// 安全性中間件
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }),
)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      return allowedOrigins.includes(origin)
        ? callback(null, true)
        : callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
)
```

### 2. 更新 Swagger 配置

在 `config/swagger.js` 中更新了伺服器配置：

```javascript
servers: [
  {
    url: process.env.NODE_ENV === 'production' ? 'https://api.memedam.com' : 'http://localhost:4000',
    description: process.env.NODE_ENV === 'production' ? '生產環境' : '開發環境',
  },
  {
    url: 'https://api.memedam.com',
    description: '生產環境',
  },
],
```

### 3. 更新環境變數配置

在 `.env` 檔案中添加：

```bash
# API基礎URL配置（重要！）
# 開發環境：http://localhost:4000
# 生產環境：https://api.memedam.com
API_BASE_URL=http://localhost:4000

# 前端URL配置（重要！）
# 開發環境：http://localhost:5173
# 生產環境：https://memedam.com
FRONTEND_URL=http://localhost:5173
```

### 4. 更新 Email 服務

在 `utils/emailService.js` 中更新了 URL 配置：

```javascript
// 驗證 email
const verificationUrl = `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:3000')}/verify?token=${verificationToken}`

// 密碼重設 email
const resetUrl = `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:3000')}/reset-password?token=${resetToken}`
```

### 5. 更新用戶清理服務

在 `utils/userCleanupScheduler.js` 中更新了 URL 配置：

```javascript
const frontendUrl =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:3000')
```

## 部署檢查清單

### 生產環境配置

1. **環境變數設定**：

   ```bash
   NODE_ENV=production
   API_BASE_URL=https://api.memedam.com
   FRONTEND_URL=https://memedam.com
   ```

2. **CORS 配置**：確保允許 `https://memedam.com` 和 `https://www.memedam.com`

3. **HTTPS 配置**：確保所有 API 端點都使用 HTTPS

4. **SSL 憑證**：確保 API 伺服器有有效的 SSL 憑證

### 開發環境配置

1. **環境變數設定**：
   ```bash
   NODE_ENV=development
   API_BASE_URL=http://localhost:4000
   FRONTEND_URL=http://localhost:5173
   ```

## 測試步驟

### 1. 檢查 CORS 配置

```bash
# 測試 CORS 配置
curl -H "Origin: https://www.memedam.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://api.memedam.com/api/health
```

### 2. 檢查 API 端點

```bash
# 測試 API 端點
curl -H "Origin: https://www.memedam.com" \
     https://api.memedam.com/api/health
```

### 3. 檢查前端請求

在瀏覽器開發者工具中檢查：

- Network 標籤中的請求是否都使用 HTTPS
- Console 標籤中是否有 mixed-content 錯誤

## 常見問題

### Q: 為什麼還是有 mixed-content 錯誤？

A: 檢查以下幾點：

1. 確保所有 API 請求都使用 HTTPS
2. 確保環境變數正確設定
3. 確保 CORS 配置正確
4. 清除瀏覽器快取

### Q: 開發環境需要 HTTPS 嗎？

A: 不需要。開發環境可以繼續使用 HTTP，只有生產環境需要 HTTPS。

### Q: 如何強制使用 HTTPS？

A: 在生產環境中，可以添加重定向中間件：

```javascript
// 強制 HTTPS 重定向（僅生產環境）
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`)
    } else {
      next()
    }
  })
}
```

## 相關文件

- [CORS 配置指南](./cors-configuration.md)
- [環境變數設定](./environment-variables.md)
- [SSL 憑證配置](./ssl-certificate.md)
