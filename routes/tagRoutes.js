import express from 'express'
import {
  createTag,
  getTags,
  getTagById,
  getPopularTags,
  updateTag,
  deleteTag,
} from '../controllers/tagController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Tag:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: 標籤唯一ID
 *         name:
 *           type: string
 *           description: 標籤名稱
 *         description:
 *           type: string
 *           description: 標籤描述
 *         usageCount:
 *           type: integer
 *           description: 使用次數
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateTagRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: 標籤名稱
 *         description:
 *           type: string
 *           description: 標籤描述
 *     UpdateTagRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: 標籤名稱
 *         description:
 *           type: string
 *           description: 標籤描述
 */

/**
 * @swagger
 * /api/tags:
 *   post:
 *     summary: 建立新標籤
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTagRequest'
 *     responses:
 *       201:
 *         description: 標籤創建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得所有標籤
 *     tags: [Tags]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字
 *     responses:
 *       200:
 *         description: 成功取得標籤列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 */
router.post('/', token, isUser, createTag)
router.get('/', getTags)

/**
 * @swagger
 * /api/tags/popular:
 *   get:
 *     summary: 取得熱門標籤
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 返回數量
 *     responses:
 *       200:
 *         description: 成功取得熱門標籤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 * /api/tags/{id}:
 *   get:
 *     summary: 取得指定標籤
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 標籤ID
 *     responses:
 *       200:
 *         description: 成功取得標籤資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       404:
 *         description: 標籤不存在
 *   put:
 *     summary: 更新標籤
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 標籤ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTagRequest'
 *     responses:
 *       200:
 *         description: 標籤更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 標籤不存在
 *   delete:
 *     summary: 刪除標籤
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 標籤ID
 *     responses:
 *       200:
 *         description: 標籤刪除成功
 *       401:
 *         description: 未授權
 *       404:
 *         description: 標籤不存在
 */
// 取得熱門標籤（必須在 /:id 之前）
router.get('/popular', getPopularTags)

// 基本 CRUD 操作（必須在最後）
router.get('/:id', getTagById)
router.put('/:id', token, isUser, updateTag)
router.delete('/:id', token, isUser, deleteTag)

export default router
