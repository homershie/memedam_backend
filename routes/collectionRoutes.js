import express from 'express'
import {
  createCollection,
  getCollections,
  deleteCollection,
  toggleCollection,
  validateCreateCollection,
} from '../controllers/collectionController.js'
import { token, isUser, blockBannedUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Collection:
 *       type: object
 *       required:
 *         - user
 *         - meme
 *       properties:
 *         _id:
 *           type: string
 *           description: 收藏唯一ID
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
 *     CreateCollectionRequest:
 *       type: object
 *       required:
 *         - meme_id
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *     CollectionResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: 操作結果訊息
 *         collection:
 *           $ref: '#/components/schemas/Collection'
 */

/**
 * @swagger
 * /api/collections:
 *   post:
 *     summary: 收藏迷因
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCollectionRequest'
 *     responses:
 *       201:
 *         description: 收藏成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CollectionResponse'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   delete:
 *     summary: 取消收藏迷因
 *     tags: [Collections]
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
 *         description: 取消收藏成功
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
 *     summary: 取得用戶的收藏列表
 *     tags: [Collections]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: 用戶ID（可選，不提供則取得當前用戶）
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
 *         description: 成功取得收藏列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Collection'
 *                 memes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meme'
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
 * /api/collections/toggle:
 *   post:
 *     summary: 切換收藏/取消收藏狀態
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCollectionRequest'
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
 *                 isCollected:
 *                   type: boolean
 *                   description: 當前是否已收藏
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */

// 收藏
router.post('/', token, isUser, blockBannedUser, validateCreateCollection, createCollection)
// 取消收藏
router.delete('/', token, isUser, blockBannedUser, deleteCollection) // 用 query string 或 body 傳 meme_id
// 查詢收藏
router.get('/', getCollections)
// 切換收藏/取消收藏
router.post('/toggle', token, isUser, blockBannedUser, toggleCollection)

export default router
