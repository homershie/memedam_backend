import express from 'express'
import {
  createMemeVersion,
  getMemeVersions,
  getMemeVersionById,
  updateMemeVersion,
  deleteMemeVersion,
} from '../controllers/memeVersionController.js'
import { token, isUser, blockBannedUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     MemeVersion:
 *       type: object
 *       required:
 *         - meme
 *         - version
 *         - changes
 *         - author
 *       properties:
 *         _id:
 *           type: string
 *           description: 迷因版本唯一ID
 *         meme:
 *           type: string
 *           description: 迷因ID
 *         version:
 *           type: integer
 *           description: 版本號
 *         changes:
 *           type: object
 *           description: 版本變更內容
 *         author:
 *           type: string
 *           description: 版本作者ID
 *         approved:
 *           type: boolean
 *           default: false
 *           description: 是否已審核通過
 *         approvedBy:
 *           type: string
 *           description: 審核者ID
 *         approvedAt:
 *           type: string
 *           format: date-time
 *           description: 審核時間
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateMemeVersionRequest:
 *       type: object
 *       required:
 *         - meme_id
 *         - changes
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *         changes:
 *           type: object
 *           description: 版本變更內容
 *         notes:
 *           type: string
 *           description: 版本說明
 *     UpdateMemeVersionRequest:
 *       type: object
 *       properties:
 *         changes:
 *           type: object
 *           description: 版本變更內容
 *         notes:
 *           type: string
 *           description: 版本說明
 *         approved:
 *           type: boolean
 *           description: 審核狀態
 */

/**
 * @swagger
 * /api/meme-versions:
 *   post:
 *     summary: 建立迷因版本
 *     tags: [MemeVersions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMemeVersionRequest'
 *     responses:
 *       201:
 *         description: 迷因版本創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 memeVersion:
 *                   $ref: '#/components/schemas/MemeVersion'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得迷因版本列表
 *     tags: [MemeVersions]
 *     security:
 *       - bearerAuth: []
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
 *       - in: query
 *         name: approved
 *         schema:
 *           type: boolean
 *         description: 篩選審核狀態
 *     responses:
 *       200:
 *         description: 成功取得迷因版本列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memeVersions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MemeVersion'
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
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/meme-versions/{id}:
 *   get:
 *     summary: 取得單一迷因版本
 *     tags: [MemeVersions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因版本ID
 *     responses:
 *       200:
 *         description: 成功取得迷因版本
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MemeVersion'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 迷因版本不存在
 *   put:
 *     summary: 更新迷因版本
 *     tags: [MemeVersions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因版本ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMemeVersionRequest'
 *     responses:
 *       200:
 *         description: 迷因版本更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 memeVersion:
 *                   $ref: '#/components/schemas/MemeVersion'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 迷因版本不存在
 *   delete:
 *     summary: 刪除迷因版本
 *     tags: [MemeVersions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因版本ID
 *     responses:
 *       200:
 *         description: 迷因版本刪除成功
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
 *         description: 迷因版本不存在
 */

// 建立迷因版本
router.post('/', token, isUser, blockBannedUser, createMemeVersion)
// 取得所有迷因版本
router.get('/', token, isUser, blockBannedUser, getMemeVersions)
// 取得單一迷因版本
router.get('/:id', token, isUser, blockBannedUser, getMemeVersionById)
// 更新迷因版本
router.put('/:id', token, isUser, blockBannedUser, updateMemeVersion)
// 刪除迷因版本
router.delete('/:id', token, isUser, blockBannedUser, deleteMemeVersion)

export default router
