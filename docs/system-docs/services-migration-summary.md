# Services 目錄遷移總結

## 遷移日期
2024年

## 遷移背景
為了改善專案結構，將服務層級的功能從 `utils/` 目錄遷移到 `services/` 目錄，以符合單一職責原則並提高程式碼可維護性。

## 遷移內容

### 已遷移的檔案

| 原始路徑 | 新路徑 | 功能描述 |
|---------|--------|----------|
| `utils/analyticsMonitor.js` | `services/analyticsMonitor.js` | 分析監控服務，負責推薦效果監控和 A/B 測試管理 |
| `utils/asyncProcessor.js` | `services/asyncProcessor.js` | 非同步處理服務，提供任務隊列、批量處理和並行處理功能 |
| `utils/googleTranslate.js` | `services/googleTranslate.js` | Google Cloud Translation API 服務 |
| `utils/maintenance.js` | `services/maintenanceScheduler.js` | 系統維護排程服務（重命名以保持一致性） |
| `utils/recommendationScheduler.js` | `services/recommendationScheduler.js` | 推薦系統排程服務 |
| `utils/notificationScheduler.js` | `services/notificationScheduler.js` | 通知排程服務 |
| `utils/userCleanupScheduler.js` | `services/userCleanupScheduler.js` | 用戶清理排程服務 |

### 更新的檔案

以下檔案的 import 路徑已更新：

#### 主程式檔案
- `index.js` - 更新所有服務的引用路徑

#### Controllers
- `controllers/tagController.js` - 更新 googleTranslate 引用
- `controllers/userController.js` - 更新 userCleanupScheduler 引用

#### Routes
- `routes/adminRoutes.js` - 更新 maintenanceScheduler、recommendationScheduler 和 notificationScheduler 引用

#### 測試檔案
- `test/integration/api/user-cleanup.test.js`
- `test/vitest-examples/admin-routes.test.js`
- `test/setup-simple.js`
- `test/unit/admin/admin-routes.test.js`

#### 服務內部引用
所有遷移的服務檔案內部引用都已更新為使用 `../utils/` 路徑：
- `services/asyncProcessor.js` - logger 引用
- `services/maintenanceScheduler.js` - checkCounts 和 logger 引用
- `services/recommendationScheduler.js` - 各種 scheduler 和 logger 引用
- `services/analyticsMonitor.js` - logger 引用
- `services/userCleanupScheduler.js` - logger 引用

## 目錄結構變更

### 變更前
```
memedam_backend/
├── utils/
│   ├── analyticsMonitor.js
│   ├── asyncProcessor.js
│   ├── googleTranslate.js
│   ├── maintenance.js
│   ├── recommendationScheduler.js
│   ├── notificationScheduler.js
│   ├── userCleanupScheduler.js
│   └── ... (其他工具函數)
└── services/
    ├── emailService.js
    ├── logService.js
    ├── notificationService.js
    └── recaptchaService.js
```

### 變更後
```
memedam_backend/
├── utils/
│   └── ... (純工具函數和演算法)
└── services/
    ├── analyticsMonitor.js ⭐
    ├── asyncProcessor.js ⭐
    ├── emailService.js
    ├── googleTranslate.js ⭐
    ├── logService.js
    ├── maintenanceScheduler.js ⭐
    ├── notificationScheduler.js ⭐
    ├── notificationService.js
    ├── recaptchaService.js
    ├── recommendationScheduler.js ⭐
    └── userCleanupScheduler.js ⭐
```
⭐ 表示新遷移的檔案

## 保留在 utils/ 的檔案

以下類型的檔案仍保留在 `utils/` 目錄：

### 純工具函數
- `slugify.js` - URL slug 生成
- `jwt.js` - JWT token 處理
- `deleteImg.js` - 圖片刪除工具
- `sortHelpers.js` - 排序輔助函數
- `logger.js` - 日誌工具
- `transaction.js` - 資料庫事務處理
- `mongoSanitize.js` - MongoDB 查詢清理

### 演算法實現
- `hotScore.js` - 熱門分數演算法
- `collaborativeFiltering.js` - 協同過濾演算法
- `contentBased.js` - 內容基礎推薦演算法
- `socialScoreCalculator.js` - 社交分數計算
- `mixedRecommendation.js` - 混合推薦演算法
- `advancedSearch.js` - 進階搜尋功能

### 排程器輔助
- `hotScoreScheduler.js` - 熱門分數更新排程
- `collaborativeFilteringScheduler.js` - 協同過濾更新排程
- `contentBasedScheduler.js` - 內容基礎推薦更新排程

### 其他輔助功能
- `checkCounts.js` - 統計檢查工具
- `notificationUtils.js` - 通知輔助函數
- `oauthTempStore.js` - OAuth 臨時存儲
- `sidebarTemplates.js` - 側邊欄模板
- `usernameGenerator.js` - 用戶名生成器
- `updateHasPassword.js` - 密碼欄位更新工具

## 測試結果

### 測試項目
1. ✅ 檔案遷移完整性測試
2. ✅ Import 路徑更新測試
3. ✅ 服務內部引用測試
4. ✅ 循環依賴檢查
5. ✅ 整合測試

### 測試結果
- **成功項目**: 24 項
- **失敗項目**: 0 項
- **警告**: 僅有缺少 npm 套件的警告（不影響功能）

## 影響評估

### 正面影響
1. **更清晰的專案結構** - 服務層和工具層分離明確
2. **提高可維護性** - 符合單一職責原則
3. **更好的程式碼組織** - 相關功能集中管理
4. **無破壞性變更** - 所有功能保持正常運作

### 潛在風險
- 無（所有測試通過）

## 後續建議

1. **文檔更新** - 更新開發者文檔中關於專案結構的說明
2. **團隊通知** - 通知團隊成員關於目錄結構的變更
3. **持續監控** - 觀察系統運行狀況，確保沒有遺漏的問題

## 回滾計劃

如需回滾，執行以下步驟：

```bash
# 1. 將服務檔案移回 utils 目錄
mv services/analyticsMonitor.js utils/analyticsMonitor.js
mv services/asyncProcessor.js utils/asyncProcessor.js
mv services/googleTranslate.js utils/googleTranslate.js
mv services/maintenanceScheduler.js utils/maintenance.js
mv services/recommendationScheduler.js utils/recommendationScheduler.js
mv services/notificationScheduler.js utils/notificationScheduler.js
mv services/userCleanupScheduler.js utils/userCleanupScheduler.js

# 2. 恢復所有 import 路徑（使用 git revert 或手動修改）
git revert [commit-hash]
```

## 結論

這次遷移成功地改善了專案結構，將服務層級的功能集中到 `services/` 目錄，同時保持 `utils/` 目錄專注於純工具函數和演算法實現。所有測試都已通過，系統功能正常運作。