import express from 'express'
import {
  createShare,
  getShares,
  getShareById,
  updateShare,
  deleteShare,
} from '../controllers/shareController.js'
import { token, isUser, blockBannedUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Share:
 *       type: object
 *       required:
 *         - user
 *         - meme
 *         - platform
 *       properties:
 *         _id:
 *           type: string
 *           description: 分享唯一ID
 *         user:
 *           type: string
 *           description: 用戶ID
 *         meme:
 *           type: string
 *           description: 迷因ID
 *         platform:
 *           type: string
 *           enum: [facebook, twitter, instagram, line, whatsapp, copy_link]
 *           description: 分享平台
 *         shareUrl:
 *           type: string
 *           description: 分享連結
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateShareRequest:
 *       type: object
 *       required:
 *         - meme_id
 *         - platform
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *         platform:
 *           type: string
 *           enum: [facebook, twitter, instagram, line, whatsapp, copy_link]
 *           description: 分享平台
 *     UpdateShareRequest:
 *       type: object
 *       properties:
 *         platform:
 *           type: string
 *           enum: [facebook, twitter, instagram, line, whatsapp, copy_link]
 *           description: 分享平台
 */

/**
 * @swagger
 * /api/shares:
 *   post:
 *     summary: 建立新分享記錄
 *     tags: [Shares]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShareRequest'
 *     responses:
 *       201:
 *         description: 分享記錄創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 share:
 *                   $ref: '#/components/schemas/Share'
 *                 shareUrl:
 *                   type: string
 *                   description: 生成的分享連結
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得用戶的分享記錄
 *     tags: [Shares]
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
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [facebook, twitter, instagram, line, whatsapp, copy_link]
 *         description: 篩選平台
 *     responses:
 *       200:
 *         description: 成功取得分享記錄
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shares:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Share'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/shares/{id}:
 *   get:
 *     summary: 取得單一分享記錄
 *     tags: [Shares]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 分享記錄ID
 *     responses:
 *       200:
 *         description: 成功取得分享記錄
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Share'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 分享記錄不存在
 *   put:
 *     summary: 更新分享記錄
 *     tags: [Shares]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 分享記錄ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateShareRequest'
 *     responses:
 *       200:
 *         description: 分享記錄更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 share:
 *                   $ref: '#/components/schemas/Share'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 分享記錄不存在
 *   delete:
 *     summary: 刪除分享記錄
 *     tags: [Shares]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 分享記錄ID
 *     responses:
 *       200:
 *         description: 分享記錄刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *       404:
 *         description: 分享記錄不存在
 */

// 建立分享
router.post('/', token, isUser, blockBannedUser, createShare)
// 取得所有分享
router.get('/', token, isUser, blockBannedUser, getShares)
// 取得單一分享
router.get('/:id', token, isUser, blockBannedUser, getShareById)
// 更新分享
router.put('/:id', token, isUser, blockBannedUser, updateShare)
// 刪除分享
router.delete('/:id', token, isUser, blockBannedUser, deleteShare)

export default router
