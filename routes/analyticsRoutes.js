/**
 * 分析與監控路由
 * 提供推薦效果指標和 A/B 測試管理功能
 */

import express from 'express'
import {
  trackRecommendation,
  updateInteraction,
  getAlgorithmStats,
  getUserEffectiveness,
  createABTest,
  getABTests,
  getABTestDetails,
  updateABTestStatus,
  getAnalyticsDashboard,
} from '../controllers/analyticsController.js'
import { token } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     RecommendationTracking:
 *       type: object
 *       required:
 *         - meme_id
 *         - algorithm
 *         - recommendation_score
 *         - recommendation_rank
 *       properties:
 *         meme_id:
 *           type: string
 *           description: 迷因ID
 *         algorithm:
 *           type: string
 *           description: 推薦演算法
 *         recommendation_score:
 *           type: number
 *           description: 推薦分數
 *         recommendation_rank:
 *           type: integer
 *           description: 推薦排名
 *         ab_test_id:
 *           type: string
 *           description: A/B測試ID
 *         ab_test_variant:
 *           type: string
 *           description: A/B測試變體
 *         recommendation_context:
 *           type: object
 *           properties:
 *             page:
 *               type: string
 *             position:
 *               type: integer
 *             session_id:
 *               type: string
 *         user_features:
 *           type: object
 *           properties:
 *             is_new_user:
 *               type: boolean
 *             user_activity_level:
 *               type: string
 *             user_preferences:
 *               type: object
 *         meme_features:
 *           type: object
 *     ABTest:
 *       type: object
 *       required:
 *         - test_id
 *         - name
 *         - test_type
 *         - primary_metric
 *         - variants
 *         - start_date
 *         - end_date
 *       properties:
 *         test_id:
 *           type: string
 *           description: 測試ID
 *         name:
 *           type: string
 *           description: 測試名稱
 *         description:
 *           type: string
 *           description: 測試描述
 *         test_type:
 *           type: string
 *           description: 測試類型
 *         primary_metric:
 *           type: string
 *           description: 主要指標
 *         secondary_metrics:
 *           type: array
 *           items:
 *             type: string
 *           description: 次要指標
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               variant_id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               configuration:
 *                 type: object
 *               traffic_percentage:
 *                 type: number
 *         target_audience:
 *           type: object
 *           properties:
 *             user_segments:
 *               type: array
 *               items:
 *                 type: string
 *             user_activity_levels:
 *               type: array
 *               items:
 *                 type: string
 *             geographic_regions:
 *               type: array
 *               items:
 *                 type: string
 *             device_types:
 *               type: array
 *               items:
 *                 type: string
 *         start_date:
 *           type: string
 *           format: date-time
 *         end_date:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [draft, active, paused, completed]
 */

/**
 * @swagger
 * /api/analytics/track-recommendation:
 *   post:
 *     summary: 記錄推薦指標
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecommendationTracking'
 *     responses:
 *       200:
 *         description: 推薦指標記錄成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */
router.post('/track-recommendation', token, trackRecommendation)

/**
 * @swagger
 * /api/analytics/update-interaction:
 *   put:
 *     summary: 更新推薦互動指標
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metrics_id
 *               - interaction_type
 *             properties:
 *               metrics_id:
 *                 type: string
 *                 description: 指標ID
 *               interaction_type:
 *                 type: string
 *                 description: 互動類型
 *               view_duration:
 *                 type: number
 *                 description: 觀看時長（秒）
 *               user_rating:
 *                 type: number
 *                 description: 用戶評分
 *     responses:
 *       200:
 *         description: 互動指標更新成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */
router.put('/update-interaction', token, updateInteraction)

/**
 * @swagger
 * /api/analytics/algorithm-stats:
 *   get:
 *     summary: 取得推薦演算法統計
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: algorithm
 *         schema:
 *           type: string
 *         description: 特定演算法（可選）
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日期（ISO 格式）
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 結束日期（ISO 格式）
 *       - in: query
 *         name: group_by
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: 分組方式
 *     responses:
 *       200:
 *         description: 成功取得演算法統計
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   description: 統計數據
 *       401:
 *         description: 未授權
 */
router.get('/algorithm-stats', token, getAlgorithmStats)

/**
 * @swagger
 * /api/analytics/user-effectiveness:
 *   get:
 *     summary: 取得用戶推薦效果分析
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日期（ISO 格式）
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 結束日期（ISO 格式）
 *     responses:
 *       200:
 *         description: 成功取得用戶效果分析
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 effectiveness:
 *                   type: object
 *                   description: 效果分析數據
 *       401:
 *         description: 未授權
 */
router.get('/user-effectiveness', token, getUserEffectiveness)

/**
 * @swagger
 * /api/analytics/ab-tests:
 *   post:
 *     summary: 建立 A/B 測試
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ABTest'
 *     responses:
 *       201:
 *         description: A/B 測試創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 test:
 *                   $ref: '#/components/schemas/ABTest'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得 A/B 測試列表
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 測試狀態篩選
 *       - in: query
 *         name: test_type
 *         schema:
 *           type: string
 *         description: 測試類型篩選
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
 *         description: 成功取得 A/B 測試列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ABTest'
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
router.post('/ab-tests', token, createABTest)
router.get('/ab-tests', token, getABTests)

/**
 * @swagger
 * /api/analytics/ab-tests/{testId}/status:
 *   put:
 *     summary: 更新 A/B 測試狀態
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *         description: 測試 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, active, paused, completed]
 *                 description: 新狀態
 *     responses:
 *       200:
 *         description: 測試狀態更新成功
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
 *         description: 測試不存在
 */
router.put('/ab-tests/:testId/status', token, updateABTestStatus)

/**
 * @swagger
 * /api/analytics/ab-tests/{testId}:
 *   get:
 *     summary: 取得 A/B 測試詳細資訊
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *         description: 測試 ID
 *     responses:
 *       200:
 *         description: 成功取得測試詳細資訊
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ABTest'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 測試不存在
 */
router.get('/ab-tests/:testId', token, getABTestDetails)

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: 取得推薦效果儀表板
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日期（ISO 格式）
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 結束日期（ISO 格式）
 *     responses:
 *       200:
 *         description: 成功取得儀表板數據
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dashboard:
 *                   type: object
 *                   description: 儀表板數據
 *       401:
 *         description: 未授權
 */
router.get('/dashboard', token, getAnalyticsDashboard)

export default router
