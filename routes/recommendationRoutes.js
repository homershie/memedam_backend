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
 * @route GET /api/recommendations/mixed
 * @desc 取得混合推薦（結合多種演算法）
 * @access Public
 * @query {number} limit - 推薦數量限制 (預設: 30)
 * @query {number} hot_weight - 熱門分數權重 (預設: 0.4)
 * @query {number} latest_weight - 最新分數權重 (預設: 0.3)
 * @query {number} similar_weight - 相似分數權重 (預設: 0.3)
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
 * @query {string} algorithm - 推薦演算法 (hot, latest, mixed, user-interest)
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
    case 'mixed':
    default:
      return getMixedRecommendations(req, res)
  }
})

export default router
