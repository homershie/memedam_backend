import express from 'express'
import {
  createSponsor,
  getSponsors,
  getSponsorById,
  updateSponsor,
  deleteSponsor,
  getSponsorByTransactionId,
  logSponsorPageAccess,
  handleKofiShopOrderWebhook,
  getSupportedCurrencies,
  convertCurrency,
  getLatestSuccessSponsor,
  getExchangeRateCacheStats,
  clearExchangeRateCache,
  updateExchangeRate,
} from '../controllers/sponsorController.js'
import { token, isUser, isManager } from '../middleware/auth.js'
import { validateKofiWebhook } from '../middleware/kofiWebhookValidation.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Sponsor:
 *       type: object
 *       required:
 *         - user_id
 *         - amount
 *         - payment_method
 *         - transaction_id
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *           description: 贊助唯一ID
 *         user_id:
 *           type: string
 *           description: 贊助者用戶ID
 *         amount:
 *           type: number
 *           description: 贊助金額
 *         message:
 *           type: string
 *           description: 贊助留言
 *         payment_method:
 *           type: string
 *           enum: [ko-fi]
 *           description: 付款方式
 *         transaction_id:
 *           type: string
 *           description: 交易ID
 *         status:
 *           type: string
 *           enum: [pending, success, failed, cancelled]
 *           description: 贊助狀態
 *         created_ip:
 *           type: string
 *           description: 創建時IP地址
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *         # Ko-fi 特定欄位
 *         kofi_transaction_id:
 *           type: string
 *           description: Ko-fi 交易ID
 *         from_name:
 *           type: string
 *           description: Ko-fi 贊助者名稱
 *         display_name:
 *           type: string
 *           description: Ko-fi 顯示名稱
 *         email:
 *           type: string
 *           description: Ko-fi 贊助者信箱
 *         currency:
 *           type: string
 *           description: 原始幣別
 *         type:
 *           type: string
 *           description: Ko-fi 贊助類型
 *         direct_link_code:
 *           type: string
 *           description: Ko-fi 直接連結代碼
 *         shop_items:
 *           type: array
 *           items:
 *             type: object
 *           description: Ko-fi 商店項目
 *         sponsor_level:
 *           type: string
 *           description: 贊助等級
 *         badge_earned:
 *           type: boolean
 *           description: 是否獲得徽章
 *         # 幣別轉換資訊
 *         amount_original:
 *           type: number
 *           description: 原始金額
 *         currency_original:
 *           type: string
 *           description: 原始幣別
 *         amount_usd:
 *           type: number
 *           description: 轉換為美元金額
 *         amount_twd:
 *           type: number
 *           description: 轉換為台幣金額
 *         exchange_rate:
 *           type: number
 *           description: 使用的匯率
 *         exchange_rate_used:
 *           type: string
 *           description: 匯率使用記錄
 *         # 訊息審核資訊
 *         message_reviewed:
 *           type: boolean
 *           description: 訊息是否已審核
 *         message_auto_filtered:
 *           type: boolean
 *           description: 訊息是否被自動過濾
 *         message_original:
 *           type: string
 *           description: 原始訊息
 *         message_filter_reason:
 *           type: string
 *           description: 過濾原因
 *         message_filter_severity:
 *           type: string
 *           description: 過濾嚴重程度
 *         requires_manual_review:
 *           type: boolean
 *           description: 是否需要人工審核
 *     CreateSponsorRequest:
 *       type: object
 *       required:
 *         - user_id
 *         - amount
 *         - payment_method
 *         - transaction_id
 *       properties:
 *         user_id:
 *           type: string
 *           description: 贊助者用戶ID
 *         amount:
 *           type: number
 *           description: 贊助金額
 *         message:
 *           type: string
 *           description: 贊助留言
 *         payment_method:
 *           type: string
 *           enum: [ko-fi]
 *           description: 付款方式
 *         transaction_id:
 *           type: string
 *           description: 交易ID
 *         status:
 *           type: string
 *           enum: [pending, success, failed, cancelled]
 *           default: pending
 *           description: 贊助狀態
 *     UpdateSponsorRequest:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: 贊助留言
 *         status:
 *           type: string
 *           enum: [pending, success, failed, cancelled]
 *           description: 贊助狀態
 *     CurrencyInfo:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           description: 幣別代碼
 *         name:
 *           type: string
 *           description: 幣別名稱
 *         symbol:
 *           type: string
 *           description: 幣別符號
 *         region:
 *           type: string
 *           description: 幣別地區
 *     CurrencyConversionRequest:
 *       type: object
 *       required:
 *         - amount
 *         - from_currency
 *         - to_currency
 *       properties:
 *         amount:
 *           type: number
 *           description: 轉換金額
 *         from_currency:
 *           type: string
 *           description: 來源幣別
 *         to_currency:
 *           type: string
 *           description: 目標幣別
 *     CurrencyConversionResponse:
 *       type: object
 *       properties:
 *         conversion:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             original_amount:
 *               type: number
 *             converted_amount:
 *               type: number
 *             from_currency:
 *               type: string
 *             to_currency:
 *               type: string
 *             exchange_rate:
 *               type: number
 *         formatted_original:
 *           type: string
 *           description: 格式化原始金額
 *         formatted_converted:
 *           type: string
 *           description: 格式化轉換後金額
 *     ExchangeRateUpdateRequest:
 *       type: object
 *       required:
 *         - rate
 *       properties:
 *         rate:
 *           type: number
 *           description: 匯率值
 *         ttl:
 *           type: number
 *           description: 快取存活時間（秒）
 *     KoFiWebhookRequest:
 *       type: object
 *       properties:
 *         kofi_transaction_id:
 *           type: string
 *           description: Ko-fi 交易ID
 *         from_name:
 *           type: string
 *           description: 贊助者名稱
 *         display_name:
 *           type: string
 *           description: 顯示名稱
 *         email:
 *           type: string
 *           description: 贊助者信箱
 *         amount:
 *           type: string
 *           description: 贊助金額
 *         currency:
 *           type: string
 *           description: 幣別
 *         message:
 *           type: string
 *           description: 贊助訊息
 *         direct_link_code:
 *           type: string
 *           description: 直接連結代碼
 *         shop_items:
 *           type: string
 *           description: 商店項目JSON字串
 *         shipping:
 *           type: object
 *           description: 運送資訊
 *         is_public:
 *           type: boolean
 *           description: 是否公開
 *         message_id:
 *           type: string
 *           description: 訊息ID
 *     SponsorPageAccessRequest:
 *       type: object
 *       properties:
 *         pageType:
 *           type: string
 *           description: 頁面類型
 *         transactionId:
 *           type: string
 *           description: 交易ID
 *         message:
 *           type: string
 *           description: 訊息
 *         userAgent:
 *           type: string
 *           description: 用戶代理
 *         referrer:
 *           type: string
 *           description: 來源頁面
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: 請求是否成功
 *         data:
 *           type: object
 *           description: 回應資料
 *         error:
 *           type: string
 *           description: 錯誤訊息
 *         message:
 *           type: string
 *           description: 回應訊息
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *             pages:
 *               type: integer
 */

/**
 * @swagger
 * /api/sponsors:
 *   post:
 *     summary: 建立贊助
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSponsorRequest'
 *     responses:
 *       201:
 *         description: 贊助創建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       409:
 *         description: 贊助記錄重複
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   get:
 *     summary: 取得所有贊助
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每頁數量
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: 用戶ID篩選
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed, cancelled]
 *         description: 狀態篩選
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 關鍵字搜尋（贊助留言）
 *       - in: query
 *         name: min_amount
 *         schema:
 *           type: number
 *         description: 最小金額篩選
 *       - in: query
 *         name: max_amount
 *         schema:
 *           type: number
 *         description: 最大金額篩選
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *         description: 排序欄位
 *       - in: query
 *         name: sort_dir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: 排序方向
 *     responses:
 *       200:
 *         description: 成功取得贊助列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/{id}:
 *   get:
 *     summary: 取得單一贊助
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 贊助ID
 *     responses:
 *       200:
 *         description: 成功取得贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 無權限查詢此贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 找不到贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   put:
 *     summary: 更新贊助
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 贊助ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSponsorRequest'
 *     responses:
 *       200:
 *         description: 贊助更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 無權限修改此贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 找不到贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       409:
 *         description: 贊助記錄重複
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   delete:
 *     summary: 刪除贊助（管理員功能）
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 贊助ID
 *     responses:
 *       200:
 *         description: 贊助刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 無權限刪除此贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 找不到贊助
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/transaction/{transaction_id}:
 *   get:
 *     summary: 根據交易ID取得贊助資訊
 *     tags: [Sponsors]
 *     parameters:
 *       - in: path
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 交易ID
 *     responses:
 *       200:
 *         description: 成功取得贊助資訊
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 缺少交易ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 找不到此交易記錄
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/log-access:
 *   post:
 *     summary: 記錄贊助頁面訪問
 *     tags: [Sponsors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SponsorPageAccessRequest'
 *     responses:
 *       200:
 *         description: 訪問記錄已記錄
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/me/latest-success:
 *   get:
 *     summary: 獲取用戶最近一筆成功贊助
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得最近一筆成功贊助
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Sponsor'
 *                 error:
 *                   type: string
 *                   example: null
 *       401:
 *         description: 用戶未登入
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: string
 *                   example: null
 *                 error:
 *                   type: string
 *                   example: "用戶未登入"
 *       404:
 *         description: 找不到成功贊助記錄
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: string
 *                   example: null
 *                 error:
 *                   type: string
 *                   example: "找不到成功贊助記錄"
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: string
 *                   example: null
 *                 error:
 *                   type: string
 *                   example: "伺服器內部錯誤"
 */

/**
 * @swagger
 * /api/sponsors/currencies/supported:
 *   get:
 *     summary: 獲取支援的幣別列表
 *     tags: [Sponsors]
 *     responses:
 *       200:
 *         description: 成功取得支援幣別列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CurrencyInfo'
 *                 error:
 *                   type: string
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/currencies/convert:
 *   post:
 *     summary: 測試幣別轉換
 *     tags: [Sponsors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurrencyConversionRequest'
 *     responses:
 *       200:
 *         description: 轉換成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CurrencyConversionResponse'
 *                 error:
 *                   type: string
 *       400:
 *         description: 缺少必要參數或轉換失敗
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/currencies/exchange-rates/cache/stats:
 *   get:
 *     summary: 獲取匯率快取統計資訊（管理員功能）
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得匯率快取統計
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/currencies/exchange-rates/cache/clear:
 *   post:
 *     summary: 清除匯率快取（管理員功能）
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: 來源幣別（可選，不提供則清除所有快取）
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: 目標幣別（可選，不提供則清除所有快取）
 *     responses:
 *       200:
 *         description: 快取清除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/currencies/exchange-rates/{from}/{to}:
 *   put:
 *     summary: 更新匯率（管理員功能）
 *     tags: [Sponsors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: 來源幣別
 *       - in: path
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         description: 目標幣別
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExchangeRateUpdateRequest'
 *     responses:
 *       200:
 *         description: 匯率更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 請提供有效的匯率值
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /api/sponsors/webhooks/kofi/shop-orders:
 *   post:
 *     summary: Ko-fi Shop Order Webhook
 *     tags: [Sponsors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/KoFiWebhookRequest'
 *     responses:
 *       200:
 *         description: Shop Order 處理成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     kofi_transaction_id:
 *                       type: string
 *                     sponsor_id:
 *                       type: string
 *                     sponsor_level:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     shop_items_processed:
 *                       type: boolean
 *                     shop_items_count:
 *                       type: integer
 *                     shop_items_merged:
 *                       type: boolean
 *                     shop_items_quantity:
 *                       type: integer
 *                     shop_items_merge_rule:
 *                       type: string
 *                     message_reviewed:
 *                       type: boolean
 *                     message_filtered:
 *                       type: boolean
 *                     message_filter_reason:
 *                       type: string
 *                     requires_manual_review:
 *                       type: boolean
 *                     currency_conversion:
 *                       type: object
 *                       properties:
 *                         success:
 *                           type: boolean
 *                         original_amount:
 *                           type: number
 *                         original_currency:
 *                           type: string
 *                         usd_amount:
 *                           type: number
 *                         twd_amount:
 *                           type: number
 *                         exchange_rate:
 *                           type: number
 *       400:
 *         description: 無效的金額或資料驗證錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       409:
 *         description: 交易ID重複
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: 處理 Shop Order 時發生錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

// 建立贊助
router.post('/', token, isUser, createSponsor)
// 取得所有贊助
router.get('/', token, isUser, getSponsors)
// 取得單一贊助
router.get('/:id', token, isUser, getSponsorById)
// 更新贊助
router.put('/:id', token, isUser, updateSponsor)
// 刪除贊助
router.delete('/:id', token, isManager, deleteSponsor)
// 根據交易ID取得贊助資訊（無需認證）
router.get('/transaction/:transaction_id', getSponsorByTransactionId)
// 獲取用戶最近一筆成功贊助（需要登入）
router.get('/me/latest-success', token, isUser, getLatestSuccessSponsor)
// 記錄贊助頁面訪問（無需認證）
router.post('/log-access', logSponsorPageAccess)

// 幣別相關功能
router.get('/currencies/supported', getSupportedCurrencies)
router.post('/currencies/convert', convertCurrency)

// 匯率管理功能（管理員專用）
router.get('/currencies/exchange-rates/cache/stats', token, isManager, getExchangeRateCacheStats)
router.post('/currencies/exchange-rates/cache/clear', token, isManager, clearExchangeRateCache)
router.put('/currencies/exchange-rates/:from/:to', token, isManager, updateExchangeRate)

// Ko-fi Shop Order Webhook（使用 Ko-fi 驗證）
router.post('/webhooks/kofi/shop-orders', validateKofiWebhook, handleKofiShopOrderWebhook)

export default router
