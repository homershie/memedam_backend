# Vitest 遷移指南

## 🚀 為什麼要導入 Vitest？

### 目前測試問題

- ❌ 80+ 個分散的測試腳本
- ❌ 沒有統一的測試框架
- ❌ 缺乏測試覆蓋率報告
- ❌ 開發體驗差，沒有即時回饋
- ❌ 測試結果格式不統一

### Vitest 優勢

- ✅ **速度提升 10 倍**：基於 Vite 的極速構建
- ✅ **原生 ESM 支援**：完美配合您的 ES 模組架構
- ✅ **即時測試回饋**：熱模組替換式監視模式
- ✅ **統一測試框架**：標準化的測試語法和工具
- ✅ **豐富的斷言庫**：內建 Chai 斷言，支援 Jest 兼容 API
- ✅ **測試覆蓋率**：內建覆蓋率報告
- ✅ **並行執行**：多線程測試執行

## 📦 安裝與配置

### 1. 安裝依賴

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

### 2. 配置文件

- `vitest.config.js` - Vitest 配置
- `test/setup.js` - 測試設置
- `.env.test` - 測試環境變數

### 3. 更新 package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

## 🔄 遷移步驟

### 階段 1：基礎設置（已完成）

- [x] 安裝 Vitest 依賴
- [x] 創建配置文件
- [x] 設置測試環境

### 階段 2：逐步遷移測試

1. **優先遷移核心功能測試**
   - 管理員路由測試
   - 用戶認證測試
   - API 端點測試

2. **遷移工具函數測試**
   - 推薦系統測試
   - 搜尋功能測試
   - 通知系統測試

3. **遷移整合測試**
   - 資料庫測試
   - 性能測試
   - 端到端測試

### 階段 3：清理舊測試

- 移除舊的測試腳本
- 清理 package.json 中的舊命令
- 更新文檔

## 📝 測試文件結構

```
test/
├── setup.js                    # 測試設置
├── vitest-examples/           # Vitest 示例
│   ├── admin-routes.test.js
│   ├── auth.test.js
│   └── api.test.js
├── unit/                      # 單元測試
│   ├── admin/
│   │   ├── routes.test.js
│   │   ├── permissions.test.js
│   │   └── statistics.test.js
│   ├── api/
│   │   ├── pagination.test.js
│   │   ├── validation.test.js
│   │   └── responses.test.js
│   ├── utils/
│   │   ├── search.test.js
│   │   ├── recommendation.test.js
│   │   └── notification.test.js
│   ├── models/
│   │   ├── user.test.js
│   │   ├── meme.test.js
│   │   └── report.test.js
│   └── controllers/
│       ├── auth.test.js
│       ├── meme.test.js
│       └── user.test.js
├── integration/               # 整合測試
│   ├── admin/
│   │   ├── dashboard.test.js
│   │   ├── user-management.test.js
│   │   └── content-moderation.test.js
│   ├── api/
│   │   ├── authentication.test.js
│   │   ├── meme-crud.test.js
│   │   └── user-operations.test.js
│   ├── workflows/
│   │   ├── user-registration.test.js
│   │   ├── meme-creation.test.js
│   │   └── report-handling.test.js
│   ├── middleware/
│   │   ├── auth.test.js
│   │   ├── rate-limit.test.js
│   │   └── validation.test.js
│   └── services/
│       ├── email.test.js
│       ├── notification.test.js
│       └── recommendation.test.js
├── e2e/                      # 端到端測試
│   ├── user-journeys/
│   │   ├── registration-flow.test.js
│   │   ├── meme-creation-flow.test.js
│   │   └── social-interaction.test.js
│   ├── critical-flows/
│   │   ├── authentication-flow.test.js
│   │   ├── content-moderation.test.js
│   │   └── payment-flow.test.js
│   └── api/
│       ├── complete-workflows.test.js
│       └── performance.test.js
└── legacy/                  # 舊測試（逐步遷移）
    ├── admin-tests/
    │   ├── admin-routes-comprehensive-test.js
    │   ├── admin-routes-test.js
    │   ├── basic-admin-test.js
    │   └── simple-admin-test.js
    ├── api-tests/
    │   ├── api-pagination-test.js
    │   └── username-test.js
    ├── email-tests/
    │   └── password-reset-test.js
    ├── notification-tests/
    ├── rate-limit-tests/
    │   └── basic-rate-limit-test.js
    ├── recommendation-tests/
    │   ├── collaborativeFiltering.test.js
    │   ├── contentBasedRecommendation.test.js
    │   ├── mixedRecommendation.test.js
    │   ├── socialCollaborativeFiltering.test.js
    │   └── socialScoreCalculator.test.js
    ├── report-tests/
    │   └── report-system-comprehensive-test.js
    ├── search-sort-tests/
    │   ├── advancedSearch.test.js
    │   ├── content-tag-collaborative-pagination.test.js
    │   ├── hot-latest-pagination.test.js
    │   └── infiniteScroll.test.js
    ├── user-cleanup-tests/
    │   ├── has-password-test.js
    │   └── test-password-status-api.js
    ├── username-tests/
    │   └── username-optimization-test.js
    ├── verification-tests/
    │   └── registration-email-test.js
    ├── utils/
    │   └── test-config.js
    ├── README.md
    └── run-tests.js
```

## 🧪 測試語法對比

### 舊方式（自定義測試）

```javascript
// 舊的測試方式
const test = (name, fn) => {
  console.log(`🧪 ${name}`)
  return fn()
}

const expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) {
      throw new Error(`期望 ${expected}，但得到 ${actual}`)
    }
  },
})

await test('管理員權限測試', async () => {
  // 測試邏輯
})
```

### 新方式（Vitest）

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('管理員路由測試', () => {
  beforeAll(async () => {
    // 設置
  })

  afterAll(async () => {
    // 清理
  })

  it('管理員用戶可以訪問管理員路由', async () => {
    const response = await request(app)
      .get('/api/admin/count-statistics')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
```

## 🎯 最佳實踐

### 1. 測試命名

```javascript
// ✅ 好的命名
describe('用戶認證功能', () => {
  it('應該成功登入有效用戶', () => {})
  it('應該拒絕無效密碼', () => {})
})

// ❌ 不好的命名
describe('test', () => {
  it('test1', () => {})
})
```

### 2. 測試組織

```javascript
describe('用戶管理', () => {
  describe('註冊功能', () => {
    it('應該成功註冊新用戶', () => {})
    it('應該拒絕重複 email', () => {})
  })

  describe('登入功能', () => {
    it('應該成功登入', () => {})
    it('應該拒絕錯誤密碼', () => {})
  })
})
```

### 3. 測試數據管理

```javascript
// 使用工廠函數創建測試數據
const createTestUser = (overrides = {}) => ({
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'testpassword123',
  ...overrides,
})

// 在測試中使用
it('應該創建用戶', async () => {
  const userData = createTestUser({ role: 'admin' })
  const user = await User.create(userData)
  expect(user.role).toBe('admin')
})
```

## 🚀 運行測試

### 開發模式（監視模式）

```bash
npm test
# 或
npm run test:watch
```

### 單次運行

```bash
npm run test:run
```

### 覆蓋率報告

```bash
npm run test:coverage
```

### 特定測試

```bash
# 運行特定測試文件
npm test admin-routes.test.js

# 運行特定測試套件
npm test -- --grep "管理員路由"
```

## 📊 測試覆蓋率

Vitest 提供詳細的覆蓋率報告：

```bash
npm run test:coverage
```

覆蓋率報告包括：

- 語句覆蓋率
- 分支覆蓋率
- 函數覆蓋率
- 行覆蓋率

## 🔧 調試測試

### 1. 使用 console.log

```javascript
it('調試測試', () => {
  console.log('調試信息')
  expect(true).toBe(true)
})
```

### 2. 使用 debugger

```javascript
it('調試測試', () => {
  debugger
  expect(true).toBe(true)
})
```

### 3. 使用 Vitest UI

```bash
npm run test:ui
```

## 📈 性能優化

### 1. 並行執行

```javascript
// vitest.config.js
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
```

### 2. 測試隔離

```javascript
// 使用 beforeEach 確保測試隔離
beforeEach(async () => {
  await cleanupTestData()
})
```

### 3. 快取優化

```javascript
// 重用測試數據
let sharedTestData

beforeAll(async () => {
  sharedTestData = await createSharedTestData()
})
```

## 🎉 遷移完成後的好處

1. **開發效率提升**：即時測試回饋
2. **代碼品質提升**：統一的測試標準
3. **維護成本降低**：標準化的測試框架
4. **團隊協作改善**：一致的測試語法
5. **CI/CD 整合**：更好的自動化測試

## 📚 參考資源

- [Vitest 官方文檔](https://vitest.dev/)
- [Vitest 配置指南](https://vitest.dev/config/)
- [測試最佳實踐](https://vitest.dev/guide/best-practices.html)
