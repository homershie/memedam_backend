/**
 * SEO 路由
 * 定義 SEO 監控和報告相關的 API 端點
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SEOMonitoringStatus:
 *       type: object
 *       properties:
 *         isMonitoring:
 *           type: boolean
 *           description: 監控是否啟用
 *         lastCheck:
 *           type: string
 *           format: date-time
 *           description: 最後檢查時間
 *         nextScheduledCheck:
 *           type: string
 *           format: date-time
 *           description: 下次預定檢查時間
 *         checkInterval:
 *           type: integer
 *           description: 檢查間隔（分鐘）
 *         status:
 *           type: string
 *           enum: [running, stopped, paused, error]
 *           description: 監控狀態
 *     SEOMetrics:
 *       type: object
 *       properties:
 *         overall_score:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: 整體SEO分數
 *         performance_trend:
 *           type: string
 *           enum: [improving, declining, stable]
 *           description: 效能趨勢
 *         seo_health:
 *           type: string
 *           enum: [excellent, good, fair, poor, critical]
 *           description: SEO健康狀態
 *         alerts_count:
 *           type: integer
 *           description: 活躍警報數量
 *         recommendations_count:
 *           type: integer
 *           description: 建議數量
 *         last_updated:
 *           type: string
 *           format: date-time
 *           description: 最後更新時間
 *         metrics:
 *           type: object
 *           description: 詳細指標數據
 *     SEOAlert:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 警報ID
 *         type:
 *           type: string
 *           enum: [performance, security, content, technical, ranking]
 *           description: 警報類型
 *         severity:
 *           type: string
 *           enum: [critical, high, medium, low, info]
 *           description: 警報嚴重程度
 *         title:
 *           type: string
 *           description: 警報標題
 *         message:
 *           type: string
 *           description: 警報訊息
 *         affected_pages:
 *           type: array
 *           items:
 *             type: string
 *           description: 受影響的頁面
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 警報時間
 *         resolved:
 *           type: boolean
 *           description: 是否已解決
 *         resolution_note:
 *           type: string
 *           description: 解決註記
 *         resolved_at:
 *           type: string
 *           format: date-time
 *           description: 解決時間
 *     SEORecommendation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 建議ID
 *         category:
 *           type: string
 *           enum: [performance, content, technical, mobile, security]
 *           description: 建議分類
 *         priority:
 *           type: string
 *           enum: [high, medium, low]
 *           description: 優先級
 *         title:
 *           type: string
 *           description: 建議標題
 *         description:
 *           type: string
 *           description: 建議描述
 *         impact:
 *           type: string
 *           enum: [high, medium, low]
 *           description: 預計影響程度
 *         effort:
 *           type: string
 *           enum: [low, medium, high]
 *           description: 實施難度
 *         affected_pages:
 *           type: array
 *           items:
 *             type: string
 *           description: 受影響頁面
 *         implementation_steps:
 *           type: array
 *           items:
 *             type: string
 *           description: 實施步驟
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 建立時間
 *     SEOReport:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           description: 報告日期
 *         summary:
 *           type: object
 *           description: 報告摘要
 *         metrics:
 *           type: object
 *           description: 詳細指標
 *         alerts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SEOAlert'
 *           description: 警報列表
 *         recommendations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SEORecommendation'
 *           description: 建議列表
 *         generated_at:
 *           type: string
 *           format: date-time
 *           description: 報告生成時間
 *     SEODashboard:
 *       type: object
 *       properties:
 *         monitoring_status:
 *           $ref: '#/components/schemas/SEOMonitoringStatus'
 *         latest_metrics:
 *           $ref: '#/components/schemas/SEOMetrics'
 *         active_alerts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SEOAlert'
 *           description: 活躍警報
 *         recent_reports:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               score:
 *                 type: number
 *               trend:
 *                 type: string
 *         recommendations_summary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             by_priority:
 *               type: object
 *             by_category:
 *               type: object
 *         last_updated:
 *           type: string
 *           format: date-time
 *           description: 最後更新時間
 *     AlertResolutionRequest:
 *       type: object
 *       properties:
 *         resolution_note:
 *           type: string
 *           description: 解決註記
 *       required:
 *         - resolution_note
 *     HealthCheckResult:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [passed, failed, warning]
 *           description: 健康檢查狀態
 *         score:
 *           type: number
 *           description: 健康分數
 *         issues:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               severity:
 *                 type: string
 *               message:
 *                 type: string
 *               affected_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 檢查時間
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT Token認證
 *   tags:
 *     - name: SEO
 *       description: SEO監控和分析相關API
 */

import express from 'express'
import seoController from '../controllers/seoController.js'
import { token } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * /api/seo/status:
 *   get:
 *     summary: 取得SEO監控狀態
 *     description: 獲取當前SEO監控系統的運行狀態，包括是否啟用、檢查時間間隔等資訊
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得監控狀態
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SEOMonitoringStatus'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status', token, seoController.getMonitoringStatus)

/**
 * @swagger
 * /api/seo/metrics:
 *   get:
 *     summary: 取得最新SEO指標
 *     description: 獲取最新的SEO效能指標，包括整體分數、趨勢、健康狀態等
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得最新指標
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SEOMetrics'
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/metrics', token, seoController.getLatestMetrics)

/**
 * @swagger
 * /api/seo/reports:
 *   get:
 *     summary: 取得SEO報告
 *     description: 獲取指定日期的SEO詳細報告，包含指標、警報和建議
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 報告日期（預設為今天）
 *         example: "2024-01-15"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: 報告類型
 *     responses:
 *       200:
 *         description: 成功取得SEO報告
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SEOReport'
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 報告不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/reports', token, seoController.getSEOReport)

/**
 * @swagger
 * /api/seo/reports/list:
 *   get:
 *     summary: 取得SEO報告列表
 *     description: 獲取所有可用SEO報告的摘要列表
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 30
 *         description: 返回的報告數量上限
 *     responses:
 *       200:
 *         description: 成功取得報告列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reports:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2024-01-15"
 *                           overall_score:
 *                             type: number
 *                             example: 85
 *                           performance_trend:
 *                             type: string
 *                             example: "improving"
 *                           seo_health:
 *                             type: string
 *                             example: "good"
 *                           alerts_count:
 *                             type: integer
 *                             example: 3
 *                           recommendations_count:
 *                             type: integer
 *                             example: 12
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     limit:
 *                       type: integer
 *                       example: 30
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/reports/list', token, seoController.getSEOReportsList)

/**
 * @swagger
 * /api/seo/alerts:
 *   get:
 *     summary: 取得活躍SEO警報
 *     description: 獲取所有活躍的SEO警報，可以按嚴重程度和類型篩選
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low, info]
 *         description: 按嚴重程度篩選
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [performance, security, content, technical, ranking]
 *         description: 按類型篩選
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: 返回的警報數量上限
 *     responses:
 *       200:
 *         description: 成功取得活躍警報
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SEOAlert'
 *                     total:
 *                       type: integer
 *                       example: 8
 *                     filters:
 *                       type: object
 *                       properties:
 *                         severity:
 *                           type: string
 *                           example: "high"
 *                         type:
 *                           type: string
 *                           example: "performance"
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/alerts', token, seoController.getActiveAlerts)

/**
 * @swagger
 * /api/seo/alerts/{alertId}/resolve:
 *   post:
 *     summary: 解析SEO警報
 *     description: 標記指定的SEO警報為已解決狀態
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: 警報ID
 *         example: "alert_123456"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlertResolutionRequest'
 *     responses:
 *       200:
 *         description: 警報成功解析
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "警報已成功解析"
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 警報不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/alerts/:alertId/resolve', token, seoController.resolveAlert)

/**
 * @swagger
 * /api/seo/recommendations:
 *   get:
 *     summary: 取得SEO建議
 *     description: 獲取針對當前SEO問題的改進建議
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得SEO建議
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SEORecommendation'
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/recommendations', token, seoController.getSEORecommendations)

/**
 * @swagger
 * /api/seo/health-check:
 *   post:
 *     summary: 執行SEO健康檢查
 *     description: 手動觸發SEO健康檢查，分析網站的SEO狀態並生成報告
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 健康檢查完成
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/HealthCheckResult'
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/health-check', token, seoController.runSEOHealthCheck)

/**
 * @swagger
 * /api/seo/dashboard:
 *   get:
 *     summary: 取得SEO儀表板數據
 *     description: 獲取SEO監控的綜合儀表板數據，包含狀態、指標、警報等資訊
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得儀表板數據
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SEODashboard'
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard', token, seoController.getSEODashboard.bind(seoController))

/**
 * @swagger
 * /api/seo/monitoring/start:
 *   post:
 *     summary: 啟動SEO監控
 *     description: 啟動SEO監控系統（管理員功能）
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 監控已啟動
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "SEO監控已成功啟動"
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/monitoring/start', token, seoController.startMonitoring)

/**
 * @swagger
 * /api/seo/monitoring/stop:
 *   post:
 *     summary: 停止SEO監控
 *     description: 停止SEO監控系統（管理員功能）
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 監控已停止
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "SEO監控已成功停止"
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/monitoring/stop', token, seoController.stopMonitoring)

/**
 * @swagger
 * /api/seo/reports/generate:
 *   post:
 *     summary: 生成SEO報告
 *     description: 手動生成SEO報告（管理員功能）
 *     tags: [SEO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: 報告日期（預設為今天）
 *         example: "2024-01-15"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: 報告類型
 *     responses:
 *       200:
 *         description: 報告生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "SEO報告已成功生成"
 *                 data:
 *                   type: object
 *                   properties:
 *                     report_id:
 *                       type: string
 *                       example: "report_2024_01_15"
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: 未授權訪問
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/reports/generate', token, seoController.generateReport)

export default router
