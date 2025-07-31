import express from 'express'
import {
  createDislike,
  getDislikes,
  deleteDislike,
  toggleDislike,
} from '../controllers/dislikeController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Dislike:
 *       type: object
 *       required:
 *         - user
 *         - meme
 *       properties:
 *         _id:
 *           type: string
 *           description: 噓的唯一ID
 *         user:
 *           type: string
 *           description: 用戶ID
 *         meme:
 *           type: string
 *           description: 迷因ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *     CreateDislikeRequest:
 *       type: object
 *       required:
 *         - meme_id
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *     DislikeResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: 操作結果訊息
 *         dislike:
 *           $ref: '#/components/schemas/Dislike'
 */

/**
 * @swagger
 * /api/dislikes:
 *   post:
 *     summary: 為迷因按噓
 *     tags: [Dislikes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDislikeRequest'
 *     responses:
 *       201:
 *         description: 按噓成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DislikeResponse'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   delete:
 *     summary: 取消對迷因的噓
 *     tags: [Dislikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: meme_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 取消噓成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得迷因的噓數和噓的用戶列表
 *     tags: [Dislikes]
 *     parameters:
 *       - in: query
 *         name: meme_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
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
 *         description: 成功取得噓的資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDislikes:
 *                   type: integer
 *                   description: 總噓數
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       400:
 *         description: 請求參數錯誤
 */

/**
 * @swagger
 * /api/dislikes/toggle:
 *   post:
 *     summary: 切換噓/取消噓狀態
 *     tags: [Dislikes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDislikeRequest'
 *     responses:
 *       200:
 *         description: 切換成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 isDisliked:
 *                   type: boolean
 *                   description: 當前是否已按噓
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */

// 建立噓
router.post('/', token, isUser, createDislike)
// 取消噓
router.delete('/', token, isUser, deleteDislike) // 用 query string 傳 meme_id
// 查詢某迷因噓數（可選）
router.get('/', getDislikes)
// 切換噓/取消噓
router.post('/toggle', token, isUser, toggleDislike)

export default router
