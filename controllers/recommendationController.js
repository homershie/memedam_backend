/**
 * 推薦系統控制器
 * 提供各種推薦演算法的 API 端點
 */

import { StatusCodes } from 'http-status-codes'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { getHotScoreLevel } from '../utils/hotScore.js'
import {
  getContentBasedRecommendations,
  getTagBasedRecommendations,
  calculateUserTagPreferences,
  updateUserPreferencesCache,
} from '../utils/contentBasedRecommendation.js'

/**
 * 取得熱門推薦
 * 基於熱門分數的推薦
 */
export const getHotRecommendations = async (req, res) => {
  try {
    const { limit = 20, type = 'all', days = 7, exclude_viewed = 'false' } = req.query

    const userId = req.user?._id
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - parseInt(days))

    // 建立查詢條件
    const filter = {
      status: 'public',
      createdAt: { $gte: dateLimit },
    }

    if (type !== 'all') {
      filter.type = type
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
    const { limit = 20, type = 'all', hours = 24 } = req.query

    const dateLimit = new Date()
    dateLimit.setHours(dateLimit.getHours() - parseInt(hours))

    const filter = {
      status: 'public',
      createdAt: { $gte: dateLimit },
    }

    if (type !== 'all') {
      filter.type = type
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

    // 取得內容基礎推薦
    const recommendations = await getContentBasedRecommendations(userId, {
      limit: parseInt(limit),
      minSimilarity: parseFloat(min_similarity),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
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
    const { limit = 20 } = req.query
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

    // 這裡可以加入更複雜的用戶興趣分析
    // 暫時返回熱門推薦，未來可以實作真正的個人化推薦
    const recommendations = await Meme.find({
      status: 'public',
    })
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
export const getMixedRecommendations = async (req, res) => {
  try {
    const {
      limit = 30,
      hot_weight = 0.25,
      latest_weight = 0.25,
      content_weight = 0.25,
      similar_weight = 0.25,
    } = req.query
    const userId = req.user?._id

    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - 7)

    // 取得熱門推薦
    const hotMemes = await Meme.find({
      status: 'public',
      createdAt: { $gte: dateLimit },
    })
      .sort({ hot_score: -1 })
      .limit(parseInt(limit * hot_weight))
      .populate('author_id', 'username display_name avatar')

    // 取得最新推薦
    const latestMemes = await Meme.find({
      status: 'public',
      createdAt: { $gte: dateLimit },
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit * latest_weight))
      .populate('author_id', 'username display_name avatar')

    // 取得內容基礎推薦（如果用戶已登入）
    let contentBasedMemes = []
    if (userId) {
      try {
        contentBasedMemes = await getContentBasedRecommendations(userId, {
          limit: parseInt(limit * content_weight),
          minSimilarity: 0.1,
          excludeInteracted: true,
          includeHotScore: true,
          hotScoreWeight: 0.3,
        })
      } catch (error) {
        console.log('內容基礎推薦失敗，使用熱門推薦作為備選:', error.message)
        // 如果內容基礎推薦失敗，使用熱門推薦作為備選
        const fallbackMemes = await Meme.find({
          status: 'public',
          createdAt: { $gte: dateLimit },
        })
          .sort({ hot_score: -1 })
          .limit(parseInt(limit * content_weight))
          .populate('author_id', 'username display_name avatar')

        contentBasedMemes = fallbackMemes.map((meme) => ({
          ...meme.toObject(),
          recommendation_score: meme.hot_score,
          recommendation_type: 'content_based_fallback',
        }))
      }
    }

    // 合併所有推薦
    const allMemes = [...hotMemes, ...latestMemes, ...contentBasedMemes]
    const uniqueMemes = []
    const seenIds = new Set()

    for (const meme of allMemes) {
      if (!seenIds.has(meme._id.toString())) {
        seenIds.add(meme._id.toString())
        uniqueMemes.push(meme)
      }
    }

    // 計算混合推薦分數
    const recommendations = uniqueMemes.map((meme) => {
      const memeObj = meme.toObject()
      const hotScore = memeObj.hot_score || 0
      const timeScore = 1 / (Date.now() - memeObj.createdAt.getTime())

      // 根據推薦類型計算分數
      let contentScore = 0
      if (memeObj.recommendation_type === 'content_based') {
        contentScore = memeObj.recommendation_score || 0
      } else if (memeObj.recommendation_type === 'content_based_fallback') {
        contentScore = memeObj.recommendation_score || 0
      }

      // 混合分數計算
      const mixedScore =
        hotScore * parseFloat(hot_weight) +
        timeScore * parseFloat(latest_weight) +
        contentScore * parseFloat(content_weight)

      return {
        ...memeObj,
        recommendation_score: mixedScore,
        recommendation_type: 'mixed',
        hot_score_weight: parseFloat(hot_weight),
        latest_weight: parseFloat(latest_weight),
        content_weight: parseFloat(content_weight),
        similar_weight: parseFloat(similar_weight),
        hot_level: getHotScoreLevel(hotScore),
      }
    })

    // 按混合分數排序
    recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score)

    res.json({
      success: true,
      data: {
        recommendations: recommendations.slice(0, parseInt(limit)),
        filters: {
          limit: parseInt(limit),
          hot_weight: parseFloat(hot_weight),
          latest_weight: parseFloat(latest_weight),
          content_weight: parseFloat(content_weight),
          similar_weight: parseFloat(similar_weight),
        },
        algorithm: 'mixed',
        weights: {
          hot: parseFloat(hot_weight),
          latest: parseFloat(latest_weight),
          content: parseFloat(content_weight),
          similar: parseFloat(similar_weight),
        },
        user_authenticated: !!userId,
        content_based_included: contentBasedMemes.length > 0,
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

export default {
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
}
