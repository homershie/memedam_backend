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
 * @route POST /api/analytics/track-recommendation
 * @desc 記錄推薦指標
 * @access Private
 * @body {
 *   meme_id: string,
 *   algorithm: string,
 *   recommendation_score: number,
 *   recommendation_rank: number,
 *   ab_test_id?: string,
 *   ab_test_variant?: string,
 *   recommendation_context?: {
 *     page: string,
 *     position: number,
 *     session_id?: string
 *   },
 *   user_features?: {
 *     is_new_user: boolean,
 *     user_activity_level: string,
 *     user_preferences: object
 *   },
 *   meme_features?: object
 * }
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
 * @route GET /api/analytics/ab-tests/:testId
 * @desc 取得 A/B 測試詳細資訊
 * @access Private
 * @param {string} testId - 測試 ID
 */
router.get('/ab-tests/:testId', token, getABTestDetails)

/**
 * @route PUT /api/analytics/ab-tests/:testId/status
 * @desc 更新 A/B 測試狀態
 * @access Private
 * @param {string} testId - 測試 ID
 * @body {string} status - 新狀態
 */
router.put('/ab-tests/:testId/status', token, updateABTestStatus)

/**
 * @route GET /api/analytics/dashboard
 * @desc 取得推薦效果儀表板
 * @access Private
 * @query {string} start_date - 開始日期 (ISO 格式)
 * @query {string} end_date - 結束日期 (ISO 格式)
 */
router.get('/dashboard', token, getAnalyticsDashboard)

export default router
