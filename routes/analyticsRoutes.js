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
 * @route PUT /api/analytics/update-interaction
 * @desc 更新推薦互動指標
 * @access Private
 * @body {
 *   metrics_id: string,
 *   interaction_type: string,
 *   view_duration?: number,
 *   user_rating?: number
 * }
 */
router.put('/update-interaction', token, updateInteraction)

/**
 * @route GET /api/analytics/algorithm-stats
 * @desc 取得推薦演算法統計
 * @access Private
 * @query {string} algorithm - 特定演算法 (可選)
 * @query {string} start_date - 開始日期 (ISO 格式)
 * @query {string} end_date - 結束日期 (ISO 格式)
 * @query {string} group_by - 分組方式 (day, week, month)
 */
router.get('/algorithm-stats', token, getAlgorithmStats)

/**
 * @route GET /api/analytics/user-effectiveness
 * @desc 取得用戶推薦效果分析
 * @access Private
 * @query {string} start_date - 開始日期 (ISO 格式)
 * @query {string} end_date - 結束日期 (ISO 格式)
 */
router.get('/user-effectiveness', token, getUserEffectiveness)

/**
 * @route POST /api/analytics/ab-tests
 * @desc 建立 A/B 測試
 * @access Private
 * @body {
 *   test_id: string,
 *   name: string,
 *   description?: string,
 *   test_type: string,
 *   primary_metric: string,
 *   secondary_metrics?: string[],
 *   variants: Array<{
 *     variant_id: string,
 *     name: string,
 *     description?: string,
 *     configuration: object,
 *     traffic_percentage: number
 *   }>,
 *   target_audience?: {
 *     user_segments?: string[],
 *     user_activity_levels?: string[],
 *     geographic_regions?: string[],
 *     device_types?: string[]
 *   },
 *   start_date: string,
 *   end_date: string,
 *   statistical_settings?: {
 *     confidence_level?: number,
 *     minimum_sample_size?: number,
 *     minimum_duration_days?: number
 *   },
 *   automation?: {
 *     auto_stop?: boolean,
 *     auto_winner_selection?: boolean,
 *     minimum_improvement?: number
 *   },
 *   notifications?: {
 *     on_start?: boolean,
 *     on_completion?: boolean,
 *     on_significant_result?: boolean,
 *     recipients?: string[]
 *   }
 * }
 */
router.post('/ab-tests', token, createABTest)

/**
 * @route GET /api/analytics/ab-tests
 * @desc 取得 A/B 測試列表
 * @access Private
 * @query {string} status - 測試狀態篩選
 * @query {string} test_type - 測試類型篩選
 * @query {number} page - 頁碼 (預設: 1)
 * @query {number} limit - 每頁數量 (預設: 10)
 */
router.get('/ab-tests', token, getABTests)

/**
 * @route PUT /api/analytics/ab-tests/:testId/status
 * @desc 更新 A/B 測試狀態
 * @access Private
 * @param {string} testId - 測試 ID
 * @body {string} status - 新狀態
 */
router.put('/ab-tests/:testId/status', token, updateABTestStatus)

/**
 * @route GET /api/analytics/ab-tests/:testId
 * @desc 取得 A/B 測試詳細資訊
 * @access Private
 * @param {string} testId - 測試 ID
 */
router.get('/ab-tests/:testId', token, getABTestDetails)

/**
 * @route GET /api/analytics/dashboard
 * @desc 取得推薦效果儀表板
 * @access Private
 * @query {string} start_date - 開始日期 (ISO 格式)
 * @query {string} end_date - 結束日期 (ISO 格式)
 */
router.get('/dashboard', token, getAnalyticsDashboard)

export default router
