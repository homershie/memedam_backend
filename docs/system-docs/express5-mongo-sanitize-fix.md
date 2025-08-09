# Express 5 與 MongoDB 消毒中間件相容性修復

## 問題描述

在部署到生產環境時，出現以下錯誤：

```
TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
    at /opt/render/project/src/node_modules/express-mongo-sanitize/index.js:113:18
```

## 根本原因

- **Express 版本**: 5.1.0
- **express-mongo-sanitize 版本**: 2.2.0

在 Express 5 中，`req.query` 屬性被設為唯讀（只有 getter），而 `express-mongo-sanitize` 嘗試直接修改該屬性，導致 TypeError。

## 解決方案

### 1. 移除舊的依賴

從 `package.json` 中移除 `express-mongo-sanitize`：

```json
// 移除這行
"express-mongo-sanitize": "^2.2.0",
```

### 2. 實作自定義 MongoDB 消毒中間件

創建了 `utils/mongoSanitize.js`，提供與 Express 5 相容的 MongoDB 注入防護功能：

**主要特性：**
- 移除或替換危險的 MongoDB 操作符（`$` 開頭的鍵）
- 移除或替換包含點號的鍵名（防止欄位路徑注入）
- 處理巢狀物件和陣列
- 兼容 Express 5 的唯讀 `req.query` 屬性
- 支援 `req.body`、`req.query` 和 `req.params` 的清理

### 3. 更新 index.js

```javascript
// 舊的 import
import mongoSanitize from 'express-mongo-sanitize'

// 新的 import
import mongoSanitize from './utils/mongoSanitize.js'

// 使用方式保持不變
app.use(mongoSanitize())
```

## 實作細節

### 核心功能

```javascript
// 基本使用
app.use(mongoSanitize())

// 使用替換選項（將危險字符替換為指定字符）
app.use(mongoSanitize({ 
  replaceWith: true, 
  replacement: '_' 
}))

// 只處理 body（跳過 query 和 params）
app.use(mongoSanitize({ onlyBody: true }))
```

### Express 5 相容性處理

對於 `req.query` 的唯讀限制，使用 `Object.defineProperty` 重新定義屬性：

```javascript
Object.defineProperty(req, 'query', {
  value: sanitizedQuery,
  writable: true,
  configurable: true,
  enumerable: true
})
```

## 測試驗證

修復後的應用程式不再產生 MongoDB 消毒相關的錯誤，成功解決了 Express 5 的相容性問題。

## 安全性

自定義中間件提供與原 `express-mongo-sanitize` 相同等級的安全防護：

1. **防止 MongoDB 操作符注入**：移除 `$where`、`$ne`、`$gt` 等危險操作符
2. **防止欄位路徑注入**：移除包含點號的鍵名如 `user.role`
3. **遞迴清理**：處理深層巢狀的物件和陣列

## 建議

- 定期檢查 `express-mongo-sanitize` 的更新，未來版本可能會支援 Express 5
- 考慮在測試環境中驗證所有安全功能正常運作
- 監控生產環境日誌，確保沒有安全相關的錯誤

---

**修復日期**: 2025-08-09  
**影響**: 修復生產環境部署錯誤，確保 MongoDB 注入防護正常運作