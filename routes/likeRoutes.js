import express from 'express'
import { createLike, getLikes, deleteLike, toggleLike } from '../controllers/likeController.js'
import { token, isUser, blockBannedUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Like:
 *       type: object
 *       required:
 *         - user
 *         - meme
 *       properties:
 *         _id:
 *           type: string
 *           description: 讚的唯一ID
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
 *     CreateLikeRequest:
 *       type: object
 *       required:
 *         - meme_id
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *     LikeResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: 操作結果訊息
 *         like:
 *           $ref: '#/components/schemas/Like'
 */

/**
 * @swagger
 * /api/likes:
 *   post:
 *     summary: 為迷因按讚
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLikeRequest'
 *     responses:
 *       201:
 *         description: 按讚成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LikeResponse'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   delete:
 *     summary: 取消對迷因的讚
 *     tags: [Likes]
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
 *         description: 取消讚成功
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
 *     summary: 取得迷因的讚數和讚的用戶列表
 *     tags: [Likes]
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
 *         description: 成功取得讚的資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalLikes:
 *                   type: integer
 *                   description: 總讚數
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
 * /api/likes/toggle:
 *   post:
 *     summary: 切換讚/取消讚狀態
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLikeRequest'
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
 *                 isLiked:
 *                   type: boolean
 *                   description: 當前是否已按讚
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */

// 建立讚
router.post('/', token, isUser, blockBannedUser, createLike)
// 取消讚
router.delete('/', token, isUser, blockBannedUser, deleteLike) // 用 query string 傳 meme_id
// 查詢某迷因讚數（可選）
router.get('/', getLikes)
// 切換讚/取消讚
router.post('/toggle', token, isUser, blockBannedUser, toggleLike)

export default router
