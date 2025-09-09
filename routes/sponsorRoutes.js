import express from 'express'
import {
  createSponsor,
  getSponsors,
  getSponsorById,
  updateSponsor,
  deleteSponsor,
  handleBuyMeACoffeeCallback,
  getSponsorByTransactionId,
  logSponsorPageAccess,
  handleKofiShopOrderWebhook,
  getSupportedCurrencies,
  convertCurrency,
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
 *         - name
 *         - amount
 *         - sponsor
 *       properties:
 *         _id:
 *           type: string
 *           description: 贊助唯一ID
 *         name:
 *           type: string
 *           description: 贊助者名稱
 *         amount:
 *           type: number
 *           description: 贊助金額
 *         sponsor:
 *           type: string
 *           description: 贊助者用戶ID
 *         message:
 *           type: string
 *           description: 贊助留言
 *         isAnonymous:
 *           type: boolean
 *           default: false
 *           description: 是否匿名贊助
 *         isPublic:
 *           type: boolean
 *           default: true
 *           description: 是否公開顯示
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateSponsorRequest:
 *       type: object
 *       required:
 *         - name
 *         - amount
 *       properties:
 *         name:
 *           type: string
 *           description: 贊助者名稱
 *         amount:
 *           type: number
 *           description: 贊助金額
 *         message:
 *           type: string
 *           description: 贊助留言
 *         isAnonymous:
 *           type: boolean
 *           default: false
 *           description: 是否匿名贊助
 *         isPublic:
 *           type: boolean
 *           default: true
 *           description: 是否公開顯示
 *     UpdateSponsorRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: 贊助者名稱
 *         message:
 *           type: string
 *           description: 贊助留言
 *         isPublic:
 *           type: boolean
 *           description: 是否公開顯示
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
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 sponsor:
 *                   $ref: '#/components/schemas/Sponsor'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得所有贊助（管理員功能）
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
 *           default: 10
 *         description: 每頁數量
 *       - in: query
 *         name: public
 *         schema:
 *           type: boolean
 *         description: 只顯示公開的贊助
 *     responses:
 *       200:
 *         description: 成功取得贊助列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sponsors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sponsor'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                 totalAmount:
 *                   type: number
 *                   description: 總贊助金額
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
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
 *               $ref: '#/components/schemas/Sponsor'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 贊助不存在
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
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 sponsor:
 *                   $ref: '#/components/schemas/Sponsor'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 贊助不存在
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
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 贊助不存在
 */

// 建立贊助
router.post('/', token, isUser, createSponsor)
// 取得所有贊助
router.get('/', token, isManager, getSponsors)
// 取得單一贊助
router.get('/:id', token, isUser, getSponsorById)
// 更新贊助
router.put('/:id', token, isUser, updateSponsor)
// 刪除贊助
router.delete('/:id', token, isManager, deleteSponsor)
// Buy Me a Coffee 回調處理（無需認證）
router.post('/callback/buy-me-a-coffee', handleBuyMeACoffeeCallback)
// 根據交易ID取得贊助資訊（無需認證）
router.get('/transaction/:transaction_id', getSponsorByTransactionId)
// 記錄贊助頁面訪問（無需認證）
router.post('/log-access', logSponsorPageAccess)

// 幣別相關功能
router.get('/currencies/supported', getSupportedCurrencies)
router.post('/currencies/convert', convertCurrency)

// Ko-fi Shop Order Webhook（使用 Ko-fi 驗證）
router.post('/webhooks/kofi/shop-orders', validateKofiWebhook, handleKofiShopOrderWebhook)

export default router
