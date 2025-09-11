# Ko-fi 贊助系統數據初始化指南

本指南說明如何初始化 Ko-fi Webhooks 整合所需的資料庫結構和數據。

## 📋 完成的功能

### ✅ 已完成的資料庫結構擴展

#### 1. `models/Sponsor.js` - 擴展贊助者表

- 新增 Ko-fi Shop Order 字段
- 支援匿名贊助（`user_id` 非必填）
- 添加退款處理、認領機制、訊息審核等功能
- 多幣別支援和統計分析字段

#### 2. `models/SponsorshipLogs.js` - 贊助記錄表

- 記錄所有 webhook 處理過程
- 防重複處理機制
- 錯誤處理和重試邏輯

#### 3. `models/UserSponsorshipStats.js` - 用戶贊助統計表

- 用戶贊助統計數據
- 按等級和貨幣分類統計
- 徽章獲取狀態追蹤

#### 4. `models/SponsorshipProducts.js` - 商品映射表

- 商品配置管理
- 版本控制支援
- 多項目處理規則
- 銷售統計功能

## 🚀 初始化步驟

### 步驟 1: 運行初始化腳本

#### Windows 環境

```bash
# 在專案根目錄執行
./scripts/data/init-sponsorship-products.bat
```

#### Linux/Mac 環境

```bash
# 在專案根目錄執行
node scripts/data/initialize-sponsorship-products.js
```

### 步驟 2: 驗證初始化結果

腳本執行後會顯示：

- 初始化狀態
- 總商品數量
- 活躍商品數量
- 商品列表詳情

## 📊 初始化數據

### 預設商品配置

| 商品名稱 | Direct Link Code | 金額 | 等級    | 徽章 | 狀態    |
| -------- | ---------------- | ---- | ------- | ---- | ------- |
| 豆漿贊助 | `c4043b71a4`     | $30  | soy     | ❌   | ✅ 活躍 |
| 雞肉贊助 | `b7e4575bf6`     | $60  | chicken | ❌   | ✅ 活躍 |
| 咖啡贊助 | `25678099a7`     | $150 | coffee  | ✅   | ✅ 活躍 |

### 商品特性

#### 🥛 豆漿贊助 (Soy)

- **金額**: $30 USD
- **等級**: soy
- **徽章**: 不提供
- **描述**: 基礎贊助等級，提供網站運營支持

#### 🍗 雞肉贊助 (Chicken)

- **金額**: $60 USD
- **等級**: chicken
- **徽章**: 不提供
- **描述**: 中級贊助等級，提供更多網站功能支持

#### ☕ 咖啡贊助 (Coffee)

- **金額**: $150 USD
- **等級**: coffee
- **徽章**: 提供 🏆
- **描述**: 高級贊助等級，獲得專屬徽章和特別感謝

## 🔧 資料庫索引

### 效能優化索引

#### Sponsor 表索引

- `kofi_transaction_id` (唯一) - 防重複交易
- `email` - 用戶查詢
- `user_id` - 用戶關聯查詢
- `claimed_by_user_id` - 認領用戶查詢
- `claim_token` - 認領token查詢
- `is_public + sponsor_level + createdAt` - 前端顯示查詢
- `status + createdAt` - 管理後台查詢

#### SponsorshipLogs 表索引

- `message_id` (唯一) - 防重複處理
- `sponsor_id` - 贊助記錄關聯查詢
- `transaction_id` - 交易ID查詢
- `direct_link_code` - 商品類型查詢

#### UserSponsorshipStats 表索引

- `user_id` (唯一) - 用戶唯一索引
- `sponsor_level` - 等級查詢
- `badge_earned` - 徽章狀態查詢
- `last_sponsorship_at` - 最後贊助時間查詢

#### SponsorshipProducts 表索引

- `direct_link_code` (唯一) - 商品代碼唯一索引
- `sponsor_level` - 等級查詢
- `is_active` - 啟用狀態查詢
- `effective_from + effective_until` - 時間範圍查詢

## 📖 API 使用範例

### 查詢活躍商品

```javascript
import SponsorshipProducts from '../models/SponsorshipProducts.js'

// 獲取所有活躍商品
const activeProducts = await SponsorshipProducts.getActiveProducts()

// 根據 direct_link_code 查詢商品
const product = await SponsorshipProducts.getByDirectLinkCode('c4043b71a4')
```

### 增加銷售統計

```javascript
// 增加商品銷售數量和營收
await product.incrementSales(1, 30) // 數量, 金額
```

### 查詢用戶統計

```javascript
import UserSponsorshipStats from '../models/UserSponsorshipStats.js'

// 獲取用戶贊助統計
const userStats = await UserSponsorshipStats.findOne({ user_id: userId })
```

## 🔍 故障排除

### 常見問題

1. **商品代碼重複錯誤**
   - 確保 `direct_link_code` 在資料庫中唯一
   - 檢查初始化腳本是否重複執行

2. **模型載入錯誤**
   - 確認所有新模型都已添加到 `config/loadModels.js`
   - 檢查模型文件語法是否正確

3. **資料庫連接問題**
   - 確認環境變數配置正確
   - 檢查 MongoDB 服務是否運行

### 日誌檢查

初始化腳本會輸出詳細的執行日誌：

- ✅ 成功創建的商品
- ⚠️ 已存在的商品（跳過）
- ❌ 錯誤訊息

## 📝 後續步驟

完成資料庫結構初始化後，接下來需要：

1. **實現 Ko-fi Webhook 處理器**
2. **創建贊助管理後台介面**
3. **實現認領機制**
4. **添加統計報表功能**
5. **設定自動化任務**

---

_如有問題，請參考 [Ko-fi Webhooks 整合計劃文件](../docs/ko-fi-webhooks-integration-plan.md)_
