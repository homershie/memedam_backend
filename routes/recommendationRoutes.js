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
  getMixedRecommendationsController,
  getRecommendationStats,
  getRecommendationAlgorithmStatsController,
  adjustRecommendationStrategyController,
  getCollaborativeFilteringRecommendationsController,
  getCollaborativeFilteringStatsController,
  updateCollaborativeFilteringCacheController,
  getSocialCollaborativeFilteringRecommendationsController,
  getSocialCollaborativeFilteringStatsController,
  updateSocialCollaborativeFilteringCacheController,
  calculateMemeSocialScoreController,
  getUserSocialInfluenceStatsController,
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
 * @desc 取得混合推薦（結合多種演算法，支援動態權重調整和冷啟動處理）
 * @access Public
 * @query {number} limit - 推薦數量限制 (預設: 30)
 * @query {string} custom_weights - 自定義權重 JSON 字串 (預設: {})
 * @query {boolean} include_diversity - 是否包含多樣性計算 (預設: true)
 * @query {boolean} include_cold_start_analysis - 是否包含冷啟動分析 (預設: true)
 */
router.get('/mixed', getMixedRecommendationsController)

/**
 * @route GET /api/recommendations/collaborative-filtering
 * @desc 取得協同過濾推薦（基於用戶行為相似性）
 * @access Private
 * @query {number} limit - 推薦數量限制 (預設: 20)
 * @query {number} min_similarity - 最小相似度閾值 (預設: 0.1)
 * @query {number} max_similar_users - 最大相似用戶數 (預設: 50)
 * @query {boolean} exclude_interacted - 是否排除已互動的迷因 (預設: true)
 * @query {boolean} include_hot_score - 是否結合熱門分數 (預設: true)
 * @query {number} hot_score_weight - 熱門分數權重 (預設: 0.3)
 */
router.get('/collaborative-filtering', token, getCollaborativeFilteringRecommendationsController)

/**
 * @route GET /api/recommendations/collaborative-filtering-stats
 * @desc 取得用戶協同過濾統計
 * @access Private
 */
router.get('/collaborative-filtering-stats', token, getCollaborativeFilteringStatsController)

/**
 * @route POST /api/recommendations/update-collaborative-filtering-cache
 * @desc 更新協同過濾快取
 * @access Private
 */
router.post(
  '/update-collaborative-filtering-cache',
  token,
  updateCollaborativeFilteringCacheController,
)

/**
 * @route GET /api/recommendations/social-collaborative-filtering
 * @desc 取得社交協同過濾推薦（基於社交關係和用戶行為相似性）
 * @access Private
 * @query {number} limit - 推薦數量限制 (預設: 20)
 * @query {number} min_similarity - 最小相似度閾值 (預設: 0.1)
 * @query {number} max_similar_users - 最大相似用戶數 (預設: 50)
 * @query {boolean} exclude_interacted - 是否排除已互動的迷因 (預設: true)
 * @query {boolean} include_hot_score - 是否結合熱門分數 (預設: true)
 * @query {number} hot_score_weight - 熱門分數權重 (預設: 0.3)
 */
router.get(
  '/social-collaborative-filtering',
  token,
  getSocialCollaborativeFilteringRecommendationsController,
)

/**
 * @route GET /api/recommendations/social-collaborative-filtering-stats
 * @desc 取得用戶社交協同過濾統計
 * @access Private
 */
router.get(
  '/social-collaborative-filtering-stats',
  token,
  getSocialCollaborativeFilteringStatsController,
)

/**
 * @route POST /api/recommendations/update-social-collaborative-filtering-cache
 * @desc 更新社交協同過濾快取
 * @access Private
 */
router.post(
  '/update-social-collaborative-filtering-cache',
  token,
  updateSocialCollaborativeFilteringCacheController,
)

/**
 * @route GET /api/recommendations/stats
 * @desc 取得推薦統計資訊
 * @access Public
 */
router.get('/stats', getRecommendationStats)

/**
 * @route GET /api/recommendations/algorithm-stats
 * @desc 取得推薦演算法統計（包含用戶活躍度和冷啟動分析）
 * @access Private
 */
router.get('/algorithm-stats', token, getRecommendationAlgorithmStatsController)

/**
 * @route POST /api/recommendations/adjust-strategy
 * @desc 動態調整推薦策略（根據用戶行為）
 * @access Private
 * @body {Object} userBehavior - 用戶行為數據
 */
router.post('/adjust-strategy', token, adjustRecommendationStrategyController)

/**
 * @route GET /api/recommendations/social-score/:memeId
 * @desc 計算迷因的社交層分數
 * @access Private
 * @param {string} memeId - 迷因ID
 * @query {boolean} include_distance - 是否包含社交距離計算 (預設: true)
 * @query {boolean} include_influence - 是否包含影響力計算 (預設: true)
 * @query {boolean} include_interactions - 是否包含互動計算 (預設: true)
 * @query {number} max_distance - 最大社交距離 (預設: 3)
 */
router.get('/social-score/:memeId', token, calculateMemeSocialScoreController)

/**
 * @route GET /api/recommendations/social-influence-stats
 * @desc 取得用戶社交影響力統計
 * @access Private
 */
router.get('/social-influence-stats', token, getUserSocialInfluenceStatsController)

/**
 * @route GET /api/recommendations
 * @desc 取得綜合推薦（預設使用混合推薦）
 * @access Public
 * @query {string} algorithm - 推薦演算法 (hot, latest, mixed, user-interest, content-based, tag-based, collaborative-filtering, social-collaborative-filtering)
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
    case 'collaborative-filtering':
      return getCollaborativeFilteringRecommendationsController(req, res)
    case 'social-collaborative-filtering':
      return getSocialCollaborativeFilteringRecommendationsController(req, res)
    case 'mixed':
    default:
      return getMixedRecommendationsController(req, res)
  }
})

export default router
