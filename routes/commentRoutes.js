import express from 'express'
import {
  createComment,
  getComments,
  getCommentById,
  updateComment,
  deleteComment,
  validateCreateComment,
} from '../controllers/commentController.js'
import { token, isUser, canEditComment } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       required:
 *         - content
 *         - user
 *         - meme
 *       properties:
 *         _id:
 *           type: string
 *           description: 留言唯一ID
 *         content:
 *           type: string
 *           description: 留言內容
 *         user:
 *           type: string
 *           description: 用戶ID
 *         meme:
 *           type: string
 *           description: 迷因ID
 *         parentComment:
 *           type: string
 *           description: 父留言ID（回覆功能）
 *         likes:
 *           type: integer
 *           description: 讚數
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateCommentRequest:
 *       type: object
 *       required:
 *         - content
 *         - meme_id
 *       properties:
 *         content:
 *           type: string
 *           description: 留言內容
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *         parent_comment_id:
 *           type: string
 *           description: 父留言ID（可選）
 *     UpdateCommentRequest:
 *       type: object
 *       required:
 *         - content
 *       properties:
 *         content:
 *           type: string
 *           description: 更新後的留言內容
 */

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: 建立新留言
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCommentRequest'
 *     responses:
 *       201:
 *         description: 留言創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 comment:
 *                   $ref: '#/components/schemas/Comment'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得留言列表
 *     tags: [Comments]
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
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, most_liked]
 *           default: newest
 *         description: 排序方式
 *     responses:
 *       200:
 *         description: 成功取得留言列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
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
 * /api/comments/{id}:
 *   get:
 *     summary: 取得單一留言
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 留言ID
 *     responses:
 *       200:
 *         description: 成功取得留言
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: 留言不存在
 *   put:
 *     summary: 更新留言
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 留言ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCommentRequest'
 *     responses:
 *       200:
 *         description: 留言更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 comment:
 *                   $ref: '#/components/schemas/Comment'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 留言不存在
 *   delete:
 *     summary: 刪除留言
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 留言ID
 *     responses:
 *       200:
 *         description: 留言刪除成功
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
 *         description: 留言不存在
 */

// 建立留言
router.post('/', token, isUser, validateCreateComment, createComment)
// 取得所有留言
router.get('/', getComments)
// 取得單一留言
router.get('/:id', getCommentById)
// 更新留言
router.put('/:id', token, canEditComment, updateComment)
// 刪除留言
router.delete('/:id', token, canEditComment, deleteComment)

export default router
