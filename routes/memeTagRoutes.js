import express from 'express'
import {
  createMemeTag,
  batchCreateMemeTags,
  getMemeTags,
  getMemeTagById,
  getTagsByMemeId,
  getMemesByTagId,
  updateMemeTag,
  deleteMemeTag,
  deleteMemeAllTags,
} from '../controllers/memeTagController.js'
import { token, isUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     MemeTag:
 *       type: object
 *       required:
 *         - meme
 *         - tag
 *       properties:
 *         _id:
 *           type: string
 *           description: 迷因標籤關聯唯一ID
 *         meme:
 *           type: string
 *           description: 迷因ID
 *         tag:
 *           type: string
 *           description: 標籤ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *     CreateMemeTagRequest:
 *       type: object
 *       required:
 *         - meme_id
 *         - tag_id
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *         tag_id:
 *           type: string
 *           description: 標籤ID
 *     BatchCreateMemeTagsRequest:
 *       type: object
 *       required:
 *         - tag_ids
 *       properties:
 *         tag_ids:
 *           type: array
 *           items:
 *             type: string
 *           description: 標籤ID陣列
 *     UpdateMemeTagRequest:
 *       type: object
 *       required:
 *         - tag_id
 *       properties:
 *         tag_id:
 *           type: string
 *           description: 新的標籤ID
 */

/**
 * @swagger
 * /api/meme-tags:
 *   post:
 *     summary: 建立迷因標籤關聯
 *     tags: [MemeTags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMemeTagRequest'
 *     responses:
 *       201:
 *         description: 迷因標籤關聯創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 memeTag:
 *                   $ref: '#/components/schemas/MemeTag'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得所有迷因標籤關聯
 *     tags: [MemeTags]
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
 *         description: 成功取得迷因標籤關聯列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memeTags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MemeTag'
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

/**
 * @swagger
 * /api/meme-tags/{memeId}/batch:
 *   post:
 *     summary: 批量為迷因添加標籤
 *     tags: [MemeTags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchCreateMemeTagsRequest'
 *     responses:
 *       201:
 *         description: 批量添加標籤成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 memeTags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MemeTag'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/meme-tags/batch:
 *   post:
 *     summary: 批量為迷因添加標籤（兼容舊格式）
 *     tags: [MemeTags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meme_id
 *               - tag_ids
 *             properties:
 *               meme_id:
 *                 type: string
 *                 description: 迷因ID
 *               tag_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 標籤ID陣列
 *     responses:
 *       201:
 *         description: 批量添加標籤成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 memeTags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MemeTag'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/meme-tags/meme/{memeId}/tags:
 *   get:
 *     summary: 根據迷因ID獲取所有標籤
 *     tags: [MemeTags]
 *     parameters:
 *       - in: path
 *         name: memeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 成功取得迷因的標籤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *       404:
 *         description: 迷因不存在
 */

/**
 * @swagger
 * /api/meme-tags/tag/{tagId}/memes:
 *   get:
 *     summary: 根據標籤ID獲取所有迷因
 *     tags: [MemeTags]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: string
 *         description: 標籤ID
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
 *         description: 成功取得標籤的迷因
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
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
 *       404:
 *         description: 標籤不存在
 */

/**
 * @swagger
 * /api/meme-tags/relation/{id}:
 *   get:
 *     summary: 取得單一迷因標籤關聯
 *     tags: [MemeTags]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因標籤關聯ID
 *     responses:
 *       200:
 *         description: 成功取得迷因標籤關聯
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MemeTag'
 *       404:
 *         description: 關聯不存在
 */

/**
 * @swagger
 * /api/meme-tags/{id}:
 *   put:
 *     summary: 更新迷因標籤關聯
 *     tags: [MemeTags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因標籤關聯ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMemeTagRequest'
 *     responses:
 *       200:
 *         description: 迷因標籤關聯更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 memeTag:
 *                   $ref: '#/components/schemas/MemeTag'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       404:
 *         description: 關聯不存在
 *   delete:
 *     summary: 刪除迷因標籤關聯
 *     tags: [MemeTags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因標籤關聯ID
 *     responses:
 *       200:
 *         description: 迷因標籤關聯刪除成功
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
 *         description: 關聯不存在
 */

/**
 * @swagger
 * /api/meme-tags/meme/{memeId}/tags:
 *   delete:
 *     summary: 批量刪除迷因的所有標籤
 *     tags: [MemeTags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 批量刪除標籤成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *                   description: 刪除的標籤數量
 *       401:
 *         description: 未授權
 *       404:
 *         description: 迷因不存在
 */

// 建立迷因標籤關聯
router.post('/', token, isUser, createMemeTag)
// 批量為迷因添加標籤（匹配前端調用格式）
router.post('/:memeId/batch', token, isUser, batchCreateMemeTags)
// 批量為迷因添加標籤（兼容舊格式）
router.post('/batch', token, isUser, batchCreateMemeTags)
// 取得所有迷因標籤關聯 - 公開API
router.get('/', getMemeTags)
// 根據迷因ID獲取所有標籤 - 公開API
router.get('/meme/:memeId/tags', getTagsByMemeId)
// 根據標籤ID獲取所有迷因 - 公開API
router.get('/tag/:tagId/memes', getMemesByTagId)
// 取得單一迷因標籤關聯 - 公開API
router.get('/relation/:id', getMemeTagById)
// 更新迷因標籤關聯
router.put('/:id', token, isUser, updateMemeTag)
// 批量刪除迷因的所有標籤
router.delete('/meme/:memeId/tags', token, isUser, deleteMemeAllTags)
// 刪除迷因標籤關聯
router.delete('/:id', token, isUser, deleteMemeTag)

export default router
