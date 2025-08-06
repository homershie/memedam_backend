/**
 * 推薦系統控制器
 * 提供各種推薦演算法的 API 端點
 */

import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import Like from '../models/Like.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import View from '../models/View.js'
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
  getInfiniteScrollRecommendations,
} from '../utils/mixedRecommendation.js'
import { sortByTotalScoreDesc } from '../utils/sortHelpers.js'
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
    const {
      limit = 20,
      type = 'all',
      days = 30, // 預設改為30天
      exclude_viewed = 'false',
      tags,
      types, // 新增：支援多個類型篩選
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
    } = req.query

    const userId = req.user?._id
    const parsedDays = parseInt(days)
    const validDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - validDays)

    // 建立查詢條件
    const filter = {
      status: 'public',
      createdAt: mongoose.trusted({ $gte: dateLimit }),
    }

    // 處理類型篩選
    if (types) {
      // 支援多個類型篩選
      const typeArray = Array.isArray(types) ? types : types.split(',').map((t) => t.trim())
      if (typeArray.length > 0) {
        if (typeArray.length === 1) {
          filter.type = typeArray[0] // 單一類型直接設置
        } else {
          filter.type = { $in: typeArray } // 多個類型使用$in查詢
        }
      }
    } else if (type !== 'all') {
      // 向後相容：單一類型篩選
      filter.type = type
    }

    // 如果有標籤篩選，加入標籤條件
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
      if (tagArray.length > 0) {
        filter.tags_cache = { $in: tagArray }
      }
    }

    // 解析排除ID參數 - 使用安全的ObjectId轉換 (getHotRecommendations)
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      // 確保所有ID都轉換為有效的ObjectId
      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            const objectId =
              id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
            return objectId
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 如果有排除ID，加入查詢條件
    if (excludeIds.length > 0) {
      filter._id = mongoose.trusted({ $nin: excludeIds })
    }

    // 排除用戶已看過的迷因
    if (exclude_viewed === 'true' && userId) {
      // 這裡可以加入用戶瀏覽歷史的邏輯
      // 暫時先不實作，因為需要 View 模型
    }

    // 計算分頁
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const totalLimit = parseInt(limit)

    const memes = await Meme.find(filter)
      .sort({ hot_score: -1 })
      .skip(skip)
      .limit(totalLimit)
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

    // 計算總數（用於分頁資訊）
    const totalCount = await Meme.countDocuments(filter)

    res.json({
      success: true,
      data: {
        recommendations,
        filters: {
          type,
          days: parseInt(days),
          limit: parseInt(limit),
          page: parseInt(page),
          exclude_ids: excludeIds,
          tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())) : [],
        },
        algorithm: 'hot_score',
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip,
          total: totalCount,
          hasMore: skip + totalLimit < totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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
 * 取得最新推薦
 * 基於時間的推薦
 */
export const getLatestRecommendations = async (req, res) => {
  try {
    const {
      limit = 20,
      type = 'all',
      hours = 'all', // 改為預設 'all' 表示不限制時間
      tags,
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
    } = req.query

    // 建立基礎查詢條件（不含排除ID）
    const baseFilter = {
      status: 'public',
    }

    // 只有在指定時間範圍時才加入時間篩選
    if (hours !== 'all' && hours !== '0') {
      const parsedHours = parseInt(hours)
      const validHours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24

      const dateLimit = new Date()
      dateLimit.setHours(dateLimit.getHours() - validHours)

      baseFilter.createdAt = mongoose.trusted({ $gte: dateLimit })
    }

    if (type !== 'all') {
      baseFilter.type = type
    }

    // 如果有標籤篩選，加入標籤條件
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
      if (tagArray.length > 0) {
        baseFilter.tags_cache = { $in: tagArray }
      }
    }

    // 解析排除ID參數 - 使用安全的ObjectId轉換
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      // 確保所有ID都轉換為有效的ObjectId
      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 如果有排除ID，建立完整查詢條件
    const filter = { ...baseFilter }
    if (excludeIds.length > 0) {
      filter._id = mongoose.trusted({ $nin: excludeIds })
    }

    // 計算分頁，排除已載入的ID
    const totalLimit = parseInt(limit)
    const skipBase = (parseInt(page) - 1) * totalLimit
    const skip = Math.max(skipBase - excludeIds.length, 0)

    // 添加調試資訊
    console.log('=== getLatestRecommendations 調試資訊 ===')
    console.log('查詢條件:', JSON.stringify(filter, null, 2))
    console.log('分頁參數 - page:', page, 'limit:', limit, 'skip:', skip, 'totalLimit:', totalLimit)
    console.log('排除ID數量:', excludeIds.length)

    const memes = await Meme.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(totalLimit)
      .populate('author_id', 'username display_name avatar')

    console.log('實際返回的迷因數量:', memes.length)

    const recommendations = memes.map((meme) => {
      const memeObj = meme.toObject()
      return {
        ...memeObj,
        recommendation_score: 1 / (Date.now() - memeObj.createdAt.getTime()),
        recommendation_type: 'latest',
        time_factor: Math.floor((Date.now() - memeObj.createdAt.getTime()) / (1000 * 60 * 60)),
      }
    })

    // 計算總數（用於分頁資訊，不包含排除ID）
    const totalCount = await Meme.countDocuments(baseFilter)

    // 判斷是否有更多內容
    const hasMore = excludeIds.length + skip + memes.length < totalCount

    res.json({
      success: true,
      data: {
        recommendations,
        filters: {
          type,
          hours: hours === 'all' ? 'all' : parseInt(hours),
          limit: parseInt(limit),
          page: parseInt(page),
          exclude_ids: excludeIds,
          tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())) : [],
        },
        algorithm: 'latest',
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip,
          total: totalCount,
          hasMore,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
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

    // 解析排除ID參數 - 使用安全的ObjectId轉換
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 計算分頁
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const totalLimit = parseInt(limit)

    // 取得內容基礎推薦
    const recommendations = await getContentBasedRecommendations(userId, {
      limit: totalLimit,
      minSimilarity: parseFloat(min_similarity),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      tags: tagArray,
      page: parseInt(page),
      excludeIds: excludeIds,
    })

    // 計算總數（用於分頁資訊）
    const totalCount = await Meme.countDocuments({
      status: 'public',
      ...(tagArray.length > 0 && { tags_cache: { $in: tagArray } }),
      ...(excludeIds.length > 0 && { _id: mongoose.trusted({ $nin: excludeIds }) }),
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
          page: parseInt(page),
          exclude_ids: excludeIds,
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
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip,
          total: totalCount,
          hasMore: skip + totalLimit < totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
    } = req.query

    if (!tags) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '請提供標籤參數',
      })
    }

    const tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())

    // 解析排除ID參數 - 使用安全的ObjectId轉換
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 計算分頁
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const totalLimit = parseInt(limit)

    // 取得標籤相關推薦
    const recommendations = await getTagBasedRecommendations(tagArray, {
      limit: totalLimit,
      minSimilarity: parseFloat(min_similarity),
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      page: parseInt(page),
      excludeIds: excludeIds,
    })

    // 計算總數（用於分頁資訊）
    const totalCount = await Meme.countDocuments({
      status: 'public',
      tags_cache: { $in: tagArray },
      ...(excludeIds.length > 0 && { _id: mongoose.trusted({ $nin: excludeIds }) }),
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
          page: parseInt(page),
          exclude_ids: excludeIds,
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
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip,
          total: totalCount,
          hasMore: skip + totalLimit < totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
    } = req.query
    const userId = req.user?._id

    // 如果需要清除快取
    if (clear_cache === 'true') {
      await clearMixedRecommendationCache(userId)
      console.log('已清除混合推薦快取')
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

    // 解析排除ID參數 - 使用安全的ObjectId轉換
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 使用新的混合推薦系統
    const result = await getMixedRecommendations(userId, {
      limit: parseInt(limit),
      customWeights,
      includeDiversity: include_diversity === 'true',
      includeColdStartAnalysis: include_cold_start_analysis === 'true',
      tags: tagArray,
      page: parseInt(page),
      excludeIds,
      useCache: clear_cache !== 'true', // 如果清除快取，就不使用快取
    })

    // 確保推薦結果按總分排序
    const sortedRecommendations = sortByTotalScoreDesc(result.recommendations)

    res.json({
      success: true,
      data: {
        recommendations: sortedRecommendations,
        filters: {
          limit: parseInt(limit),
          custom_weights: customWeights,
          include_diversity: include_diversity === 'true',
          include_cold_start_analysis: include_cold_start_analysis === 'true',
          tags: tagArray,
          clear_cache: clear_cache === 'true',
          page: parseInt(page),
          exclude_ids: excludeIds,
        },
        algorithm: 'mixed',
        weights: result.weights,
        cold_start_status: result.coldStartStatus,
        diversity: result.diversity,
        user_authenticated: !!userId,
        query_info: result.queryInfo, // 新增查詢資訊
        pagination: result.pagination, // 新增分頁資訊
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
            '分頁支援',
            '排除已顯示項目',
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
 * 取得無限捲動推薦（專門為前端無限捲動設計）
 */
export const getInfiniteScrollRecommendationsController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      exclude_ids,
      tags,
      custom_weights = '{}',
      include_social_scores = 'true',
      include_recommendation_reasons = 'true',
    } = req.query
    const userId = req.user?._id

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

    // 解析排除ID參數 - 使用安全的ObjectId轉換
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 使用無限捲動推薦系統
    const result = await getInfiniteScrollRecommendations(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      excludeIds,
      tags: tagArray,
      customWeights,
      includeSocialScores: include_social_scores === 'true',
      includeRecommendationReasons: include_recommendation_reasons === 'true',
    })

    res.json({
      success: true,
      data: {
        recommendations: result.recommendations,
        pagination: result.pagination,
        filters: {
          page: parseInt(page),
          limit: parseInt(limit),
          exclude_ids: excludeIds,
          tags: tagArray,
          custom_weights: customWeights,
          include_social_scores: include_social_scores === 'true',
          include_recommendation_reasons: include_recommendation_reasons === 'true',
        },
        algorithm: 'mixed',
        weights: result.weights,
        cold_start_status: result.coldStartStatus,
        user_authenticated: !!userId,
        query_info: result.queryInfo,
        algorithm_details: {
          description: '專門為無限捲動設計的混合推薦系統',
          features: [
            '支援分頁載入',
            '自動排除已顯示項目',
            '動態權重調整',
            '冷啟動處理機制',
            '個人化推薦策略',
            '標籤篩選支援',
            '社交分數計算',
            '推薦原因生成',
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
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
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

    // 解析排除ID參數 - 使用安全的ObjectId轉換
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 計算分頁
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const totalLimit = parseInt(limit)

    // 取得協同過濾推薦
    const recommendations = await getCollaborativeFilteringRecommendations(userId, {
      limit: totalLimit,
      minSimilarity: parseFloat(min_similarity),
      maxSimilarUsers: parseInt(max_similar_users),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      tags: tagArray,
      page: parseInt(page),
      excludeIds: excludeIds,
    })

    // 計算總數（用於分頁資訊）
    const totalCount = await Meme.countDocuments({
      status: 'public',
      ...(tagArray.length > 0 && { tags_cache: { $in: tagArray } }),
      ...(excludeIds.length > 0 && { _id: mongoose.trusted({ $nin: excludeIds }) }),
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
          page: parseInt(page),
          exclude_ids: excludeIds,
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
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip,
          total: totalCount,
          hasMore: skip + totalLimit < totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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
      // 新增：分頁和排除功能
      page = 1,
      exclude_ids,
    } = req.query

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    // 解析排除ID參數 - 使用安全的ObjectId轉換 (社交協同過濾)
    let excludeIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      // 確保所有ID都轉換為有效的ObjectId實例
      excludeIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            const objectId =
              id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)
            return objectId
          } catch (error) {
            console.warn(`轉換ObjectId失敗: ${id}`, error)
            return null
          }
        })
        .filter((id) => id !== null)
    }

    // 計算分頁
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const totalLimit = parseInt(limit)

    const options = {
      limit: totalLimit,
      minSimilarity: parseFloat(min_similarity),
      maxSimilarUsers: parseInt(max_similar_users),
      excludeInteracted: exclude_interacted === 'true',
      includeHotScore: include_hot_score === 'true',
      hotScoreWeight: parseFloat(hot_score_weight),
      tags: tagArray,
      page: parseInt(page),
      excludeIds: excludeIds,
    }

    const recommendations = await getSocialCollaborativeFilteringRecommendations(
      userId.toString(),
      options,
    )

    // 計算總數（用於分頁資訊）
    const totalCount = await Meme.countDocuments({
      status: 'public',
      ...(tagArray.length > 0 && { tags_cache: { $in: tagArray } }),
      ...(excludeIds.length > 0 && { _id: mongoose.trusted({ $nin: excludeIds }) }),
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
          page: parseInt(page),
          exclude_ids: excludeIds,
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
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip,
          total: totalCount,
          hasMore: skip + totalLimit < totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
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

    const stats = await getSocialCollaborativeFilteringStats(userId.toString())

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

    const cacheResults = await updateSocialCollaborativeFilteringCache([userId.toString()])

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

/**
 * 取得大家都在看的熱門內容（公開）
 * 基於整體社群行為的推薦，不需要登入
 */
export const getTrendingRecommendationsController = async (req, res) => {
  try {
    const {
      limit = 20,
      time_range = 'all',
      include_social_signals = 'true',
      tags,
      page = 1,
      exclude_ids,
    } = req.query

    // 解析標籤參數
    let tagArray = []
    if (tags) {
      tagArray = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())
    }

    // 解析排除ID參數 - 轉換為安全的 ObjectId 陣列
    let excludeObjectIds = []
    if (exclude_ids) {
      const rawIds = Array.isArray(exclude_ids)
        ? exclude_ids
        : exclude_ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id)

      console.log('開始處理排除ID:', rawIds)

      // 只保留有效的 ObjectId 字串並轉換為 ObjectId 物件
      excludeObjectIds = rawIds
        .filter((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id)
          } catch {
            console.warn(`無效的ObjectId格式: ${id}`)
            return false
          }
        })
        .map((id) => {
          try {
            return new mongoose.Types.ObjectId(id)
          } catch (err) {
            console.warn(`轉換ObjectId失敗: ${id}`, err)
            return null
          }
        })
        .filter((id) => id !== null)

      console.log('處理後的 excludeObjectIds:', excludeObjectIds)
    }

    // 計算時間範圍
    const now = new Date()
    let timeFilter = {}

    switch (time_range) {
      case '1h':
        timeFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 60 * 60 * 1000) }),
        }
        break
      case '6h':
        timeFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) }),
        }
        break
      case '7d':
        timeFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }),
        }
        break
      case '30d':
        timeFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }),
        }
        break
      case 'all':
        // 不加入時間限制，顯示所有內容
        timeFilter = {}
        break
      default: // 24h
        timeFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }),
        }
    }

    // 建立基礎查詢條件（不含排除ID）
    const baseQuery = {
      status: 'public',
      ...timeFilter,
    }

    // 添加標籤篩選
    if (tagArray.length > 0) {
      baseQuery.tags_cache = { $in: tagArray }
    }

    // 建立完整查詢條件（含排除ID）
    const query = { ...baseQuery }
    if (excludeObjectIds.length > 0) {
      query._id = mongoose.trusted({ $nin: excludeObjectIds })
    }

    // 計算分頁，扣除已排除的項目
    const totalLimit = parseInt(limit)
    const skipBase = (parseInt(page) - 1) * totalLimit
    const skip = Math.max(skipBase - excludeObjectIds.length, 0)

    // 添加調試資訊
    console.log('=== getTrendingRecommendationsController 調試資訊 ===')
    console.log('查詢條件:', JSON.stringify(query, null, 2))
    console.log('分頁參數 - page:', page, 'limit:', limit, 'skip:', skip, 'totalLimit:', totalLimit)
    console.log('排除ID數量:', excludeObjectIds.length)

    const memes = await Meme.find(query)
      .populate('author_id', 'username display_name avatar')
      .sort({ hot_score: -1, createdAt: -1 })
      .skip(skip)
      .limit(totalLimit)
      .lean()

    console.log('實際返回的迷因數量:', memes.length)

    // 如果啟用社交信號，計算社交分數
    let enhancedMemes = memes
    if (include_social_signals === 'true') {
      enhancedMemes = await Promise.all(
        memes.map(async (meme) => {
          try {
            // 確保 meme._id 存在且有效
            if (!meme._id) {
              console.warn('發現空的 meme ID，跳過社交信號計算')
              return {
                ...meme,
                social_metrics: {
                  likes: 0,
                  comments: 0,
                  shares: 0,
                  views: 0,
                  social_score: 0,
                },
              }
            }

            // 將 ID 轉換為 ObjectId（如果尚未是 ObjectId）
            let memeId
            if (mongoose.Types.ObjectId.isValid(meme._id)) {
              memeId =
                meme._id instanceof mongoose.Types.ObjectId
                  ? meme._id
                  : new mongoose.Types.ObjectId(meme._id)
            } else {
              console.warn(`無效的 meme ID: ${meme._id}，跳過社交信號計算`)
              return {
                ...meme,
                social_metrics: {
                  likes: 0,
                  comments: 0,
                  shares: 0,
                  views: 0,
                  social_score: 0,
                },
              }
            }

            // 計算社交互動數據
            const [likes, comments, shares, views] = await Promise.all([
              Like.countDocuments({ meme_id: memeId, status: 'normal' }),
              Comment.countDocuments({ meme_id: memeId, status: 'normal' }),
              Share.countDocuments({ meme_id: memeId }),
              View.countDocuments({ meme_id: memeId }),
            ])

            // 計算社交熱度分數
            const socialScore = (likes * 2 + comments * 3 + shares * 4 + views * 1) / 10

            return {
              ...meme,
              social_metrics: {
                likes,
                comments,
                shares,
                views,
                social_score: socialScore,
              },
            }
          } catch (error) {
            console.error(`計算 meme ${meme._id} 的社交信號時發生錯誤:`, error)
            // 返回默認的社交指標
            return {
              ...meme,
              social_metrics: {
                likes: 0,
                comments: 0,
                shares: 0,
                views: 0,
                social_score: 0,
              },
            }
          }
        }),
      )

      // 根據社交分數重新排序
      enhancedMemes.sort((a, b) => b.social_metrics.social_score - a.social_metrics.social_score)
    }

    // 計算總數（用於分頁資訊，不包含排除ID）
    const total = await Meme.countDocuments(baseQuery)

    // 計算分頁資訊
    const totalPages = Math.ceil(total / totalLimit)
    const hasMore = excludeObjectIds.length + skip + enhancedMemes.length < total

    res.json({
      success: true,
      data: {
        recommendations: enhancedMemes,
        filters: {
          time_range,
          limit: totalLimit,
          include_social_signals: include_social_signals === 'true',
          tags: tagArray,
          page: parseInt(page),
          exclude_ids: excludeObjectIds,
        },
        algorithm: 'trending',
        algorithm_details: {
          description: '基於整體社群行為的熱門內容推薦',
          time_range,
          include_social_signals: include_social_signals === 'true',
        },
        pagination: {
          page: parseInt(page),
          limit: totalLimit,
          skip,
          total,
          hasMore,
          totalPages,
        },
      },
      error: null,
    })
  } catch (error) {
    console.error('取得大家都在看的內容失敗:', error)
    console.error('錯誤堆疊:', error.stack)
    console.error('錯誤訊息:', error.message)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '取得推薦內容失敗',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
  getInfiniteScrollRecommendationsController,
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
  getTrendingRecommendationsController,
}
