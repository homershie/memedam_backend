/**
 * 混合推薦系統
 * 整合所有推薦演算法，支援動態權重調整和冷啟動處理
 * 效能優化版本 - 包含 Redis 快取和非同步處理
 */

import mongoose from 'mongoose'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { getHotScoreLevel, calculateUpdatedContentScore } from './hotScore.js'
import Like from '../models/Like.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import Collection from '../models/Collection.js'
import View from '../models/View.js'
import {
  getContentBasedRecommendations as getContentBasedRecs,
  calculateUserTagPreferences,
} from './contentBased.js'
import {
  getCollaborativeFilteringRecommendations as getCollaborativeFilteringRecs,
  getSocialCollaborativeFilteringRecommendations as getSocialCollaborativeFilteringRecs,
} from './collaborativeFiltering.js'
import { calculateMultipleMemeSocialScores } from './socialScoreCalculator.js'
import redisCache from '../config/redis.js'
import { cacheProcessor, performanceMonitor } from './asyncProcessor.js'
import { logger } from './logger.js'
import { sortByTotalScoreDesc } from './sortHelpers.js'

/**
 * 演算法權重配置
 */
const ALGORITHM_WEIGHTS = {
  hot: 0.22,
  latest: 0.22,
  updated: 0.16, // 新增：最近更新內容推薦
  content_based: 0.17,
  collaborative_filtering: 0.12,
  social_collaborative_filtering: 0.11,
}

/**
 * 冷啟動配置
 */
const COLD_START_CONFIG = {
  minInteractions: 5, // 最少互動數
  minSimilarUsers: 3, // 最少相似用戶數
  fallbackWeight: 0.8, // 冷啟動時熱門推薦權重
  // 新增：冷啟動時的推薦數量倍數
  coldStartMultiplier: 2.0, // 冷啟動時將推薦數量翻倍
}

/**
 * 快取配置
 */
const CACHE_CONFIG = {
  userActivity: 1800, // 30分鐘
  userPreferences: 3600, // 1小時
  hotRecommendations: 900, // 15分鐘
  latestRecommendations: 300, // 5分鐘
  updatedRecommendations: 600, // 10分鐘
  contentBasedRecommendations: 1800, // 30分鐘
  collaborativeFilteringRecommendations: 3600, // 1小時
  socialRecommendations: 3600, // 1小時
  mixedRecommendations: 600, // 10分鐘
  socialScores: 1800, // 30分鐘
}

/**
 * 計算用戶活躍度分數（快取版本）
 * @param {string} userId - 用戶ID
 * @returns {Object} 活躍度分數和等級
 */
const calculateUserActivityScore = async (userId) => {
  const cacheKey = `user_activity:${userId}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        const user = await User.findById(userId)
        if (!user) {
          return { score: 0, level: 'inactive' }
        }

        // 並行計算用戶的互動總數
        const [likes, comments, shares, collections, views] = await Promise.all([
          Like.countDocuments({ user_id: userId }),
          Comment.countDocuments({ user_id: userId, status: 'normal' }),
          Share.countDocuments({ user_id: userId }),
          Collection.countDocuments({ user_id: userId }),
          View.countDocuments({ user_id: userId }),
        ])

        const totalInteractions = likes + comments + shares + collections + views
        const activityScore = Math.log10(totalInteractions + 1) * 10

        // 根據分數確定活躍等級
        let level = 'inactive'
        if (activityScore >= 50) level = 'very_active'
        else if (activityScore >= 30) level = 'active'
        else if (activityScore >= 15) level = 'moderate'
        else if (activityScore >= 5) level = 'low'
        else level = 'inactive'

        return {
          score: activityScore,
          level,
          totalInteractions,
          breakdown: { likes, comments, shares, collections, views },
        }
      } catch (error) {
        logger.error('計算用戶活躍度分數失敗:', error)
        return { score: 0, level: 'inactive' }
      }
    },
    { ttl: CACHE_CONFIG.userActivity },
  )
}

/**
 * 檢查冷啟動狀態（快取版本）
 * @param {string} userId - 用戶ID
 * @returns {Object} 冷啟動狀態和建議
 */
const checkColdStartStatus = async (userId) => {
  const cacheKey = `cold_start:${userId}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        const [activityScore, userPreferences] = await Promise.all([
          calculateUserActivityScore(userId),
          calculateUserTagPreferences(userId),
        ])

        const isColdStart =
          activityScore.totalInteractions < COLD_START_CONFIG.minInteractions ||
          Object.keys(userPreferences.preferences).length === 0

        return {
          isColdStart,
          activityScore,
          userPreferences,
          recommendations: isColdStart ? 'hot' : 'mixed',
        }
      } catch (error) {
        logger.error('檢查冷啟動狀態失敗:', error)
        return {
          isColdStart: true,
          activityScore: { score: 0, level: 'inactive' },
          userPreferences: { preferences: {} },
          recommendations: 'hot',
        }
      }
    },
    { ttl: CACHE_CONFIG.userPreferences },
  )
}

/**
 * 動態調整演算法權重
 * @param {Object} coldStartStatus - 冷啟動狀態
 * @param {Object} userPreferences - 用戶偏好
 * @param {Object} customWeights - 自定義權重
 * @returns {Object} 調整後的權重
 */
const adjustAlgorithmWeights = (coldStartStatus, userPreferences, customWeights = {}) => {
  const weights = { ...ALGORITHM_WEIGHTS, ...customWeights }

  // 如果是冷啟動狀態，增加熱門推薦權重
  if (coldStartStatus.isColdStart) {
    weights.hot = COLD_START_CONFIG.fallbackWeight
    weights.latest = 0.15
    weights.updated = 0.05
    weights.content_based = 0
    weights.collaborative_filtering = 0
    weights.social_collaborative_filtering = 0
  } else {
    // 根據用戶活躍度調整權重
    const activityLevel = coldStartStatus.activityScore.level
    switch (activityLevel) {
      case 'very_active':
        weights.content_based = 0.28
        weights.collaborative_filtering = 0.18
        weights.social_collaborative_filtering = 0.18
        weights.hot = 0.13
        weights.latest = 0.13
        weights.updated = 0.1
        break
      case 'active':
        weights.content_based = 0.22
        weights.collaborative_filtering = 0.18
        weights.social_collaborative_filtering = 0.13
        weights.hot = 0.18
        weights.latest = 0.17
        weights.updated = 0.12
        break
      case 'moderate':
        weights.content_based = 0.17
        weights.collaborative_filtering = 0.13
        weights.social_collaborative_filtering = 0.08
        weights.hot = 0.22
        weights.latest = 0.25
        weights.updated = 0.15
        break
      default:
        weights.hot = 0.35
        weights.latest = 0.25
        weights.updated = 0.2
        weights.content_based = 0.15
        weights.collaborative_filtering = 0.03
        weights.social_collaborative_filtering = 0.02
    }
  }

  return weights
}

/**
 * 取得熱門推薦（快取版本）
 * @param {Object} options - 選項
 * @returns {Array} 熱門推薦列表
 */
const getHotRecommendations = async (options = {}) => {
  const { limit = 20, days = 7, tags = [] } = options || {}
  const cacheKey = `hot_recommendations:${limit}:${days}:${JSON.stringify(tags)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - parseInt(days))

      // 建立查詢條件
      const filter = {
        status: 'public',
        createdAt: mongoose.trusted({ $gte: dateLimit }),
      }

      // 如果有標籤篩選，加入標籤條件
      if (tags && tags.length > 0) {
        filter.tags_cache = { $in: tags }
      }

      // 增加查詢數量以確保有足夠的推薦
      const queryLimit = Math.max(parseInt(limit), 50)

      let memes = await Meme.find(filter)
        .sort({ hot_score: -1 })
        .limit(queryLimit)
        .populate('author_id', 'username display_name avatar')
        .lean() // 使用 lean() 提升效能

      // 如果結果不足，擴大時間範圍
      if (memes.length < Math.ceil(limit * 0.5)) {
        const extendedDateLimit = new Date()
        extendedDateLimit.setDate(extendedDateLimit.getDate() - 30) // 擴大到30天

        const extendedFilter = {
          status: 'public',
          createdAt: mongoose.trusted({ $gte: extendedDateLimit }),
        }

        if (tags && tags.length > 0) {
          extendedFilter.tags_cache = { $in: tags }
        }

        const extendedMemes = await Meme.find(extendedFilter)
          .sort({ hot_score: -1 })
          .limit(queryLimit)
          .populate('author_id', 'username display_name avatar')
          .lean()

        // 合併結果並去重
        const memeMap = new Map()
        ;[...memes, ...extendedMemes].forEach((meme) => {
          if (!memeMap.has(meme._id.toString())) {
            memeMap.set(meme._id.toString(), meme)
          }
        })

        memes = Array.from(memeMap.values())
        // 重新排序，確保熱門分數高的在前面
        memes.sort((a, b) => b.hot_score - a.hot_score)
      }

      return memes.map((meme) => {
        // 確保 author_id 是字串格式
        let authorId = null
        if (meme.author_id) {
          if (typeof meme.author_id === 'object' && meme.author_id._id) {
            authorId = meme.author_id._id.toString()
          } else if (typeof meme.author_id === 'object') {
            authorId = meme.author_id.toString()
          } else {
            authorId = meme.author_id.toString()
          }
        }

        return {
          ...meme,
          author_id: authorId,
          recommendation_score: meme.hot_score,
          recommendation_type: 'hot',
          hot_level: getHotScoreLevel(meme.hot_score),
        }
      })
    },
    { ttl: CACHE_CONFIG.hotRecommendations },
  )
}

/**
 * 取得最新推薦（快取版本）
 * @param {Object} options - 選項
 * @returns {Array} 最新推薦列表
 */
const getLatestRecommendations = async (options = {}) => {
  const { limit = 20, hours = 24, tags = [] } = options || {}
  const cacheKey = `latest_recommendations:${limit}:${hours}:${JSON.stringify(tags)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      const dateLimit = new Date()
      dateLimit.setHours(dateLimit.getHours() - parseInt(hours))

      // 建立查詢條件
      const filter = {
        status: 'public',
        createdAt: mongoose.trusted({ $gte: dateLimit }),
      }

      // 如果有標籤篩選，加入標籤條件
      if (tags && tags.length > 0) {
        filter.tags_cache = { $in: tags }
      }

      // 增加查詢數量以確保有足夠的推薦
      const queryLimit = Math.max(parseInt(limit), 50)

      let memes = await Meme.find(filter)
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .populate('author_id', 'username display_name avatar')
        .lean()

      // 如果結果不足，擴大時間範圍
      if (memes.length < Math.ceil(limit * 0.5)) {
        const extendedDateLimit = new Date()
        extendedDateLimit.setHours(extendedDateLimit.getHours() - 168) // 擴大到7天

        const extendedFilter = {
          status: 'public',
          createdAt: mongoose.trusted({ $gte: extendedDateLimit }),
        }

        if (tags && tags.length > 0) {
          extendedFilter.tags_cache = { $in: tags }
        }

        const extendedMemes = await Meme.find(extendedFilter)
          .sort({ createdAt: -1 })
          .limit(queryLimit)
          .populate('author_id', 'username display_name avatar')
          .lean()

        // 合併結果並去重
        const memeMap = new Map()
        ;[...memes, ...extendedMemes].forEach((meme) => {
          if (!memeMap.has(meme._id.toString())) {
            memeMap.set(meme._id.toString(), meme)
          }
        })

        memes = Array.from(memeMap.values())
        // 重新排序，確保最新的在前面
        memes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }

      return memes.map((meme) => {
        // 確保 author_id 是字串格式
        let authorId = null
        if (meme.author_id) {
          if (typeof meme.author_id === 'object' && meme.author_id._id) {
            authorId = meme.author_id._id.toString()
          } else if (typeof meme.author_id === 'object') {
            authorId = meme.author_id.toString()
          } else {
            authorId = meme.author_id.toString()
          }
        }

        return {
          ...meme,
          author_id: authorId,
          recommendation_score: 1 / (Date.now() - meme.createdAt.getTime()),
          recommendation_type: 'latest',
        }
      })
    },
    { ttl: CACHE_CONFIG.latestRecommendations },
  )
}

/**
 * 取得最近更新推薦（快取版本）
 * @param {Object} options - 選項
 * @returns {Array} 最近更新推薦列表
 */
const getUpdatedRecommendations = async (options = {}) => {
  const { limit = 20, days = 30, tags = [] } = options || {}
  const cacheKey = `updated_recommendations:${limit}:${days}:${JSON.stringify(tags)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - parseInt(days))

      // 建立查詢條件 - 尋找有修改時間的內容
      const filter = {
        status: 'public',
        modified_at: mongoose.trusted({ $exists: true, $ne: null, $gte: dateLimit }),
      }

      // 如果有標籤篩選，加入標籤條件
      if (tags && tags.length > 0) {
        filter.tags_cache = { $in: tags }
      }

      // 增加查詢數量以確保有足夠的推薦
      const queryLimit = Math.max(parseInt(limit), 50)

      let memes = await Meme.find(filter)
        .sort({ modified_at: -1 }) // 按修改時間排序
        .limit(queryLimit)
        .populate('author_id', 'username display_name avatar')
        .lean()

      // 如果結果不足，擴大時間範圍
      if (memes.length < Math.ceil(limit * 0.5)) {
        const extendedDateLimit = new Date()
        extendedDateLimit.setDate(extendedDateLimit.getDate() - 90) // 擴大到90天

        const extendedFilter = {
          status: 'public',
          modified_at: mongoose.trusted({ $exists: true, $ne: null, $gte: extendedDateLimit }),
        }

        if (tags && tags.length > 0) {
          extendedFilter.tags_cache = { $in: tags }
        }

        const extendedMemes = await Meme.find(extendedFilter)
          .sort({ modified_at: -1 })
          .limit(queryLimit)
          .populate('author_id', 'username display_name avatar')
          .lean()

        // 合併結果並去重
        const memeMap = new Map()
        ;[...memes, ...extendedMemes].forEach((meme) => {
          if (!memeMap.has(meme._id.toString())) {
            memeMap.set(meme._id.toString(), meme)
          }
        })

        memes = Array.from(memeMap.values())
        // 重新排序，確保最近修改的在前面
        memes.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at))
      }

      return memes.map((meme) => {
        // 確保 author_id 是字串格式
        let authorId = null
        if (meme.author_id) {
          if (typeof meme.author_id === 'object' && meme.author_id._id) {
            authorId = meme.author_id._id.toString()
          } else if (typeof meme.author_id === 'object') {
            authorId = meme.author_id.toString()
          } else {
            authorId = meme.author_id.toString()
          }
        }

        // 計算更新內容的推薦分數
        const updatedScore = calculateUpdatedContentScore(meme)

        return {
          ...meme,
          author_id: authorId,
          recommendation_score: updatedScore,
          recommendation_type: 'updated',
          days_since_modified: Math.floor(
            (Date.now() - new Date(meme.modified_at).getTime()) / (1000 * 60 * 60 * 24),
          ),
        }
      })
    },
    { ttl: CACHE_CONFIG.updatedRecommendations },
  )
}

/**
 * 取得內容基礎推薦（快取版本）
 * @param {string} userId - 用戶ID
 * @param {Object} options - 選項
 * @returns {Array} 內容基礎推薦列表
 */
const getContentBasedRecommendations = async (userId, options = {}) => {
  const { limit = 20, tags = [] } = options || {}
  const cacheKey = `content_based:${userId}:${limit}:${JSON.stringify(tags)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        return await getContentBasedRecs(userId, {
          limit: limit,
          minSimilarity: 0.1,
          excludeInteracted: true,
          includeHotScore: true,
          hotScoreWeight: 0.3,
          tags,
        })
      } catch (error) {
        logger.error('內容基礎推薦失敗:', error)
        return []
      }
    },
    { ttl: CACHE_CONFIG.contentBasedRecommendations },
  )
}

/**
 * 取得協同過濾推薦（快取版本）
 * @param {string} userId - 用戶ID
 * @param {Object} options - 選項
 * @returns {Array} 協同過濾推薦列表
 */
const getCollaborativeFilteringRecommendations = async (userId, options = {}) => {
  const { limit = 20, tags = [] } = options || {}
  const cacheKey = `collaborative_filtering:${userId}:${limit}:${JSON.stringify(tags)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        return await getCollaborativeFilteringRecs(userId, {
          limit: limit,
          minSimilarity: 0.1,
          maxSimilarUsers: 50,
          excludeInteracted: true,
          includeHotScore: true,
          hotScoreWeight: 0.3,
          tags,
        })
      } catch (error) {
        logger.error('協同過濾推薦失敗:', error)
        return []
      }
    },
    { ttl: CACHE_CONFIG.collaborativeFilteringRecommendations },
  )
}

/**
 * 取得社交協同過濾推薦（快取版本）
 * @param {string} userId - 用戶ID
 * @param {Object} options - 選項
 * @returns {Array} 社交協同過濾推薦列表
 */
const getSocialCollaborativeFilteringRecommendations = async (userId, options = {}) => {
  const { limit = 20, tags = [] } = options || {}
  const cacheKey = `social_collaborative_filtering:${userId}:${limit}:${JSON.stringify(tags)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        return await getSocialCollaborativeFilteringRecs(userId, {
          limit: limit,
          minSimilarity: 0.1,
          maxSimilarUsers: 50,
          excludeInteracted: true,
          includeHotScore: true,
          hotScoreWeight: 0.3,
          tags,
        })
      } catch (error) {
        logger.error('社交協同過濾推薦失敗:', error)
        return []
      }
    },
    { ttl: CACHE_CONFIG.socialRecommendations },
  )
}

/**
 * 合併推薦結果
 * @param {Array} recommendations - 推薦列表
 * @param {Object} weights - 權重配置
 * @returns {Array} 合併後的推薦列表
 */
const mergeRecommendations = (recommendations, weights) => {
  const memeMap = new Map()

  // 合併所有推薦
  recommendations.forEach((rec) => {
    rec.forEach((meme) => {
      const memeId = meme._id.toString()
      if (!memeMap.has(memeId)) {
        memeMap.set(memeId, {
          ...meme,
          algorithm_scores: {},
          total_score: 0,
        })
      }

      const existingMeme = memeMap.get(memeId)
      const algorithmType = meme.recommendation_type
      const weight = weights[algorithmType] || 0

      existingMeme.algorithm_scores[algorithmType] = meme.recommendation_score
      existingMeme.total_score += meme.recommendation_score * weight
    })
  })

  // 轉換為陣列並排序
  const mergedRecommendations = Array.from(memeMap.values())
  sortByTotalScoreDesc(mergedRecommendations)

  return mergedRecommendations
}

/**
 * 計算推薦多樣性
 * @param {Array} recommendations - 推薦列表
 * @returns {Object} 多樣性統計
 */
const calculateRecommendationDiversity = (recommendations) => {
  const tagCounts = {}
  const authorCounts = {}
  let totalTags = 0
  let totalAuthors = 0

  recommendations.forEach((meme) => {
    // 統計標籤多樣性
    if (meme.tags_cache) {
      meme.tags_cache.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
        totalTags++
      })
    }

    // 統計作者多樣性
    if (meme.author_id) {
      // author_id 現在已經是字串格式
      const authorId =
        typeof meme.author_id === 'string' ? meme.author_id : meme.author_id.toString()
      authorCounts[authorId] = (authorCounts[authorId] || 0) + 1
      totalAuthors++
    }
  })

  const uniqueTags = Object.keys(tagCounts).length
  const uniqueAuthors = Object.keys(authorCounts).length
  const tagDiversity = totalTags > 0 ? uniqueTags / totalTags : 0
  const authorDiversity = totalAuthors > 0 ? uniqueAuthors / totalAuthors : 0

  return {
    tagDiversity,
    authorDiversity,
    uniqueTags,
    uniqueAuthors,
    totalTags,
    totalAuthors,
  }
}

/**
 * 主要混合推薦函數（優化版本）
 * @param {string} userId - 用戶ID（可選）
 * @param {Object} options - 選項
 * @returns {Object} 混合推薦結果
 */
export const getMixedRecommendations = async (userId = null, options = {}) => {
  performanceMonitor.start('mixed_recommendations')

  try {
    const {
      limit = 30,
      customWeights = {},
      includeDiversity = true,
      includeColdStartAnalysis = true,
      includeSocialScores = true,
      includeRecommendationReasons = true,
      useCache = true,
      tags = [],
      // 新增：分頁和排除功能
      page = 1,
      excludeIds = [],
    } = options

    // 檢查冷啟動狀態
    let coldStartStatus = null
    if (userId && includeColdStartAnalysis) {
      coldStartStatus = await checkColdStartStatus(userId)
    }

    // 動態調整權重
    const weights = adjustAlgorithmWeights(
      coldStartStatus || { isColdStart: !userId },
      coldStartStatus?.userPreferences || { preferences: {} },
      customWeights,
    )

    // 如果是冷啟動狀態，增加推薦數量
    let adjustedLimit = parseInt(limit)
    if (!userId || (coldStartStatus && coldStartStatus.isColdStart)) {
      adjustedLimit = Math.ceil(limit * COLD_START_CONFIG.coldStartMultiplier)
    }

    // 快取鍵（不包含分頁資訊，只快取完整的推薦列表）
    const cacheKey = `mixed_recommendations:${userId || 'anonymous'}:${adjustedLimit}:${JSON.stringify(customWeights)}:${JSON.stringify(tags)}`

    if (useCache) {
      const cached = await redisCache.get(cacheKey)
      if (cached !== null) {
        // 從快取中取得完整的推薦列表，然後進行分頁處理
        let cachedRecommendations = cached.recommendations || []

        // 排除已顯示的項目
        if (excludeIds && excludeIds.length > 0) {
          const excludeSet = new Set(excludeIds.map((id) => id.toString()))
          cachedRecommendations = cachedRecommendations.filter(
            (rec) => !excludeSet.has(rec._id.toString()),
          )
        }

        // 計算分頁
        const skip = (page - 1) * limit
        const paginatedRecommendations = cachedRecommendations.slice(skip, skip + limit)
        // 確保分頁結果依照總分由高至低排序
        paginatedRecommendations.sort((a, b) => b.total_score - a.total_score)

        // 如果需要社交層分數，為每個迷因計算詳細的社交分數
        if (includeSocialScores && userId) {
          const memeIds = paginatedRecommendations.map((rec) => rec._id)
          const socialScores = await calculateMultipleMemeSocialScores(userId, memeIds, {
            includeDistance: true,
            includeInfluence: true,
            includeInteractions: true,
            maxDistance: 3,
          })

          // 將社交分數整合到推薦結果中
          const socialScoreMap = new Map()
          socialScores.forEach((score) => {
            socialScoreMap.set(score.memeId, score)
          })

          paginatedRecommendations.forEach((rec) => {
            const socialScore = socialScoreMap.get(rec._id)
            if (socialScore) {
              rec.social_score = socialScore.socialScore
              rec.social_interactions = socialScore.socialInteractions
              rec.social_reasons = socialScore.reasons
              rec.social_distance_score = socialScore.distanceScore
              rec.social_influence_score = socialScore.influenceScore
              rec.social_interaction_score = socialScore.interactionScore
            }
          })

          // 重新按 total_score 排序，確保社交分數計算不會影響原始排序
          sortByTotalScoreDesc(paginatedRecommendations)
        }

        // 生成推薦原因
        if (includeRecommendationReasons && userId) {
          for (const rec of paginatedRecommendations) {
            if (rec.social_reasons && rec.social_reasons.length > 0) {
              rec.recommendation_reason = rec.social_reasons[0].text
              rec.recommendation_reasons = rec.social_reasons
            } else {
              // 根據演算法類型生成通用推薦原因
              rec.recommendation_reason = generateGenericRecommendationReason(rec)
            }
          }
        }

        // 計算多樣性
        let diversity = null
        if (includeDiversity) {
          diversity = calculateRecommendationDiversity(paginatedRecommendations)
        }

        const result = {
          recommendations: paginatedRecommendations,
          weights: cached.weights,
          coldStartStatus: cached.coldStartStatus,
          diversity,
          algorithm: 'mixed',
          userAuthenticated: !!userId,
          appliedTags: tags,
          // 新增：分頁資訊
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            skip,
            total: cachedRecommendations.length,
            hasMore: skip + limit < cachedRecommendations.length,
            totalPages: Math.ceil(cachedRecommendations.length / limit),
          },
          // 新增：顯示實際查詢的數量
          queryInfo: {
            requestedLimit: limit,
            adjustedLimit: adjustedLimit,
            coldStartMultiplier: COLD_START_CONFIG.coldStartMultiplier,
            isColdStart: !userId || (cached.coldStartStatus && cached.coldStartStatus.isColdStart),
            excludedCount: excludeIds ? excludeIds.length : 0,
          },
        }

        performanceMonitor.end('mixed_recommendations')
        return result
      }
    }

    // 並行取得各種推薦
    const recommendationTasks = []

    // 熱門推薦
    if (weights.hot > 0) {
      recommendationTasks.push(
        getHotRecommendations({
          limit: Math.ceil(adjustedLimit * weights.hot),
          days: 7,
          tags,
        }),
      )
    }

    // 最新推薦
    if (weights.latest > 0) {
      recommendationTasks.push(
        getLatestRecommendations({
          limit: Math.ceil(adjustedLimit * weights.latest),
          hours: 24,
          tags,
        }),
      )
    }

    // 更新內容推薦
    if (weights.updated > 0) {
      recommendationTasks.push(
        getUpdatedRecommendations({
          limit: Math.ceil(adjustedLimit * weights.updated),
          days: 30,
          tags,
        }),
      )
    }

    // 內容基礎推薦（需要登入）
    if (userId && weights.content_based > 0) {
      recommendationTasks.push(
        getContentBasedRecommendations(userId, {
          limit: Math.ceil(adjustedLimit * weights.content_based),
          tags,
        }),
      )
    }

    // 協同過濾推薦（需要登入）
    if (userId && weights.collaborative_filtering > 0) {
      recommendationTasks.push(
        getCollaborativeFilteringRecommendations(userId, {
          limit: Math.ceil(adjustedLimit * weights.collaborative_filtering),
          tags,
        }),
      )
    }

    // 社交協同過濾推薦（需要登入）
    if (userId && weights.social_collaborative_filtering > 0) {
      recommendationTasks.push(
        getSocialCollaborativeFilteringRecommendations(userId, {
          limit: Math.ceil(adjustedLimit * weights.social_collaborative_filtering),
          tags,
        }),
      )
    }

    // 並行執行所有推薦任務
    const recommendations = await Promise.all(recommendationTasks)

    // 合併推薦結果
    let mergedRecommendations = mergeRecommendations(recommendations, weights)

    // 排除已顯示的項目
    if (excludeIds && excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds.map((id) => id.toString()))
      mergedRecommendations = mergedRecommendations.filter(
        (rec) => !excludeSet.has(rec._id.toString()),
      )
    }

    // 計算分頁
    const skip = (page - 1) * limit
    const paginatedRecommendations = mergedRecommendations.slice(skip, skip + limit)
    // 確保分頁結果依照總分由高至低排序
    paginatedRecommendations.sort((a, b) => b.total_score - a.total_score)

    // 如果需要社交層分數，為每個迷因計算詳細的社交分數
    if (includeSocialScores && userId) {
      const memeIds = paginatedRecommendations.map((rec) => rec._id)
      const socialScores = await calculateMultipleMemeSocialScores(userId, memeIds, {
        includeDistance: true,
        includeInfluence: true,
        includeInteractions: true,
        maxDistance: 3,
      })

      // 將社交分數整合到推薦結果中
      const socialScoreMap = new Map()
      socialScores.forEach((score) => {
        socialScoreMap.set(score.memeId, score)
      })

      paginatedRecommendations.forEach((rec) => {
        const socialScore = socialScoreMap.get(rec._id)
        if (socialScore) {
          rec.social_score = socialScore.socialScore
          rec.social_interactions = socialScore.socialInteractions
          rec.social_reasons = socialScore.reasons
          rec.social_distance_score = socialScore.distanceScore
          rec.social_influence_score = socialScore.influenceScore
          rec.social_interaction_score = socialScore.interactionScore
        }
      })

      // 重新按 total_score 排序，確保社交分數計算不會影響原始排序
      sortByTotalScoreDesc(paginatedRecommendations)
    }

    // 生成推薦原因
    if (includeRecommendationReasons && userId) {
      for (const rec of paginatedRecommendations) {
        if (rec.social_reasons && rec.social_reasons.length > 0) {
          rec.recommendation_reason = rec.social_reasons[0].text
          rec.recommendation_reasons = rec.social_reasons
        } else {
          // 根據演算法類型生成通用推薦原因
          rec.recommendation_reason = generateGenericRecommendationReason(rec)
        }
      }
    }

    // 計算多樣性
    let diversity = null
    if (includeDiversity) {
      diversity = calculateRecommendationDiversity(paginatedRecommendations)
    }

    // 設定快取（儲存完整的推薦列表）
    if (useCache) {
      const cacheData = {
        recommendations: mergedRecommendations, // 儲存完整的推薦列表
        weights,
        coldStartStatus,
        algorithm: 'mixed',
        userAuthenticated: !!userId,
        appliedTags: tags,
      }
      await redisCache.set(cacheKey, cacheData, CACHE_CONFIG.mixedRecommendations)
    }

    const result = {
      recommendations: paginatedRecommendations,
      weights,
      coldStartStatus,
      diversity,
      algorithm: 'mixed',
      userAuthenticated: !!userId,
      appliedTags: tags,
      // 新增：分頁資訊
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip,
        total: mergedRecommendations.length,
        hasMore: skip + limit < mergedRecommendations.length,
        totalPages: Math.ceil(mergedRecommendations.length / limit),
      },
      // 新增：顯示實際查詢的數量
      queryInfo: {
        requestedLimit: limit,
        adjustedLimit: adjustedLimit,
        coldStartMultiplier: COLD_START_CONFIG.coldStartMultiplier,
        isColdStart: !userId || (coldStartStatus && coldStartStatus.isColdStart),
        excludedCount: excludeIds ? excludeIds.length : 0,
      },
    }

    performanceMonitor.end('mixed_recommendations')
    return result
  } catch (error) {
    performanceMonitor.end('mixed_recommendations')
    logger.error('混合推薦失敗:', error)
    throw error
  }
}

/**
 * 取得無限捲動推薦（專門為前端無限捲動設計）
 * @param {string} userId - 用戶ID（可選）
 * @param {Object} options - 選項
 * @returns {Object} 無限捲動推薦結果
 */
export const getInfiniteScrollRecommendations = async (userId = null, options = {}) => {
  performanceMonitor.start('infinite_scroll_recommendations')

  try {
    const {
      page = 1,
      limit = 10,
      excludeIds = [],
      tags = [],
      customWeights = {},
      includeSocialScores = true,
      includeRecommendationReasons = true,
    } = options

    // 計算需要獲取的總數量（確保有足夠的推薦）
    const totalNeeded = page * limit + excludeIds.length + 50 // 額外緩衝

    // 使用混合推薦系統獲取更多推薦
    const result = await getMixedRecommendations(userId, {
      limit: totalNeeded,
      customWeights,
      includeDiversity: false, // 無限捲動不需要多樣性計算
      includeColdStartAnalysis: true,
      includeSocialScores,
      includeRecommendationReasons,
      useCache: true,
      tags,
      page: 1, // 總是從第一頁開始
      excludeIds: [], // 在混合推薦中不排除，在結果中排除
    })

    // 排除已顯示的項目
    let filteredRecommendations = result.recommendations
    if (excludeIds && excludeIds.length > 0) {
      const excludeSet = new Set(excludeIds.map((id) => id.toString()))
      filteredRecommendations = filteredRecommendations.filter(
        (rec) => !excludeSet.has(rec._id.toString()),
      )
    }

    // 計算分頁
    const skip = (page - 1) * limit
    const paginatedRecommendations = filteredRecommendations.slice(skip, skip + limit)

    // 確保分頁後的推薦按 total_score 排序
    sortByTotalScoreDesc(paginatedRecommendations)

    // 計算分頁資訊
    const total = filteredRecommendations.length
    const hasMore = skip + limit < total
    const totalPages = Math.ceil(total / limit)

    const infiniteScrollResult = {
      recommendations: paginatedRecommendations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip,
        total,
        hasMore,
        totalPages,
        nextPage: hasMore ? page + 1 : null,
      },
      algorithm: 'mixed',
      userAuthenticated: !!userId,
      appliedTags: tags,
      weights: result.weights,
      coldStartStatus: result.coldStartStatus,
      queryInfo: {
        requestedLimit: limit,
        totalNeeded,
        excludedCount: excludeIds ? excludeIds.length : 0,
        isColdStart: !userId || (result.coldStartStatus && result.coldStartStatus.isColdStart),
      },
    }

    performanceMonitor.end('infinite_scroll_recommendations')
    return infiniteScrollResult
  } catch (error) {
    performanceMonitor.end('infinite_scroll_recommendations')
    logger.error('無限捲動推薦失敗:', error)
    throw error
  }
}

/**
 * 取得推薦演算法統計（快取版本）
 * @param {string} userId - 用戶ID（可選）
 * @returns {Object} 演算法統計
 */
export const getRecommendationAlgorithmStats = async (userId = null) => {
  const cacheKey = `recommendation_stats:${userId || 'anonymous'}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        const stats = {
          totalMemes: await Meme.countDocuments({ status: 'public' }),
          hotMemes: await Meme.countDocuments({ status: 'public', hot_score: { $gte: 100 } }),
          trendingMemes: await Meme.countDocuments({ status: 'public', hot_score: { $gte: 500 } }),
          viralMemes: await Meme.countDocuments({ status: 'public', hot_score: { $gte: 1000 } }),
        }

        if (userId) {
          const coldStartStatus = await checkColdStartStatus(userId)
          stats.userActivity = coldStartStatus.activityScore
          stats.coldStart = coldStartStatus.isColdStart
          stats.userPreferences = coldStartStatus.userPreferences
        }

        return stats
      } catch (error) {
        logger.error('取得推薦演算法統計失敗:', error)
        throw error
      }
    },
    { ttl: 1800 }, // 30分鐘快取
  )
}

/**
 * 動態調整推薦策略（快取版本）
 * @param {string} userId - 用戶ID
 * @param {Object} userBehavior - 用戶行為數據
 * @returns {Object} 調整後的推薦策略
 */
export const adjustRecommendationStrategy = async (userId, userBehavior = {}) => {
  const cacheKey = `recommendation_strategy:${userId}:${JSON.stringify(userBehavior)}`

  return await cacheProcessor.processWithCache(
    cacheKey,
    async () => {
      try {
        const { clickRate, engagementRate, diversityPreference } = userBehavior
        const coldStartStatus = await checkColdStartStatus(userId)

        // 根據用戶行為調整策略
        let strategy = {
          weights: { ...ALGORITHM_WEIGHTS },
          focus: 'balanced',
          coldStartHandling: coldStartStatus.isColdStart,
        }

        // 高點擊率用戶傾向個人化推薦
        if (clickRate > 0.3) {
          strategy.weights.content_based = 0.32
          strategy.weights.collaborative_filtering = 0.23
          strategy.weights.social_collaborative_filtering = 0.18
          strategy.weights.hot = 0.09
          strategy.weights.latest = 0.09
          strategy.weights.updated = 0.09
          strategy.focus = 'personalization'
        }

        // 高互動率用戶傾向社交推薦
        if (engagementRate > 0.5) {
          strategy.weights.social_collaborative_filtering = 0.27
          strategy.weights.collaborative_filtering = 0.23
          strategy.weights.content_based = 0.18
          strategy.weights.hot = 0.13
          strategy.weights.latest = 0.09
          strategy.weights.updated = 0.1
          strategy.focus = 'social'
        }

        // 高多樣性偏好用戶傾向探索推薦
        if (diversityPreference > 0.7) {
          strategy.weights.latest = 0.25
          strategy.weights.updated = 0.2
          strategy.weights.hot = 0.2
          strategy.weights.content_based = 0.17
          strategy.weights.collaborative_filtering = 0.1
          strategy.weights.social_collaborative_filtering = 0.08
          strategy.focus = 'exploration'
        }

        // 冷啟動用戶使用熱門推薦
        if (coldStartStatus.isColdStart) {
          strategy.weights.hot = 0.5
          strategy.weights.latest = 0.3
          strategy.weights.updated = 0.2
          strategy.weights.content_based = 0
          strategy.weights.collaborative_filtering = 0
          strategy.weights.social_collaborative_filtering = 0
          strategy.focus = 'discovery'
        }

        return strategy
      } catch (error) {
        logger.error('調整推薦策略失敗:', error)
        throw error
      }
    },
    { ttl: 3600 }, // 1小時快取
  )
}

/**
 * 生成通用推薦原因
 * @param {Object} recommendation - 推薦項目
 * @returns {string} 推薦原因
 */
const generateGenericRecommendationReason = (recommendation) => {
  try {
    // 根據推薦類型生成原因
    if (recommendation.recommendation_type) {
      const type = recommendation.recommendation_type

      switch (type) {
        case 'hot':
          return '這則迷因目前很熱門'
        case 'latest':
          return '這是最新發布的迷因'
        case 'updated':
          return '這則迷因最近有更新'
        case 'content_based':
          return '基於你喜歡的內容類型推薦'
        case 'collaborative_filtering':
          return '與你有相似喜好的用戶也喜歡這個'
        case 'social_collaborative_filtering':
          return '你的社交圈對這個迷因有興趣'
        case 'mixed':
          return '綜合多種演算法的推薦'
        default:
          return '為你推薦的迷因'
      }
    }

    // 根據熱門分數生成原因
    if (recommendation.hot_score) {
      if (recommendation.hot_score >= 1000) {
        return '這則迷因正在病毒式傳播'
      } else if (recommendation.hot_score >= 500) {
        return '這則迷因很受歡迎'
      } else if (recommendation.hot_score >= 100) {
        return '這則迷因有一定熱度'
      }
    }

    // 根據標籤生成原因
    if (recommendation.tags && recommendation.tags.length > 0) {
      return `基於你對 ${recommendation.tags[0]} 標籤的興趣推薦`
    }

    return '為你推薦的迷因'
  } catch (error) {
    logger.error('生成通用推薦原因時發生錯誤:', error)
    return '為你推薦的迷因'
  }
}

/**
 * 清除用戶相關快取
 * @param {string} userId - 用戶ID
 */
export const clearUserCache = async (userId) => {
  try {
    const patterns = [
      `user_activity:${userId}`,
      `cold_start:${userId}`,
      `content_based:${userId}:*`,
      `collaborative_filtering:${userId}:*`,
      `social_collaborative_filtering:${userId}:*`,
      `mixed_recommendations:${userId}:*`,
      `recommendation_stats:${userId}`,
      `recommendation_strategy:${userId}:*`,
    ]

    await Promise.all(patterns.map((pattern) => redisCache.delPattern(pattern)))

    logger.info(`已清除用戶 ${userId} 的快取`)
  } catch (error) {
    logger.error('清除用戶快取失敗:', error)
  }
}

/**
 * 清除混合推薦快取
 * @param {string} userId - 用戶ID（可選）
 */
export const clearMixedRecommendationCache = async (userId = null) => {
  try {
    const patterns = [
      `mixed_recommendations:${userId || 'anonymous'}:*`,
      `hot_recommendations:*`,
      `latest_recommendations:*`,
      `updated_recommendations:*`,
    ]

    await Promise.all(patterns.map((pattern) => redisCache.delPattern(pattern)))

    logger.info(`已清除混合推薦快取 ${userId ? `(用戶: ${userId})` : '(匿名用戶)'}`)
  } catch (error) {
    logger.error('清除混合推薦快取失敗:', error)
  }
}

/**
 * 取得效能監控數據
 */
export const getPerformanceMetrics = () => {
  return performanceMonitor.getAllMetrics()
}
