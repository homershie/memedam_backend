import express from 'express'
import {
  followUser,
  unfollowUser,
  toggleFollow,
  getFollowing,
  getFollowers,
  checkFollowStatus,
  getUserStats,
} from '../controllers/followController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Follow:
 *       type: object
 *       required:
 *         - follower
 *         - following
 *       properties:
 *         _id:
 *           type: string
 *           description: 追隨關係唯一ID
 *         follower:
 *           type: string
 *           description: 追隨者ID
 *         following:
 *           type: string
 *           description: 被追隨者ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *     FollowRequest:
 *       type: object
 *       required:
 *         - user_id
 *       properties:
 *         user_id:
 *           type: string
 *           description: 要追隨的用戶ID
 *     FollowStats:
 *       type: object
 *       properties:
 *         followingCount:
 *           type: integer
 *           description: 追隨人數
 *         followersCount:
 *           type: integer
 *           description: 粉絲數
 *         isFollowing:
 *           type: boolean
 *           description: 當前用戶是否追隨該用戶
 *     FollowList:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
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
 * /api/follows/follow:
 *   post:
 *     summary: 追隨用戶
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FollowRequest'
 *     responses:
 *       201:
 *         description: 追隨成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 follow:
 *                   $ref: '#/components/schemas/Follow'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 用戶不存在
 */

/**
 * @swagger
 * /api/follows/unfollow:
 *   post:
 *     summary: 取消追隨用戶
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FollowRequest'
 *     responses:
 *       200:
 *         description: 取消追隨成功
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
 *       404:
 *         description: 用戶不存在
 */

/**
 * @swagger
 * /api/follows/toggle:
 *   post:
 *     summary: 切換追隨狀態
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FollowRequest'
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
 *                 isFollowing:
 *                   type: boolean
 *                   description: 當前是否已追隨
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 用戶不存在
 */

/**
 * @swagger
 * /api/follows/status/{user_id}:
 *   get:
 *     summary: 檢查是否追隨某個用戶
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     responses:
 *       200:
 *         description: 成功取得追隨狀態
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFollowing:
 *                   type: boolean
 *                   description: 是否已追隨
 *       401:
 *         description: 未授權
 *       404:
 *         description: 用戶不存在
 */

/**
 * @swagger
 * /api/follows/following/{user_id}:
 *   get:
 *     summary: 獲取指定用戶的追隨列表（我追隨的人）
 *     tags: [Follows]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
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
 *         description: 成功取得追隨列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FollowList'
 *       404:
 *         description: 用戶不存在
 */

/**
 * @swagger
 * /api/follows/followers/{user_id}:
 *   get:
 *     summary: 獲取指定用戶的粉絲列表（追隨我的人）
 *     tags: [Follows]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
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
 *         description: 成功取得粉絲列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FollowList'
 *       404:
 *         description: 用戶不存在
 */

/**
 * @swagger
 * /api/follows/stats/{user_id}:
 *   get:
 *     summary: 獲取用戶統計資訊
 *     tags: [Follows]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     responses:
 *       200:
 *         description: 成功取得用戶統計
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FollowStats'
 *       404:
 *         description: 用戶不存在
 */

// 追隨用戶
router.post('/follow', token, isUser, followUser)

// 取消追隨用戶
router.post('/unfollow', token, isUser, unfollowUser)

// 切換追隨狀態（推薦使用此API）
router.post('/toggle', token, isUser, toggleFollow)

// 檢查是否追隨某個用戶
router.get('/status/:user_id', token, isUser, checkFollowStatus)

// 獲取指定用戶的追隨列表（我追隨的人）
router.get('/following/:user_id', getFollowing)

// 獲取指定用戶的粉絲列表（追隨我的人）
router.get('/followers/:user_id', getFollowers)

// 獲取用戶統計資訊
router.get('/stats/:user_id', getUserStats)

export default router
