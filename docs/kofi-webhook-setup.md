# Ko-fi Shop Order Webhook 設定指南

本文檔說明如何設定和使用 Ko-fi Shop Order Webhook 來自動處理贊助。

## 功能概述

Ko-fi Shop Order Webhook 提供以下功能：

- ✅ 自動驗證 Ko-fi 請求
- ✅ 防止重複處理相同的交易
- ✅ 支援多種贊助等級 (Soy, Chicken, Coffee)
- ✅ 自動匹配現有用戶或建立匿名贊助記錄
- ✅ 即時發送通知給管理員和用戶
- ✅ 更新用戶贊助統計和徽章
- ✅ 維護全域贊助統計快取

## 環境變數設定

在 `.env` 文件中添加以下配置：

```bash
# Ko-fi Webhook 配置
KOFI_VERIFICATION_TOKEN=your_kofi_verification_token
```

## Ko-fi 設定

### 1. 在 Ko-fi 後台建立商品

1. 登入 Ko-fi 管理後台
2. 前往 "Shop" 頁面
3. 建立三個商品，分別對應不同的贊助等級：

#### 豆漿贊助 (1 USD)

- 商品名稱：豆漿贊助
- 價格：1 USD
- Direct Link Code：`c4043b71a4`

#### 雞肉贊助 (2 USD)

- 商品名稱：雞肉贊助
- 價格：2 USD
- Direct Link Code：`b7e4575bf6`

#### 咖啡贊助 (5 USD)

- 商品名稱：咖啡贊助
- 價格：5 USD
- Direct Link Code：`25678099a7`

### 2. 設定 Webhook

1. 在 Ko-fi 後台前往 "Advanced" 或 "Webhooks" 設定
2. 新增 Webhook：
   - **URL**: `https://api.memedam.com/api/sponsors/webhooks/kofi/shop-orders`
   - **Events**: 選擇 "Shop Orders"
   - **Verification Token**: 設定為環境變數中的 `KOFI_VERIFICATION_TOKEN` 值

## API 端點

### POST /api/sponsors/webhooks/kofi/shop-orders

處理 Ko-fi Shop Order Webhook 的端點。

#### 請求格式

```json
{
  "verification_token": "your_verification_token",
  "message_id": "unique_message_id",
  "kofi_transaction_id": "kofi_txn_123",
  "type": "Shop Order",
  "from_name": "贊助者名稱",
  "display_name": "顯示名稱",
  "email": "sponsor@example.com",
  "amount": "3.00",
  "currency": "USD",
  "message": "贊助留言",
  "direct_link_code": "CHICKEN",
  "shop_items": [
    {
      "direct_link_code": "b7e4575bf6",
      "variation_name": "標準",
      "quantity": 1
    }
  ],
  "shipping": {
    "full_name": "收件人姓名",
    "street_address": "地址",
    "city": "城市",
    "state_or_province": "省/州",
    "postal_code": "郵遞區號",
    "country": "國家",
    "country_code": "TW",
    "telephone": "電話"
  },
  "is_public": true,
  "discord_username": "discorduser#1234",
  "discord_userid": "123456789012345678"
}
```

#### 回應格式

成功處理：

```json
{
  "success": true,
  "message": "Shop Order 處理成功",
  "data": {
    "kofi_transaction_id": "kofi_txn_123",
    "sponsor_id": "mongodb_object_id",
    "sponsor_level": "chicken",
    "amount": 3
  }
}
```

錯誤回應：

```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

## 驗證機制

Webhook 實作了多層驗證：

1. **Token 驗證**: 驗證 `verification_token`
2. **請求類型檢查**: 僅接受 `Shop Order` 類型
3. **IP 白名單**: 驗證請求來源 IP（生產環境）
4. **重複處理防護**: 使用 `message_id` 防止重複處理
5. **商品代碼驗證**: 檢查 `direct_link_code` 是否支援
6. **資料完整性檢查**: 驗證必要字段是否存在

## 支援的贊助等級

| Direct Link Code | 等級    | 金額  | 描述     |
| ---------------- | ------- | ----- | -------- |
| `c4043b71a4`     | soy     | 1 USD | 豆漿贊助 |
| `b7e4575bf6`     | chicken | 2 USD | 雞肉贊助 |
| `25678099a7`     | coffee  | 5 USD | 咖啡贊助 |

## 數據處理流程

1. **接收 Webhook** → 驗證請求
2. **解析 direct_link_code** → 確定贊助等級
3. **查找用戶** → 根據 email 匹配現有用戶
4. **儲存贊助記錄** → 建立新的贊助記錄
5. **更新統計** → 更新用戶和全域統計
6. **發送通知** → 通知管理員和用戶
7. **返回 200 狀態碼** → 確認處理完成

## 錯誤處理

系統實作了完善的錯誤處理：

- **驗證錯誤**: 返回 400/401 狀態碼
- **重複交易**: 返回 409 狀態碼
- **系統錯誤**: 返回 500 狀態碼並記錄日誌
- **事務回滾**: 確保資料一致性

## 測試

### 單元測試

```bash
# 運行 Ko-fi Webhook 測試
npm test -- test/kofi-webhook-test.js
```

### 手動測試

可以使用以下 cURL 命令測試 Webhook：

```bash
curl -X POST https://api.memedam.com/api/sponsors/webhooks/kofi/shop-orders \
  -H "Content-Type: application/json" \
  -d '{
    "verification_token": "your_test_token",
    "message_id": "test_123",
    "kofi_transaction_id": "test_txn_123",
    "type": "Shop Order",
    "from_name": "測試贊助者",
    "amount": "2.00",
    "currency": "USD",
    "direct_link_code": "b7e4575bf6",
    "email": "test@example.com"
  }'
```

## 監控和日誌

所有 Webhook 處理都會記錄詳細的日誌：

- 請求驗證結果
- 處理成功/失敗狀態
- 錯誤詳情和堆疊追蹤
- 效能指標

日誌位置：`logs/kofi-webhook.log`

## 故障排除

### 常見問題

1. **Webhook 沒有觸發**
   - 檢查 Ko-fi 的 Webhook URL 是否正確
   - 確認 verification token 是否匹配

2. **驗證失敗**
   - 檢查環境變數 `KOFI_VERIFICATION_TOKEN`
   - 確認請求標頭和格式

3. **重複處理**
   - 檢查 `message_id` 是否唯一
   - 查看 Redis 快取中的處理記錄

4. **用戶匹配失敗**
   - 確認 email 格式正確
   - 檢查資料庫中是否存在對應用戶

### 調試模式

啟用調試模式查看詳細日誌：

```bash
DEBUG=kofi:* npm start
```

## 安全性注意事項

- ✅ 所有請求都經過驗證
- ✅ IP 白名單保護（生產環境）
- ✅ 重複處理防護
- ✅ 敏感資料加密儲存
- ✅ 速率限制保護

## 相關文件

- [Ko-fi Webhook 文檔](https://ko-fi.com/manage/webhooks)
- [API 文檔](../docs/API.md)
- [贊助系統設計](../docs/ko-fi-webhooks-integration-plan.md)
