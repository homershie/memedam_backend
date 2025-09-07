# SEO 功能測試說明

本文件介紹新加入的 SEO 監控功能的測試文件和運行方式。

## 測試文件結構

### 單元測試

- `test/unit/controllers/seoController.test.js` - SEO 控制器單元測試
  - 測試所有控制器方法的邏輯
  - 驗證錯誤處理和邊界情況
  - 模擬外部依賴（Redis、Logger等）

### 整合測試

- `test/integration/services/seoMonitor.test.js` - SEO 監控服務整合測試
  - 測試 SEO 監控器的完整功能
  - 驗證指標收集、警報系統、報告生成
  - 測試與 Redis 的整合

- `test/integration/api/seo-routes.test.js` - SEO 路由 API 整合測試
  - 測試所有 SEO API 端點
  - 驗證認證和授權
  - 測試請求響應格式和錯誤處理

### 測試助手

- `test/integration/api/seo-test-helpers.js` - SEO 測試助手函數
  - 提供模擬數據和測試工具
  - 包含 JWT 令牌生成
  - Redis 模擬設置助手

## 測試涵蓋的功能

### SEO 控制器測試

- ✅ 監控狀態獲取
- ✅ 最新指標獲取
- ✅ SEO 報告生成和檢索
- ✅ 報告列表管理
- ✅ 活躍警報管理
- ✅ 警報解析功能
- ✅ SEO 建議生成
- ✅ 健康檢查執行
- ✅ 儀表板數據聚合
- ✅ 監控啟動/停止
- ✅ 錯誤處理和邊界情況

### SEO 監控服務測試

- ✅ 監控器初始化和配置
- ✅ 性能指標收集
- ✅ SEO 健康檢查
- ✅ 搜尋引擎指標更新
- ✅ 警報系統（性能、SEO、搜尋引擎）
- ✅ 每日報告生成
- ✅ 建議生成算法
- ✅ 工具方法（平均值計算、趨勢分析等）
- ✅ 整體分數計算
- ✅ 數據限制和清理

### SEO 路由測試

- ✅ 所有 API 端點的 HTTP 方法
- ✅ JWT 認證中介軟體
- ✅ 請求參數驗證
- ✅ 響應格式驗證
- ✅ 錯誤響應處理
- ✅ Swagger 文檔完整性

## 運行測試

### 運行所有 SEO 測試

```bash
# 運行所有 SEO 相關測試
npm test -- --testPathPattern="seo"

# 或使用 Vitest 直接運行
npx vitest run test/unit/controllers/seoController.test.js
npx vitest run test/integration/services/seoMonitor.test.js
npx vitest run test/integration/api/seo-routes.test.js
```

### 運行特定測試類別

```bash
# 只運行單元測試
npm test -- --testPathPattern="unit.*seo"

# 只運行整合測試
npm test -- --testPathPattern="integration.*seo"

# 只運行控制器測試
npx vitest run test/unit/controllers/seoController.test.js

# 只運行服務測試
npx vitest run test/integration/services/seoMonitor.test.js

# 只運行路由測試
npx vitest run test/integration/api/seo-routes.test.js
```

### 測試覆蓋率

```bash
# 生成測試覆蓋率報告
npm run test:coverage -- --testPathPattern="seo"
```

## 測試依賴

### 外部依賴模擬

- **Redis**: 使用 `redis.js` 模擬所有 Redis 操作
- **Logger**: 使用 `logger.js` 模擬日誌記錄
- **JWT**: 測試中使用固定的測試密鑰

### 測試數據

- 使用 `seo-test-helpers.js` 中的模擬數據
- 包含完整的 SEO 指標、警報、建議等測試數據
- 支持隨機數據生成用於邊界測試

## 測試最佳實踐

### 1. 模擬策略

- 所有外部依賴都被適當模擬
- Redis 操作使用記憶體模擬
- 網路請求被完全隔離

### 2. 測試隔離

- 每個測試都有獨立的模擬設置
- 測試後會清理所有模擬狀態
- 不依賴外部服務或資料庫

### 3. 錯誤測試

- 測試所有錯誤路徑
- 驗證錯誤響應格式
- 測試邊界條件和異常輸入

### 4. 效能考慮

- 測試包含適當的超時設置
- 大量數據測試有性能優化
- 非同步操作正確處理

## 測試指標

### 涵蓋率目標

- **語句覆蓋率**: > 90%
- **分支覆蓋率**: > 85%
- **函數覆蓋率**: > 95%
- **行覆蓋率**: > 90%

### 測試類型分佈

- **單元測試**: 70% - 測試個別函數和方法
- **整合測試**: 30% - 測試組件間互動

## CI/CD 整合

### 持續整合

```yaml
# 在 GitHub Actions 或其他 CI 中
- name: Run SEO Tests
  run: npm test -- --testPathPattern="seo" --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
    flags: seo-tests
```

### 品質門檻

- 所有測試必須通過
- 覆蓋率不得低於設定閾值
- 不允許有測試失敗

## 故障排除

### 常見問題

1. **Redis 連接錯誤**: 確保測試環境中的 Redis 模擬正確設置
2. **JWT 令牌錯誤**: 檢查測試令牌的生成和驗證
3. **模擬數據錯誤**: 驗證模擬數據結構與實際匹配

### 調試技巧

1. 使用 `console.log` 在測試中輸出調試資訊
2. 檢查 Vitest 的詳細輸出：`npx vitest run --reporter=verbose`
3. 使用 `--inspect` 調試模式：`npx vitest run --inspect`

## 維護指南

### 添加新測試

1. 確定測試類型（單元/整合）
2. 遵循現有的命名和結構慣例
3. 使用適當的模擬和測試數據
4. 確保測試覆蓋所有代碼路徑

### 更新測試

1. 當功能變更時及時更新測試
2. 保持測試數據與實際數據結構同步
3. 定期檢查和更新測試依賴

### 測試重構

1. 保持測試代碼的清晰和可維護性
2. 使用描述性的測試名稱
3. 適當使用 `describe` 和 `it` 的巢狀結構
4. 提取重複的測試邏輯到助手函數

## 相關文檔

- [專案測試總體說明](../TEST_ORGANIZATION.md)
- [SEO 監控系統實作](./docs/seo-monitoring-system-implementation.md)
- [API 文檔](./docs/API.md)
- [Vitest 配置](../../vitest.config.js)
