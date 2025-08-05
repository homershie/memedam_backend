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
  getInfiniteScrollRecommendationsController,
  getTrendingRecommendationsController,
} from '../controllers/recommendationController.js'
import { token } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     RecommendationResponse:
 *       type: object
 *       properties:
 *         memes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Meme'
 *         algorithm:
 *           type: string
 *           description: 使用的推薦演算法
 *         metadata:
 *           type: object
 *           properties:
 *             totalCount:
 *               type: integer
 *             processingTime:
 *               type: number
 *             cacheStatus:
 *               type: string
 *     UserBehavior:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *         action:
 *           type: string
 *           enum: [view, like, dislike, share, comment]
 *         memeId:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/recommendations/hot:
 *   get:
 *     summary: 取得熱門推薦
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, image, video, audio, text]
 *           default: all
 *         description: 迷因類型篩選
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: 時間範圍天數
 *       - in: query
 *         name: exclude_viewed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否排除已看過的迷因
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得熱門推薦
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                         days:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 */
router.get('/hot', getHotRecommendations)

/**
 * @swagger
 * /api/recommendations/latest:
 *   get:
 *     summary: 取得最新推薦
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, image, video, audio, text]
 *           default: all
 *         description: 迷因類型篩選
 *       - in: query
 *         name: hours
 *         schema:
 *           type: string
 *           default: all
 *           enum: [all, 1, 6, 12, 24, 48, 72, 168]
 *         description: 時間範圍小時數（all=不限制時間，數字=指定小時數）
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得最新推薦
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                         hours:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 */
router.get('/latest', getLatestRecommendations)

/**
 * @swagger
 * /api/recommendations/similar/{memeId}:
 *   get:
 *     summary: 取得相似迷因推薦
 *     tags: [Recommendations]
 *     parameters:
 *       - in: path
 *         name: memeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 目標迷因ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 推薦數量限制
 *     responses:
 *       200:
 *         description: 成功取得相似推薦
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecommendationResponse'
 *       404:
 *         description: 迷因不存在
 */
router.get('/similar/:memeId', getSimilarRecommendations)

/**
 * @swagger
 * /api/recommendations/user-interest:
 *   get:
 *     summary: 取得用戶興趣推薦
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *     responses:
 *       200:
 *         description: 成功取得用戶興趣推薦
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecommendationResponse'
 *       401:
 *         description: 未授權
 */
router.get('/user-interest', token, getUserInterestRecommendations)

/**
 * @swagger
 * /api/recommendations/content-based:
 *   get:
 *     summary: 取得內容基礎推薦
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: min_similarity
 *         schema:
 *           type: number
 *           default: 0.1
 *         description: 最小相似度閾值
 *       - in: query
 *         name: exclude_interacted
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否排除已互動的迷因
 *       - in: query
 *         name: include_hot_score
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否結合熱門分數
 *       - in: query
 *         name: hot_score_weight
 *         schema:
 *           type: number
 *           default: 0.3
 *         description: 熱門分數權重
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得內容基礎推薦
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     user_id:
 *                       type: string
 *                     filters:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         min_similarity:
 *                           type: number
 *                         exclude_interacted:
 *                           type: boolean
 *                         include_hot_score:
 *                           type: boolean
 *                         hot_score_weight:
 *                           type: number
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     algorithm_details:
 *                       type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 */
router.get('/content-based', token, getContentBasedRecommendationsController)

/**
 * @swagger
 * /api/recommendations/tag-based:
 *   get:
 *     summary: 取得標籤相關推薦
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: min_similarity
 *         schema:
 *           type: number
 *           default: 0.1
 *         description: 最小相似度閾值
 *       - in: query
 *         name: include_hot_score
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否結合熱門分數
 *       - in: query
 *         name: hot_score_weight
 *         schema:
 *           type: number
 *           default: 0.3
 *         description: 熱門分數權重
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得標籤相關推薦
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     query_tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                     filters:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         min_similarity:
 *                           type: number
 *                         include_hot_score:
 *                           type: boolean
 *                         hot_score_weight:
 *                           type: number
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     algorithm_details:
 *                       type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 */
router.get('/tag-based', getTagBasedRecommendationsController)

/**
 * @swagger
 * /api/recommendations/user-preferences:
 *   get:
 *     summary: 取得用戶標籤偏好分析
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得用戶偏好
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: object
 *                   description: 用戶偏好數據
 *       401:
 *         description: 未授權
 */
router.get('/user-preferences', token, getUserTagPreferences)

/**
 * @swagger
 * /api/recommendations/update-preferences:
 *   post:
 *     summary: 更新用戶偏好快取
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 偏好更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 */
router.post('/update-preferences', token, updateUserPreferences)

/**
 * @swagger
 * /api/recommendations/mixed:
 *   get:
 *     summary: 取得混合推薦
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 推薦數量限制
 *       - in: query
 *         name: custom_weights
 *         schema:
 *           type: string
 *         description: 自定義權重 JSON 字串
 *       - in: query
 *         name: include_diversity
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含多樣性計算
 *       - in: query
 *         name: include_cold_start_analysis
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含冷啟動分析
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 要排除的項目ID列表（逗號分隔）
 *     responses:
 *       200:
 *         description: 成功取得混合推薦
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecommendationResponse'
 */
router.get('/mixed', getMixedRecommendationsController)

/**
 * @swagger
 * /api/recommendations/infinite-scroll:
 *   get:
 *     summary: 取得無限捲動推薦
 *     tags: [Recommendations]
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
 *         description: 每頁推薦數量
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 要排除的項目ID列表（逗號分隔）
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: custom_weights
 *         schema:
 *           type: string
 *         description: 自定義權重 JSON 字串
 *       - in: query
 *         name: include_social_scores
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含社交分數
 *       - in: query
 *         name: include_recommendation_reasons
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含推薦原因
 *     responses:
 *       200:
 *         description: 成功取得無限捲動推薦
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecommendationResponse'
 */
router.get('/infinite-scroll', getInfiniteScrollRecommendationsController)

/**
 * @swagger
 * /api/recommendations/trending:
 *   get:
 *     summary: 取得大家都在看的熱門內容（公開）
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *           default: 24h
 *         description: 時間範圍
 *       - in: query
 *         name: include_social_signals
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含社交信號
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得大家都在看的內容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     filters:
 *                       type: object
 *                       properties:
 *                         time_range:
 *                           type: string
 *                         limit:
 *                           type: integer
 *                         include_social_signals:
 *                           type: boolean
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     algorithm_details:
 *                       type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 */
router.get('/trending', getTrendingRecommendationsController)

/**
 * @swagger
 * /api/recommendations/collaborative-filtering:
 *   get:
 *     summary: 取得協同過濾推薦
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: min_similarity
 *         schema:
 *           type: number
 *           default: 0.1
 *         description: 最小相似度閾值
 *       - in: query
 *         name: max_similar_users
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 最大相似用戶數
 *       - in: query
 *         name: exclude_interacted
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否排除已互動的迷因
 *       - in: query
 *         name: include_hot_score
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否結合熱門分數
 *       - in: query
 *         name: hot_score_weight
 *         schema:
 *           type: number
 *           default: 0.3
 *         description: 熱門分數權重
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得協同過濾推薦
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     user_id:
 *                       type: string
 *                     filters:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         min_similarity:
 *                           type: number
 *                         max_similar_users:
 *                           type: integer
 *                         exclude_interacted:
 *                           type: boolean
 *                         include_hot_score:
 *                           type: boolean
 *                         hot_score_weight:
 *                           type: number
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     algorithm_details:
 *                       type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 */
router.get('/collaborative-filtering', token, getCollaborativeFilteringRecommendationsController)

/**
 * @swagger
 * /api/recommendations/collaborative-filtering-stats:
 *   get:
 *     summary: 取得用戶協同過濾統計
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得協同過濾統計
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
router.get('/collaborative-filtering-stats', token, getCollaborativeFilteringStatsController)

/**
 * @swagger
 * /api/recommendations/update-collaborative-filtering-cache:
 *   post:
 *     summary: 更新協同過濾快取
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 快取更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 */
router.post(
  '/update-collaborative-filtering-cache',
  token,
  updateCollaborativeFilteringCacheController,
)

/**
 * @swagger
 * /api/recommendations/social-collaborative-filtering:
 *   get:
 *     summary: 取得社交協同過濾推薦
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 標籤列表（逗號分隔）
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *       - in: query
 *         name: min_similarity
 *         schema:
 *           type: number
 *           default: 0.1
 *         description: 最小相似度閾值
 *       - in: query
 *         name: max_similar_users
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 最大相似用戶數
 *       - in: query
 *         name: exclude_interacted
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否排除已互動的迷因
 *       - in: query
 *         name: include_hot_score
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否結合熱門分數
 *       - in: query
 *         name: hot_score_weight
 *         schema:
 *           type: number
 *           default: 0.3
 *         description: 熱門分數權重
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼（用於分頁）
 *       - in: query
 *         name: exclude_ids
 *         schema:
 *           type: string
 *         description: 排除的迷因ID（逗號分隔，用於無限捲動）
 *     responses:
 *       200:
 *         description: 成功取得社交協同過濾推薦
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Meme'
 *                     user_id:
 *                       type: string
 *                     filters:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         min_similarity:
 *                           type: number
 *                         max_similar_users:
 *                           type: integer
 *                         exclude_interacted:
 *                           type: boolean
 *                         include_hot_score:
 *                           type: boolean
 *                         hot_score_weight:
 *                           type: number
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                         page:
 *                           type: integer
 *                         exclude_ids:
 *                           type: array
 *                           items:
 *                             type: string
 *                     algorithm:
 *                       type: string
 *                     algorithm_details:
 *                       type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         skip:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         hasMore:
 *                           type: boolean
 *                         totalPages:
 *                           type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 */
router.get(
  '/social-collaborative-filtering',
  token,
  getSocialCollaborativeFilteringRecommendationsController,
)

/**
 * @swagger
 * /api/recommendations/social-collaborative-filtering-stats:
 *   get:
 *     summary: 取得用戶社交協同過濾統計
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得社交協同過濾統計
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
router.get(
  '/social-collaborative-filtering-stats',
  token,
  getSocialCollaborativeFilteringStatsController,
)

/**
 * @swagger
 * /api/recommendations/update-social-collaborative-filtering-cache:
 *   post:
 *     summary: 更新社交協同過濾快取
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 快取更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 */
router.post(
  '/update-social-collaborative-filtering-cache',
  token,
  updateSocialCollaborativeFilteringCacheController,
)

/**
 * @swagger
 * /api/recommendations/social-score/{memeId}:
 *   get:
 *     summary: 計算迷因的社交層分數
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *       - in: query
 *         name: include_distance
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含社交距離計算
 *       - in: query
 *         name: include_influence
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含影響力計算
 *       - in: query
 *         name: include_interactions
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否包含互動計算
 *       - in: query
 *         name: max_distance
 *         schema:
 *           type: integer
 *           default: 3
 *         description: 最大社交距離
 *     responses:
 *       200:
 *         description: 成功計算社交分數
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 socialScore:
 *                   type: number
 *                   description: 社交分數
 *                 details:
 *                   type: object
 *                   description: 詳細計算結果
 *       401:
 *         description: 未授權
 *       404:
 *         description: 迷因不存在
 */
router.get('/social-score/:memeId', token, calculateMemeSocialScoreController)

/**
 * @swagger
 * /api/recommendations/stats:
 *   get:
 *     summary: 取得推薦統計資訊
 *     tags: [Recommendations]
 *     responses:
 *       200:
 *         description: 成功取得推薦統計
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   description: 統計數據
 */
router.get('/stats', getRecommendationStats)

/**
 * @swagger
 * /api/recommendations/algorithm-stats:
 *   get:
 *     summary: 取得推薦演算法統計
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得演算法統計
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 algorithmStats:
 *                   type: object
 *                   description: 演算法統計數據
 *       401:
 *         description: 未授權
 */
router.get('/algorithm-stats', token, getRecommendationAlgorithmStatsController)

/**
 * @swagger
 * /api/recommendations/adjust-strategy:
 *   post:
 *     summary: 動態調整推薦策略
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userBehavior:
 *                 type: object
 *                 description: 用戶行為數據
 *     responses:
 *       200:
 *         description: 策略調整成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 */
router.post('/adjust-strategy', token, adjustRecommendationStrategyController)

/**
 * @swagger
 * /api/recommendations/social-influence-stats:
 *   get:
 *     summary: 取得用戶社交影響力統計
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得社交影響力統計
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 influenceStats:
 *                   type: object
 *                   description: 影響力統計數據
 *       401:
 *         description: 未授權
 */
router.get('/social-influence-stats', token, getUserSocialInfluenceStatsController)

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     summary: 取得綜合推薦
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: algorithm
 *         schema:
 *           type: string
 *           enum: [hot, latest, mixed, trending, user-interest, content-based, tag-based, collaborative-filtering, social-collaborative-filtering]
 *           default: mixed
 *         description: 推薦演算法
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 推薦數量限制
 *     responses:
 *       200:
 *         description: 成功取得推薦
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecommendationResponse'
 */
router.get('/', (req, res) => {
  const { algorithm = 'mixed' } = req.query

  // 根據演算法參數路由到對應的控制器
  switch (algorithm) {
    case 'hot':
      return getHotRecommendations(req, res)
    case 'latest':
      return getLatestRecommendations(req, res)
    case 'trending':
      return getTrendingRecommendationsController(req, res)
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
