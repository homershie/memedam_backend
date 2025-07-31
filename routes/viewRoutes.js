import express from 'express'
import {
  recordView,
  getViewStats,
  getUserViewHistory,
  getPopularMemes,
  cleanupOldViews,
} from '../controllers/viewController.js'
import { token, optionalToken, isManager } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     View:
 *       type: object
 *       required:
 *         - meme
 *       properties:
 *         _id:
 *           type: string
 *           description: 瀏覽記錄唯一ID
 *         user:
 *           type: string
 *           description: 用戶ID（可選，匿名用戶為空）
 *         meme:
 *           type: string
 *           description: 迷因ID
 *         ipAddress:
 *           type: string
 *           description: IP地址
 *         userAgent:
 *           type: string
 *           description: 用戶代理
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *     ViewStats:
 *       type: object
 *       properties:
 *         totalViews:
 *           type: integer
 *           description: 總瀏覽數
 *         uniqueViews:
 *           type: integer
 *           description: 唯一瀏覽數
 *         todayViews:
 *           type: integer
 *           description: 今日瀏覽數
 *         weeklyViews:
 *           type: integer
 *           description: 本週瀏覽數
 *         monthlyViews:
 *           type: integer
 *           description: 本月瀏覽數
 *     ViewHistory:
 *       type: object
 *       properties:
 *         views:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/View'
 *         memes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Meme'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 */

/**
 * @swagger
 * /api/views/stats/{meme_id}:
 *   get:
 *     summary: 取得迷因瀏覽統計
 *     tags: [Views]
 *     parameters:
 *       - in: path
 *         name: meme_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 成功取得瀏覽統計
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViewStats'
 *       404:
 *         description: 迷因不存在
 */

/**
 * @swagger
 * /api/views/history:
 *   get:
 *     summary: 取得用戶瀏覽歷史
 *     tags: [Views]
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
 *     responses:
 *       200:
 *         description: 成功取得瀏覽歷史
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ViewHistory'
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/views/popular:
 *   get:
 *     summary: 取得熱門迷因（基於瀏覽數）
 *     tags: [Views]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, all]
 *           default: all
 *         description: 時間範圍
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 返回數量
 *     responses:
 *       200:
 *         description: 成功取得熱門迷因
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meme'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     totalViews:
 *                       type: integer
 */

/**
 * @swagger
 * /api/views/cleanup:
 *   delete:
 *     summary: 清理過期瀏覽記錄（管理員功能）
 *     tags: [Views]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 保留天數
 *     responses:
 *       200:
 *         description: 清理成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *                   description: 刪除的記錄數
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/views/{meme_id}:
 *   post:
 *     summary: 記錄迷因瀏覽
 *     tags: [Views]
 *     parameters:
 *       - in: path
 *         name: meme_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 瀏覽記錄成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 view:
 *                   $ref: '#/components/schemas/View'
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 迷因不存在
 */

// 取得迷因瀏覽統計（公開）
router.get('/stats/:meme_id', getViewStats)

// 取得用戶瀏覽歷史（需要登入）
router.get('/history', token, getUserViewHistory)

// 取得熱門迷因（基於瀏覽數，公開）
router.get('/popular', getPopularMemes)

// 清理過期瀏覽記錄（管理員功能）
router.delete('/cleanup', token, isManager, cleanupOldViews)

// 記錄瀏覽（支援匿名和登入用戶，必須在最後）
router.post('/:meme_id', optionalToken, recordView)

export default router
