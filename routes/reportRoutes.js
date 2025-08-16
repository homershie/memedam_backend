import express from 'express'
import {
  createReport,
  getReports,
  getMyReports,
  getReportById,
  resolveReport,
  batchResolveReports,
  deleteReport,
  getReportStats,
  validateCreateReport,
  validateResolveReport,
  reportReasons,
  reportStatuses,
  actionTypes,
} from '../controllers/reportController.js'
import { token, isUser, blockBannedUser, isManager, canViewReport } from '../middleware/auth.js'
import { reportSubmissionLimiter, reportWeeklyLimiter } from '../middleware/rateLimit.js'
import { reportQualityCheck } from '../middleware/reportQualityCheck.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       required:
 *         - reporter_id
 *         - target_type
 *         - target_id
 *         - reason
 *       properties:
 *         _id:
 *           type: string
 *           description: 檢舉唯一ID
 *         reporter_id:
 *           type: string
 *           description: 檢舉者ID
 *         target_type:
 *           type: string
 *           enum: [meme, comment, user]
 *           description: 檢舉目標類型
 *         target_id:
 *           type: string
 *           description: 檢舉目標ID
 *         reason:
 *           type: string
 *           enum: [inappropriate, hate_speech, spam, copyright, other]
 *           description: 檢舉原因
 *         description:
 *           type: string
 *           description: 詳細描述
 *         status:
 *           type: string
 *           enum: [pending, processed, rejected]
 *           default: pending
 *           description: 處理狀態
 *         action:
 *           type: string
 *           enum: [none, remove_content, soft_hide, age_gate, mark_nsfw, lock_comments, issue_strike, warn_author]
 *           default: none
 *           description: 處理方式
 *         action_meta:
 *           type: object
 *           description: 處理方式詳細資訊
 *         admin_comment:
 *           type: string
 *           description: 管理員備註
 *         processed_at:
 *           type: string
 *           format: date-time
 *           description: 處理時間
 *         handler_id:
 *           type: string
 *           description: 處理人員ID
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
 *         - target_type
 *         - target_id
 *         - reason
 *       properties:
 *         target_type:
 *           type: string
 *           enum: [meme, comment, user]
 *           description: 檢舉目標類型
 *         target_id:
 *           type: string
 *           description: 檢舉目標ID
 *         reason:
 *           type: string
 *           enum: [inappropriate, hate_speech, spam, copyright, other]
 *           description: 檢舉原因
 *         description:
 *           type: string
 *           description: 詳細描述
 *     ResolveReportRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, processed, rejected]
 *           description: 處理狀態
 *         action:
 *           type: string
 *           enum: [none, remove_content, soft_hide, age_gate, mark_nsfw, lock_comments, issue_strike, warn_author]
 *           description: 處理方式
 *         action_meta:
 *           type: object
 *           description: 處理方式詳細資訊
 *         admin_comment:
 *           type: string
 *           description: 管理員備註
 *     BatchResolveRequest:
 *       type: object
 *       required:
 *         - ids
 *         - status
 *       properties:
 *         ids:
 *           type: array
 *           items:
 *             type: string
 *           description: 要處理的檢舉ID列表
 *         status:
 *           type: string
 *           enum: [pending, processed, rejected]
 *           description: 處理狀態
 *         action:
 *           type: string
 *           enum: [none, remove_content, soft_hide, age_gate, mark_nsfw, lock_comments, issue_strike, warn_author]
 *           description: 處理方式
 *         action_meta:
 *           type: object
 *           description: 處理方式詳細資訊
 *         admin_comment:
 *           type: string
 *           description: 管理員備註
 */

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: 建立檢舉
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
 *         description: 檢舉創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Report'
 *                 error:
 *                   type: null
 *       400:
 *         description: 請求參數錯誤
 *       409:
 *         description: 已檢舉過此內容
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得檢舉列表（管理員功能）
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
 *           enum: [pending, processed, rejected]
 *         description: 篩選處理狀態
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *           enum: [inappropriate, hate_speech, spam, copyright, other]
 *         description: 篩選檢舉原因
 *       - in: query
 *         name: target_type
 *         schema:
 *           type: string
 *           enum: [meme, comment, user]
 *         description: 篩選目標類型
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [target, none]
 *           default: target
 *         description: 群組化查詢
 *     responses:
 *       200:
 *         description: 成功取得檢舉列表
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/reports/my:
 *   get:
 *     summary: 取得用戶自己的檢舉列表
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
 *           enum: [pending, processed, rejected]
 *         description: 篩選處理狀態
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: 排序欄位
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: 排序方向
 *     responses:
 *       200:
 *         description: 成功取得用戶檢舉列表
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: 取得單一檢舉詳情
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 檢舉ID
 *     responses:
 *       200:
 *         description: 成功取得檢舉詳情
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 檢舉不存在
 *   put:
 *     summary: 處理檢舉
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 檢舉ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResolveReportRequest'
 *     responses:
 *       200:
 *         description: 檢舉處理成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 檢舉不存在
 *   delete:
 *     summary: 刪除檢舉
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 檢舉ID
 *     responses:
 *       200:
 *         description: 檢舉刪除成功
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 檢舉不存在
 */

/**
 * @swagger
 * /api/reports/batch/resolve:
 *   put:
 *     summary: 批次處理檢舉
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchResolveRequest'
 *     responses:
 *       200:
 *         description: 批次處理成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/reports/stats:
 *   get:
 *     summary: 取得檢舉統計
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1d, 7d, 30d]
 *           default: 7d
 *         description: 統計期間
 *     responses:
 *       200:
 *         description: 成功取得統計資料
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/reports/options:
 *   get:
 *     summary: 取得檢舉選項
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: 成功取得選項
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reasons:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 *                 statuses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 *                 actions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 */

// 建立檢舉（包含速率限制和品質檢查）
router.post(
  '/',
  token,
  isUser,
  blockBannedUser,
  reportSubmissionLimiter,
  reportWeeklyLimiter,
  reportQualityCheck,
  validateCreateReport,
  createReport,
)

// 取得用戶自己的檢舉列表
router.get('/my', token, isUser, getMyReports)

// 取得檢舉統計
router.get('/stats', token, isManager, getReportStats)

// 取得檢舉選項
router.get('/options', (req, res) => {
  res.json({
    success: true,
    data: {
      reasons: reportReasons,
      statuses: reportStatuses,
      actions: actionTypes,
    },
    error: null,
  })
})

// 取得檢舉列表（管理員功能）
router.get('/', token, isManager, getReports)

// 取得單一檢舉詳情
router.get('/:id', token, canViewReport, getReportById)

// 處理檢舉
router.put('/:id/resolve', token, isManager, validateResolveReport, resolveReport)

// 批次處理檢舉
router.put('/batch/resolve', token, isManager, validateResolveReport, batchResolveReports)

// 刪除檢舉
router.delete('/:id', token, isManager, deleteReport)

export default router
