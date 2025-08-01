/**
 * 推薦系統控制器
 * 提供各種推薦演算法的 API 端點
 */

import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { getHotScoreLevel } from '../utils/hotScore.js'
import {
  getContentBasedRecommendations,
  getTagBasedRecommendations,
  calculateUserTagPreferences,
  updateUserPreferencesCache,
} from '../utils/contentBased.js'
import {
  getCollaborativeFilteringRecommendations,
  getSocialCollaborativeFilteringRecommendations,
  getSocialCollaborativeFilteringStats,
  updateSocialCollaborativeFilteringCache,
  updateCollaborativeFilteringCache,
} from '../utils/collaborativeFiltering.js'
import { getCollaborativeFilteringStats } from '../utils/collaborativeFilteringScheduler.js'
import {
  getMixedRecommendations,
  getRecommendationAlgorithmStats,
  adjustRecommendationStrategy,
  clearMixedRecommendationCache,
} from '../utils/mixedRecommendation.js'
import {
  calculateMemeSocialScore,
  getUserSocialInfluenceStats,
} from '../utils/socialScoreCalculator.js'

/**
 * 取得熱門推薦
 * 基於熱門分數的推薦
 */
export const getHotRecommendations = async (req, res) => {
  try {
    const { limit = 20, type = 'all', days = 7, exclude_viewed = 'false', tags } = req.query

    const userId = req.user?._id
    const parsedDays = parseInt(days)
    const validDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - validDays)

    // 建立查詢條件
    const filter = {
      status: 'public',
      createdAt: mongoose.trusted({ $gte: dateLimit }),
    }

    if (type !== 'all') {
      filter.type = type
    }

    // 如果有標籤篩選，加入標籤條件
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
      if (tagArray.length > 0) {
        filter.tags_cache = { $in: tagArray }
      }
    }

    // 排除用戶已看過的迷因
    if (exclude_viewed === 'true' && userId) {
      // 這裡可以加入用戶瀏覽歷史的邏輯
      // 暫時先不實作，因為需要 View 模型
    }

    const memes = await Meme.find(filter)
      .sort({ hot_score: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'username display_name avatar')

    // 為每個迷因添加推薦分數和等級
    const recommendations = memes.map((meme) => {
      const memeObj = meme.toObject()
      return {
        ...memeObj,
        recommendation_score: memeObj.hot_score,
        recommendation_type: 'hot',
        hot_level: getHotScoreLevel(memeObj.hot_score),
      }
    })

    res.json({
      success: true,
      data: {
        recommendations,
        filters: {
          type,
          days: parseInt(days),
          limit: parseInt(limit),
          tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())) : [],
        },
        algorithm: 'hot_score',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得最新推薦
 * 基於時間的推薦
 */
export const getLatestRecommendations = async (req, res) => {
  try {
    const { limit = 20, type = 'all', hours = 24, tags } = req.query

    const parsedHours = parseInt(hours)
    const validHours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24

    const dateLimit = new Date()
    dateLimit.setHours(dateLimit.getHours() - validHours)

    const filter = {
      status: 'public',
      createdAt: mongoose.trusted({ $gte: dateLimit }),
    }

    if (type !== 'all') {
      filter.type = type
    }

    // 如果有標籤篩選，加入標籤條件
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
      if (tagArray.length > 0) {
        filter.tags_cache = { $in: tagArray }
      }
    }

    const memes = await Meme.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'username display_name avatar')

    const recommendations = memes.map((meme) => {
      const memeObj = meme.toObject()
      return {
        ...memeObj,
        recommendation_score: 1 / (Date.now() - memeObj.createdAt.getTime()),
        recommendation_type: 'latest',
        time_factor: Math.floor((Date.now() - memeObj.createdAt.getTime()) / (1000 * 60 * 60)),
      }
    })

    res.json({
      success: true,
      data: {
        recommendations,
        filters: {
          type,
          hours: parseInt(hours),
          limit: parseInt(limit),
          tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())) : [],
        },
        algorithm: 'latest',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得相似迷因推薦
 * 基於標籤和內容相似度
 */
export const getSimilarRecommendations = async (req, res) => {
  try {
    const { memeId } = req.params
    const { limit = 10 } = req.query

    const targetMeme = await Meme.findById(memeId)
    if (!targetMeme) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到指定的迷因',
      })
    }

    // 基於標籤相似度推薦
    const similarMemes = await Meme.find({
      _id: { $ne: memeId },
      status: 'public',
      tags_cache: { $in: targetMeme.tags_cache },
    })
      .sort({ hot_score: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'username display_name avatar')

    const recommendations = similarMemes.map((meme) => {
      const memeObj = meme.toObject()
      const commonTags = memeObj.tags_cache.filter((tag) => targetMeme.tags_cache.includes(tag))

      return {
        ...memeObj,
        recommendation_score: commonTags.length / Math.max(targetMeme.tags_cache.length, 1),
        recommendation_type: 'similar',
        common_tags: commonTags,
        similarity_score: commonTags.length / Math.max(targetMeme.tags_cache.length, 1),
      }
    })

    res.json({
      success: true,
      data: {
        target_meme: {
          id: targetMeme._id,
          title: targetMeme.title,
          tags: targetMeme.tags_cache,
        },
        recommendations,
        filters: {
          limit: parseInt(limit),
        },
        algorithm: 'similar_tags',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得內容基礎推薦
 * 基於用戶標籤偏好和迷因標籤相似度的推薦
 */
export const getContentBasedRecommendationsController = async (req, res) => {
  try {
    const {
      limit = 20,
      min_similarity = 0.1,
      exclude_interacted = 'true',
      include_hot_score = 'true',
      hot_score_weight = 0.3,
      tags,
    } = req.query
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得個人化推薦',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    // 取得內容基礎推薦
    const recommendations = await getContentBasedRecommendations(userId, {
      limit: parseInt(limit),
      minSimilarity: parseFloat(min_similarity),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      tags: tagArray,
    })

    res.json({
      success: true,
      data: {
        recommendations,
        user_id: userId,
        filters: {
          limit: parseInt(limit),
          min_similarity: parseFloat(min_similarity),
          exclude_interacted: exclude_interacted === 'true',
          include_hot_score: include_hot_score === 'true',
          hot_score_weight: parseFloat(hot_score_weight),
          tags: tagArray,
        },
        algorithm: 'content_based',
        algorithm_details: {
          description: '基於用戶標籤偏好和迷因標籤相似度的推薦演算法',
          features: [
            '分析用戶的按讚、留言、分享、收藏、瀏覽歷史',
            '計算用戶對不同標籤的偏好權重',
            '基於標籤相似度計算迷因推薦分數',
            '結合熱門分數提升推薦品質',
            '支援時間衰減，新互動權重更高',
            '標籤篩選支援',
          ],
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得標籤相關推薦
 * 基於指定標籤的相關迷因推薦
 */
export const getTagBasedRecommendationsController = async (req, res) => {
  try {
    const {
      tags,
      limit = 20,
      min_similarity = 0.1,
      include_hot_score = 'true',
      hot_score_weight = 0.3,
    } = req.query

    if (!tags) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '請提供標籤參數',
      })
    }

    const tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())

    // 取得標籤相關推薦
    const recommendations = await getTagBasedRecommendations(tagArray, {
      limit: parseInt(limit),
      minSimilarity: parseFloat(min_similarity),
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
    })

    res.json({
      success: true,
      data: {
        recommendations,
        query_tags: tagArray,
        filters: {
          limit: parseInt(limit),
          min_similarity: parseFloat(min_similarity),
          include_hot_score: include_hot_score === 'true',
          hot_score_weight: parseFloat(hot_score_weight),
        },
        algorithm: 'tag_based',
        algorithm_details: {
          description: '基於指定標籤的相關迷因推薦',
          features: [
            '計算迷因標籤與查詢標籤的相似度',
            '結合熱門分數提升推薦品質',
            '支援多標籤查詢',
          ],
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得用戶標籤偏好
 * 分析用戶的標籤偏好權重
 */
export const getUserTagPreferences = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得個人偏好',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 計算用戶標籤偏好
    const preferences = await calculateUserTagPreferences(userId)

    res.json({
      success: true,
      data: {
        user_id: userId,
        preferences: preferences.preferences,
        interaction_counts: preferences.interactionCounts,
        total_interactions: preferences.totalInteractions,
        confidence: preferences.confidence,
        analysis: {
          top_tags: Object.entries(preferences.preferences)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([tag, score]) => ({ tag, score })),
          total_tags: Object.keys(preferences.preferences).length,
          confidence_level:
            preferences.confidence < 0.1 ? 'low' : preferences.confidence < 0.3 ? 'medium' : 'high',
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 更新用戶偏好快取
 * 重新計算並更新用戶的標籤偏好
 */
export const updateUserPreferences = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能更新個人偏好',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 更新用戶偏好快取
    const result = await updateUserPreferencesCache(userId)

    if (!result.success) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: result.error,
      })
    }

    res.json({
      success: true,
      data: {
        user_id: userId,
        preferences: result.preferences,
        confidence: result.confidence,
        updated_at: result.updatedAt,
        message: '用戶偏好已成功更新',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得用戶興趣推薦
 * 基於用戶的互動歷史
 */
export const getUserInterestRecommendations = async (req, res) => {
  try {
    const { limit = 20, tags } = req.query
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得個人化推薦',
      })
    }

    // 取得用戶的互動歷史（這裡需要實作 Like, Collection 等模型）
    // 暫時使用簡單的標籤偏好
    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    // 建立查詢條件
    const filter = { status: 'public' }

    // 如果有標籤篩選，加入標籤條件
    if (tagArray.length > 0) {
      filter.tags_cache = { $in: tagArray }
    }

    // 這裡可以加入更複雜的用戶興趣分析
    // 暫時返回熱門推薦，未來可以實作真正的個人化推薦
    const recommendations = await Meme.find(filter)
      .sort({ hot_score: -1 })
      .limit(parseInt(limit))
      .populate('author_id', 'username display_name avatar')

    const recommendationsWithScores = recommendations.map((meme) => {
      const memeObj = meme.toObject()
      return {
        ...memeObj,
        recommendation_score: memeObj.hot_score,
        recommendation_type: 'user_interest',
        personalization_level: 'basic', // 可以根據實際演算法調整
      }
    })

    res.json({
      success: true,
      data: {
        recommendations: recommendationsWithScores,
        user_id: userId,
        filters: {
          limit: parseInt(limit),
          tags: tagArray,
        },
        algorithm: 'user_interest',
        note: '目前使用基礎推薦，未來將實作更進階的個人化演算法',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得混合推薦
 * 結合多種推薦演算法，包括內容基礎推薦
 */
export const getMixedRecommendationsController = async (req, res) => {
  try {
    const {
      limit = 30,
      custom_weights = '{}',
      include_diversity = 'true',
      include_cold_start_analysis = 'true',
      tags,
      clear_cache = 'false',
    } = req.query
    const userId = req.user?._id

    // 如果需要清除快取
    if (clear_cache === 'true') {
      await clearMixedRecommendationCache(userId)
    }

    // 解析自定義權重
    let customWeights = {}
    try {
      customWeights = JSON.parse(custom_weights)
    } catch {
      console.log('自定義權重解析失敗，使用預設權重')
    }

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    // 使用新的混合推薦系統
    const result = await getMixedRecommendations(userId, {
      limit: parseInt(limit),
      customWeights,
      includeDiversity: include_diversity === 'true',
      includeColdStartAnalysis: include_cold_start_analysis === 'true',
      tags: tagArray,
    })

    res.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        filters: {
          limit: parseInt(limit),
          custom_weights: customWeights,
          include_diversity: include_diversity === 'true',
          include_cold_start_analysis: include_cold_start_analysis === 'true',
          tags: tagArray,
          clear_cache: clear_cache === 'true',
        },
        algorithm: 'mixed',
        weights: result.weights,
        cold_start_status: result.coldStartStatus,
        diversity: result.diversity,
        user_authenticated: !!userId,
        query_info: result.queryInfo, // 新增查詢資訊
        algorithm_details: {
          description: '整合所有推薦演算法的混合推薦系統',
          features: [
            '支援動態權重調整',
            '冷啟動處理機制',
            '多樣性計算',
            '用戶活躍度分析',
            '個人化推薦策略',
            '標籤篩選支援',
            '自動擴大時間範圍',
            '冷啟動數量倍數',
          ],
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得推薦統計資訊
 */
export const getRecommendationStats = async (req, res) => {
  try {
    const stats = {
      total_memes: await Meme.countDocuments({ status: 'public' }),
      hot_memes: await Meme.countDocuments({
        status: 'public',
        hot_score: { $gte: 100 },
      }),
      trending_memes: await Meme.countDocuments({
        status: 'public',
        hot_score: { $gte: 500 },
      }),
      viral_memes: await Meme.countDocuments({
        status: 'public',
        hot_score: { $gte: 1000 },
      }),
    }

    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得協同過濾推薦
 * 基於用戶行為相似性的推薦
 */
export const getCollaborativeFilteringRecommendationsController = async (req, res) => {
  try {
    const {
      limit = 20,
      min_similarity = 0.1,
      max_similar_users = 50,
      exclude_interacted = 'true',
      include_hot_score = 'true',
      hot_score_weight = 0.3,
      tags,
    } = req.query
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得協同過濾推薦',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    // 取得協同過濾推薦
    const recommendations = await getCollaborativeFilteringRecommendations(userId, {
      limit: parseInt(limit),
      minSimilarity: parseFloat(min_similarity),
      maxSimilarUsers: parseInt(max_similar_users),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      tags: tagArray,
    })

    res.json({
      success: true,
      data: {
        recommendations,
        user_id: userId,
        filters: {
          limit: parseInt(limit),
          min_similarity: parseFloat(min_similarity),
          max_similar_users: parseInt(max_similar_users),
          exclude_interacted: exclude_interacted === 'true',
          include_hot_score: include_hot_score === 'true',
          hot_score_weight: parseFloat(hot_score_weight),
          tags: tagArray,
        },
        algorithm: 'collaborative_filtering',
        algorithm_details: {
          description: '基於用戶行為相似性的協同過濾推薦演算法',
          features: [
            '分析用戶的按讚、留言、分享、收藏、瀏覽歷史',
            '計算用戶間的相似度',
            '推薦相似用戶喜歡但當前用戶未互動的內容',
            '結合熱門分數提升推薦品質',
            '支援時間衰減，新互動權重更高',
            '標籤篩選支援',
          ],
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得用戶協同過濾統計
 * 分析用戶的協同過濾相關統計資訊
 */
export const getCollaborativeFilteringStatsController = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得協同過濾統計',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 取得協同過濾統計
    const stats = await getCollaborativeFilteringStats(userId)

    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 更新協同過濾快取
 * 重新計算並更新協同過濾相關的快取數據
 */
export const updateCollaborativeFilteringCacheController = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能更新協同過濾快取',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    // 更新協同過濾快取
    const cacheResults = await updateCollaborativeFilteringCache([userId])

    res.json({
      success: true,
      data: {
        user_id: userId,
        cache_results: cacheResults,
        updated_at: new Date().toISOString(),
        message: '協同過濾快取已成功更新',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得社交協同過濾推薦
 * 基於社交關係和用戶行為相似性的推薦
 */
export const getSocialCollaborativeFilteringRecommendationsController = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得社交協同過濾推薦',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    const {
      limit = 20,
      min_similarity = 0.1,
      max_similar_users = 50,
      exclude_interacted = 'true',
      include_hot_score = 'true',
      hot_score_weight = 0.3,
      tags,
    } = req.query

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    const options = {
      limit: parseInt(limit),
      minSimilarity: parseFloat(min_similarity),
      maxSimilarUsers: parseInt(max_similar_users),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      tags: tagArray,
    }

    const recommendations = await getSocialCollaborativeFilteringRecommendations(userId, options)

    res.json({
      success: true,
      data: {
        recommendations,
        user_id: userId,
        filters: {
          limit: parseInt(limit),
          min_similarity: parseFloat(min_similarity),
          max_similar_users: parseInt(max_similar_users),
          exclude_interacted: exclude_interacted === 'true',
          include_hot_score: include_hot_score === 'true',
          hot_score_weight: parseFloat(hot_score_weight),
          tags: tagArray,
        },
        algorithm: 'social_collaborative_filtering',
        algorithm_details: {
          description: '基於社交關係和用戶行為相似性的社交協同過濾推薦演算法',
          features: [
            '分析用戶的社交關係圖譜（追隨者、追隨中、互追）',
            '計算社交影響力分數和社交相似度',
            '結合行為相似度和社交相似度進行推薦',
            '考慮社交影響力加權，影響力高的用戶推薦權重更大',
            '支援時間衰減，新互動權重更高',
            '標籤篩選支援',
          ],
        },
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得用戶社交協同過濾統計
 * 分析用戶的社交協同過濾相關統計資訊
 */
export const getSocialCollaborativeFilteringStatsController = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能取得社交協同過濾統計',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    const stats = await getSocialCollaborativeFilteringStats(userId)

    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 更新社交協同過濾快取
 * 重新計算並更新社交協同過濾相關的快取數據
 */
export const updateSocialCollaborativeFilteringCacheController = async (req, res) => {
  try {
    const userId = req.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能更新社交協同過濾快取',
      })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: '找不到用戶',
      })
    }

    const cacheResults = await updateSocialCollaborativeFilteringCache([userId])

    res.json({
      success: true,
      data: {
        user_id: userId,
        cache_results: cacheResults,
        updated_at: new Date().toISOString(),
        message: '社交協同過濾快取已成功更新',
      },
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 取得推薦演算法統計
 */
export const getRecommendationAlgorithmStatsController = async (req, res) => {
  try {
    const userId = req.user?._id
    const stats = await getRecommendationAlgorithmStats(userId)

    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 動態調整推薦策略
 */
export const adjustRecommendationStrategyController = async (req, res) => {
  try {
    const userId = req.user?._id
    const { userBehavior = {} } = req.body

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: '需要登入才能調整推薦策略',
      })
    }

    const strategy = await adjustRecommendationStrategy(userId, userBehavior)

    res.json({
      success: true,
      data: strategy,
      error: null,
    })
  } catch (err) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: err.message,
    })
  }
}

/**
 * 計算迷因社交層分數控制器
 * @param {Object} req - 請求對象
 * @param {Object} res - 回應對象
 */
export const calculateMemeSocialScoreController = async (req, res) => {
  try {
    const { userId } = req.user
    const { memeId } = req.params
    const options = req.query

    const socialScore = await calculateMemeSocialScore(userId, memeId, options)

    res.json({
      success: true,
      data: socialScore,
      error: null,
    })
  } catch (error) {
    console.error('計算迷因社交層分數失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '計算迷因社交層分數失敗',
    })
  }
}

/**
 * 取得用戶社交影響力統計控制器
 * @param {Object} req - 請求對象
 * @param {Object} res - 回應對象
 */
export const getUserSocialInfluenceStatsController = async (req, res) => {
  try {
    const { userId } = req.user

    const stats = await getUserSocialInfluenceStats(userId)

    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (error) {
    console.error('取得用戶社交影響力統計失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '取得用戶社交影響力統計失敗',
    })
  }
}

export default {
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
}
