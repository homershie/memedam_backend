import express from 'express'
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
  validateCreateReport,
} from '../controllers/reportController.js'
import {
  token,
  isUser,
  blockBannedUser,
  isManager,
  canEditReport,
  canViewReport,
} from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       required:
 *         - reporter
 *         - targetType
 *         - targetId
 *         - reason
 *         - description
 *       properties:
 *         _id:
 *           type: string
 *           description: 舉報唯一ID
 *         reporter:
 *           type: string
 *           description: 舉報者ID
 *         targetType:
 *           type: string
 *           enum: [meme, comment, user]
 *           description: 舉報目標類型
 *         targetId:
 *           type: string
 *           description: 舉報目標ID
 *         reason:
 *           type: string
 *           enum: [spam, inappropriate, copyright, harassment, other]
 *           description: 舉報原因
 *         description:
 *           type: string
 *           description: 詳細描述
 *         status:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 *           default: pending
 *           description: 處理狀態
 *         adminNotes:
 *           type: string
 *           description: 管理員備註
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateReportRequest:
 *       type: object
 *       required:
 *         - targetType
 *         - targetId
 *         - reason
 *         - description
 *       properties:
 *         targetType:
 *           type: string
 *           enum: [meme, comment, user]
 *           description: 舉報目標類型
 *         targetId:
 *           type: string
 *           description: 舉報目標ID
 *         reason:
 *           type: string
 *           enum: [spam, inappropriate, copyright, harassment, other]
 *           description: 舉報原因
 *         description:
 *           type: string
 *           description: 詳細描述
 *     UpdateReportRequest:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 *           description: 處理狀態
 *         adminNotes:
 *           type: string
 *           description: 管理員備註
 */

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: 建立舉報
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReportRequest'
 *     responses:
 *       201:
 *         description: 舉報創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 report:
 *                   $ref: '#/components/schemas/Report'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得所有舉報（管理員功能）
 *     tags: [Reports]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 *         description: 篩選處理狀態
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum: [meme, comment, user]
 *         description: 篩選目標類型
 *     responses:
 *       200:
 *         description: 成功取得舉報列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
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
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: 取得單一舉報
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 舉報ID
 *     responses:
 *       200:
 *         description: 成功取得舉報
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 舉報不存在
 *   put:
 *     summary: 更新舉報
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 舉報ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReportRequest'
 *     responses:
 *       200:
 *         description: 舉報更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 report:
 *                   $ref: '#/components/schemas/Report'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 舉報不存在
 *   delete:
 *     summary: 刪除舉報
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 舉報ID
 *     responses:
 *       200:
 *         description: 舉報刪除成功
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
 *         description: 舉報不存在
 */

// 建立舉報
router.post('/', token, isUser, blockBannedUser, validateCreateReport, createReport)
// 取得所有舉報
router.get('/', token, isManager, getReports)
// 取得單一舉報
router.get('/:id', token, canViewReport, getReportById)
// 編輯舉報
router.put('/:id', token, canEditReport, updateReport)
// 刪除舉報
router.delete('/:id', token, canEditReport, deleteReport)

export default router
