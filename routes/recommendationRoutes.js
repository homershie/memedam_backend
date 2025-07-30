/**
 * 推薦系統路由
 * 提供各種推薦演算法的 API 端點
 */

import express from 'express'
import {
  getHotRecommendations,
  getLatestRecommendations,
  getSimilarRecommendations,
  getUserInterestRecommendations,
  getContentBasedRecommendationsController,
  getTagBasedRecommendationsController,
  getUserTagPreferences,
  updateUserPreferences,
  getMixedRecommendations,
  getRecommendationStats,
} from '../controllers/recommendationController.js'
import { token } from '../middleware/auth.js'

const router = express.Router()

/**
 * @route GET /api/recommendations/hot
 * @desc 取得熱門推薦
 * @access Public
 * @query {number} limit - 推薦數量限制 (預設: 20)
 * @query {string} type - 迷因類型篩選 (all, image, video, audio, text)
 * @query {number} days - 時間範圍天數 (預設: 7)
 * @query {boolean} exclude_viewed - 是否排除已看過的迷因 (預設: false)
 */
router.get('/hot', getHotRecommendations)

/**
 * @route GET /api/recommendations/latest
 * @desc 取得最新推薦
 * @access Public
 * @query {number} limit - 推薦數量限制 (預設: 20)
 * @query {string} type - 迷因類型篩選 (all, image, video, audio, text)
 * @query {number} hours - 時間範圍小時數 (預設: 24)
 */
router.get('/latest', getLatestRecommendations)

/**
 * @route GET /api/recommendations/similar/:memeId
 * @desc 取得相似迷因推薦
 * @access Public
 * @param {string} memeId - 目標迷因ID
 * @query {number} limit - 推薦數量限制 (預設: 10)
 */
router.get('/similar/:memeId', getSimilarRecommendations)

/**
 * @route GET /api/recommendations/user-interest
 * @desc 取得用戶興趣推薦（需要登入）
 * @access Private
 * @query {number} limit - 推薦數量限制 (預設: 20)
 */
router.get('/user-interest', token, getUserInterestRecommendations)

/**
 * @route GET /api/recommendations/content-based
 * @desc 取得內容基礎推薦（基於用戶標籤偏好）
 * @access Private
 * @query {number} limit - 推薦數量限制 (預設: 20)
 * @query {number} min_similarity - 最小相似度閾值 (預設: 0.1)
 * @query {boolean} exclude_interacted - 是否排除已互動的迷因 (預設: true)
 * @query {boolean} include_hot_score - 是否結合熱門分數 (預設: true)
 * @query {number} hot_score_weight - 熱門分數權重 (預設: 0.3)
 */
router.get('/content-based', token, getContentBasedRecommendationsController)

/**
 * @route GET /api/recommendations/tag-based
 * @desc 取得標籤相關推薦（基於指定標籤）
 * @access Public
 * @query {string} tags - 標籤列表（逗號分隔）
 * @query {number} limit - 推薦數量限制 (預設: 20)
 * @query {number} min_similarity - 最小相似度閾值 (預設: 0.1)
 * @query {boolean} include_hot_score - 是否結合熱門分數 (預設: true)
 * @query {number} hot_score_weight - 熱門分數權重 (預設: 0.3)
 */
router.get('/tag-based', getTagBasedRecommendationsController)

/**
 * @route GET /api/recommendations/user-preferences
 * @desc 取得用戶標籤偏好分析
 * @access Private
 */
router.get('/user-preferences', token, getUserTagPreferences)

/**
 * @route POST /api/recommendations/update-preferences
 * @desc 更新用戶偏好快取
 * @access Private
 */
router.post('/update-preferences', token, updateUserPreferences)

/**
 * @route GET /api/recommendations/mixed
 * @desc 取得混合推薦（結合多種演算法，包括內容基礎推薦）
 * @access Public
 * @query {number} limit - 推薦數量限制 (預設: 30)
 * @query {number} hot_weight - 熱門分數權重 (預設: 0.25)
 * @query {number} latest_weight - 最新分數權重 (預設: 0.25)
 * @query {number} content_weight - 內容基礎權重 (預設: 0.25)
 * @query {number} similar_weight - 相似分數權重 (預設: 0.25)
 */
router.get('/mixed', getMixedRecommendations)

/**
 * @route GET /api/recommendations/stats
 * @desc 取得推薦統計資訊
 * @access Public
 */
router.get('/stats', getRecommendationStats)

/**
 * @route GET /api/recommendations
 * @desc 取得綜合推薦（預設使用混合推薦）
 * @access Public
 * @query {string} algorithm - 推薦演算法 (hot, latest, mixed, user-interest, content-based, tag-based)
 * @query {number} limit - 推薦數量限制 (預設: 20)
 */
router.get('/', (req, res) => {
  const { algorithm = 'mixed' } = req.query

  // 根據演算法參數路由到對應的控制器
  switch (algorithm) {
    case 'hot':
      return getHotRecommendations(req, res)
    case 'latest':
      return getLatestRecommendations(req, res)
    case 'user-interest':
      return getUserInterestRecommendations(req, res)
    case 'content-based':
      return getContentBasedRecommendationsController(req, res)
    case 'tag-based':
      return getTagBasedRecommendationsController(req, res)
    case 'mixed':
    default:
      return getMixedRecommendations(req, res)
  }
})

export default router
