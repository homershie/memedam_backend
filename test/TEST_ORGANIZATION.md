# 測試組織結構

## 目錄結構

```
test/
├── setup.js                 # 全局測試設置
├── unit/                    # 單元測試
│   ├── models/             # Model 層測試
│   ├── controllers/        # Controller 層測試
│   ├── utils/              # 工具函數測試
│   ├── admin/              # 管理功能測試
│   ├── api/                # API 邏輯測試
│   ├── auth/               # 認證相關測試
│   ├── email/              # 郵件功能測試
│   ├── oauth/              # OAuth 測試
│   └── rate-limit/         # 速率限制測試
├── integration/            # 整合測試
│   ├── admin/              # 管理功能整合測試
│   ├── middleware/         # 中間件整合測試
│   ├── services/           # 服務層整合測試
│   └── workflows/          # 工作流程整合測試
└── e2e/                    # 端對端測試
    ├── api/                # API 端對端測試
    ├── critical-flows/     # 關鍵流程測試
    └── user-journeys/      # 用戶旅程測試
```

## 測試分類原則

### 單元測試 (Unit Tests)
- 完全 Mock 外部依賴
- 快速執行
- 隔離測試單一功能
- 無副作用

### 整合測試 (Integration Tests)
- 使用記憶體資料庫
- 測試組件間交互
- 中等執行速度

### 端對端測試 (E2E Tests)
- 模擬真實用戶操作
- 完整流程測試
- 較慢執行速度
