# Swagger API 文檔使用指南

## 概述

迷因典後端API使用Swagger自動生成API文檔，提供完整的API端點說明、參數定義和回應格式。

## 訪問API文檔

### 開發環境

- **Swagger UI**: http://localhost:4000/api-docs
- **API文檔JSON**: http://localhost:4000/api-docs.json

### 生產環境

- **Swagger UI**: https://api.memedam.com/api-docs
- **API文檔JSON**: https://api.memedam.com/api-docs.json

## 功能特色

### 1. 完整的API覆蓋

- ✅ 用戶管理 (Users)
- ✅ 認證系統 (Authentication)
- ✅ 迷因管理 (Memes)
- ✅ 標籤系統 (Tags)
- ✅ 推薦系統 (Recommendations)
- ✅ 分析監控 (Analytics)
- ✅ 互動功能 (Likes, Comments, Shares)
- ✅ 社交功能 (Follows, Collections)
- ✅ 管理功能 (Admin)

### 2. 詳細的Schema定義

- 所有數據模型的完整定義
- 請求/回應格式說明
- 參數驗證規則
- 錯誤代碼說明

### 3. 認證機制

- JWT Bearer Token認證
- 權限等級說明
- 公開/私有API標示

### 4. 互動式測試

- 直接在瀏覽器中測試API
- 自動填入認證Token
- 即時查看回應結果

## 使用方式

### 1. 瀏覽API文檔

1. 打開瀏覽器訪問 `/api-docs`
2. 查看不同分類的API端點
3. 點擊端點查看詳細說明

### 2. 測試API

1. 點擊想要測試的端點
2. 點擊 "Try it out" 按鈕
3. 填入必要參數
4. 點擊 "Execute" 執行測試

### 3. 認證設置

1. 點擊右上角的 "Authorize" 按鈕
2. 在Bearer Token欄位填入JWT Token
3. 點擊 "Authorize" 確認

## API分類說明

### Users (用戶管理)

- 用戶註冊、登入、登出
- 用戶資料管理
- 社群帳號綁定

### Authentication (認證)

- JWT Token管理
- Token刷新機制
- 社群登入流程

### Memes (迷因管理)

- 迷因CRUD操作
- 圖片上傳
- 標籤管理
- 協作編輯

### Tags (標籤系統)

- 標籤創建和管理
- 熱門標籤統計
- 標籤搜尋

### Recommendations (推薦系統)

- 多種推薦演算法
- 個人化推薦
- 混合推薦策略

### Analytics (分析監控)

- 推薦效果追蹤
- A/B測試管理
- 用戶行為分析

## 常見使用場景

### 1. 前端開發

```javascript
// 使用fetch測試API
const response = await fetch('/api/memes', {
  headers: {
    Authorization: 'Bearer your-jwt-token',
    'Content-Type': 'application/json',
  },
})
```

### 2. 移動端開發

```javascript
// React Native示例
const getMemes = async () => {
  try {
    const response = await fetch('https://api.memedam.com/api/memes')
    const data = await response.json()
    return data.memes
  } catch (error) {
    console.error('Error fetching memes:', error)
  }
}
```

### 3. 第三方整合

```python
# Python示例
import requests

def get_user_profile(user_id, token):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'https://api.memedam.com/api/users/{user_id}', headers=headers)
    return response.json()
```

## 錯誤處理

### 常見HTTP狀態碼

- `200` - 成功
- `201` - 創建成功
- `400` - 請求參數錯誤
- `401` - 未授權
- `403` - 權限不足
- `404` - 資源不存在
- `500` - 伺服器錯誤

### 錯誤回應格式

```json
{
  "error": "錯誤訊息",
  "status": 400,
  "details": {
    "field": "具體錯誤說明"
  }
}
```

## 開發建議

### 1. API版本控制

- 使用URL路徑版本控制 (`/api/v1/`)
- 向後兼容性考慮
- 版本遷移策略

### 2. 速率限制

- 認證端點特別限流
- 一般API標準限流
- 管理端點額外保護

### 3. 快取策略

- Redis快取熱門數據
- 快取失效機制
- 快取統計監控

### 4. 監控與日誌

- 效能監控
- 錯誤追蹤
- 用戶行為分析

## 更新文檔

### 添加新的API端點

1. 在對應的路由文件中添加Swagger註解
2. 定義請求和回應Schema
3. 說明參數和權限要求
4. 測試API功能

### 更新現有文檔

1. 修改路由文件中的Swagger註解
2. 更新Schema定義
3. 重新啟動伺服器
4. 驗證文檔更新

## 技術細節

### Swagger配置

- OpenAPI 3.0.0 規範
- 自動掃描路由文件
- 自定義UI主題
- 多環境支援

### 安全性

- JWT Token認證
- 權限等級控制
- 輸入驗證
- SQL注入防護

### 效能優化

- 資料庫索引
- Redis快取
- 圖片CDN
- 負載均衡

## 支援與聯絡

如有任何問題或建議，請聯絡開發團隊：

- Email: support@memedam.com
- GitHub: https://github.com/memedam/backend
- 文檔更新: 提交Pull Request

---

_最後更新: 2024年_
