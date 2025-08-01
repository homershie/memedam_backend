/**
 * 內容基礎推薦系統
 * 基於用戶標籤偏好和迷因標籤相似度的推薦演算法
 */

import Meme from '../models/Meme.js'
import Like from '../models/Like.js'
import Collection from '../models/Collection.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import View from '../models/View.js'

/**
 * 計算用戶的標籤偏好
 * @param {string} userId - 用戶ID
 * @param {Object} options - 配置選項
 * @returns {Object} 用戶標籤偏好權重
 */
export const calculateUserTagPreferences = async (userId, options = {}) => {
  const {
    interactionWeights = {
      like: 1.0,
      comment: 2.0,
      share: 3.0,
      collection: 1.5,
      view: 0.1,
    },
    timeDecay = true,
    decayFactor = 0.95,
    minInteractions = 3,
  } = options

  try {
    // 取得用戶的所有互動歷史
    const [likes, collections, comments, shares, views] = await Promise.all([
      Like.find({ user_id: userId }).populate('meme_id', 'tags_cache'),
      Collection.find({ user_id: userId }).populate('meme_id', 'tags_cache'),
      Comment.find({ user_id: userId }).populate('meme_id', 'tags_cache'),
      Share.find({ user_id: userId }).populate('meme_id', 'tags_cache'),
      View.find({ user_id: userId }).populate('meme_id', 'tags_cache'),
    ])

    // 合併所有互動
    const allInteractions = [
      ...likes.map((item) => ({ ...item.toObject(), type: 'like' })),
      ...collections.map((item) => ({ ...item.toObject(), type: 'collection' })),
      ...comments.map((item) => ({ ...item.toObject(), type: 'comment' })),
      ...shares.map((item) => ({ ...item.toObject(), type: 'share' })),
      ...views.map((item) => ({ ...item.toObject(), type: 'view' })),
    ]

    // 計算標籤偏好
    const tagPreferences = {}
    const tagInteractionCounts = {}

    for (const interaction of allInteractions) {
      if (!interaction.meme_id || !interaction.meme_id.tags_cache) continue

      const tags = interaction.meme_id.tags_cache
      const weight = interactionWeights[interaction.type] || 1.0
      let timeMultiplier = 1.0

      // 時間衰減
      if (timeDecay && interaction.createdAt) {
        const daysSince = (Date.now() - new Date(interaction.createdAt)) / (1000 * 60 * 60 * 24)
        timeMultiplier = Math.pow(decayFactor, daysSince)
      }

      for (const tag of tags) {
        if (!tagPreferences[tag]) {
          tagPreferences[tag] = 0
          tagInteractionCounts[tag] = 0
        }

        tagPreferences[tag] += weight * timeMultiplier
        tagInteractionCounts[tag] += 1
      }
    }

    // 過濾互動次數太少的標籤
    const filteredPreferences = {}
    for (const [tag, count] of Object.entries(tagInteractionCounts)) {
      if (count >= minInteractions) {
        filteredPreferences[tag] = tagPreferences[tag]
      }
    }

    // 標準化偏好分數
    const maxScore = Math.max(...Object.values(filteredPreferences), 1)
    const normalizedPreferences = {}
    for (const [tag, score] of Object.entries(filteredPreferences)) {
      normalizedPreferences[tag] = score / maxScore
    }

    return {
      preferences: normalizedPreferences,
      interactionCounts: tagInteractionCounts,
      totalInteractions: allInteractions.length,
      confidence:
        Object.keys(filteredPreferences).length / Math.max(Object.keys(tagPreferences).length, 1),
    }
  } catch (error) {
    console.error('計算用戶標籤偏好時發生錯誤:', error)
    return {
      preferences: {},
      interactionCounts: {},
      totalInteractions: 0,
      confidence: 0,
    }
  }
}

/**
 * 計算兩個迷因的標籤相似度
 * @param {Array} tags1 - 第一個迷因的標籤
 * @param {Array} tags2 - 第二個迷因的標籤
 * @param {Object} userPreferences - 用戶標籤偏好（可選）
 * @returns {number} 相似度分數 (0-1)
 */
export const calculateTagSimilarity = (tags1, tags2, userPreferences = null) => {
  if (!tags1 || !tags2 || tags1.length === 0 || tags2.length === 0) {
    return 0
  }

  // 計算標籤交集
  const intersection = tags1.filter((tag) => tags2.includes(tag))
  const union = [...new Set([...tags1, ...tags2])]

  // 基礎 Jaccard 相似度
  const jaccardSimilarity = intersection.length / union.length

  // 如果有用戶偏好，加入偏好加權
  if (userPreferences && Object.keys(userPreferences).length > 0) {
    let weightedScore = 0
    let totalWeight = 0

    for (const tag of intersection) {
      const preference = userPreferences[tag] || 0
      weightedScore += preference
      totalWeight += 1
    }

    // 結合 Jaccard 相似度和偏好加權
    const preferenceWeight = totalWeight > 0 ? weightedScore / totalWeight : 0
    return jaccardSimilarity * 0.6 + preferenceWeight * 0.4
  }

  return jaccardSimilarity
}

/**
 * 計算迷因與用戶偏好的匹配度
 * @param {Array} memeTags - 迷因標籤
 * @param {Object} userPreferences - 用戶標籤偏好
 * @returns {number} 匹配度分數 (0-1)
 */
export const calculatePreferenceMatch = (memeTags, userPreferences) => {
  if (
    !memeTags ||
    memeTags.length === 0 ||
    !userPreferences ||
    Object.keys(userPreferences).length === 0
  ) {
    return 0
  }

  let totalScore = 0
  let matchedTags = 0

  for (const tag of memeTags) {
    if (userPreferences[tag]) {
      totalScore += userPreferences[tag]
      matchedTags += 1
    }
  }

  // 考慮匹配標籤數量和偏好強度
  const matchRatio = matchedTags / memeTags.length
  const averagePreference = matchedTags > 0 ? totalScore / matchedTags : 0

  return matchRatio * 0.4 + averagePreference * 0.6
}

/**
 * 取得內容基礎推薦
 * @param {string} userId - 用戶ID
 * @param {Object} options - 配置選項
 * @returns {Array} 推薦的迷因列表
 */
export const getContentBasedRecommendations = async (userId, options = {}) => {
  const {
    limit = 20,
    minSimilarity = 0.1,
    excludeInteracted = true,
    includeHotScore = true,
    hotScoreWeight = 0.3,
    tags = [],
  } = options || {}

  try {
    // 計算用戶標籤偏好
    const userPreferences = await calculateUserTagPreferences(userId, {
      interactionWeights: {
        like: 1.0,
        comment: 2.0,
        share: 3.0,
        collection: 1.5,
        view: 0.1,
      },
      timeDecay: true,
      decayFactor: 0.95,
      minInteractions: 3,
    })

    // 如果用戶沒有足夠的互動歷史，返回熱門推薦
    if (userPreferences.confidence < 0.1) {
      console.log('用戶互動歷史不足，使用熱門推薦作為備選')
      const filter = { status: 'public' }

      // 如果有標籤篩選，加入標籤條件
      if (tags && tags.length > 0) {
        filter.tags_cache = { $in: tags }
      }

      const hotMemes = await Meme.find(filter)
        .sort({ hot_score: -1 })
        .limit(limit)
        .populate('author_id', 'username display_name avatar')

      return hotMemes.map((meme) => ({
        ...meme.toObject(),
        recommendation_score: meme.hot_score,
        recommendation_type: 'content_based_fallback',
        content_similarity: 0,
        preference_match: 0,
      }))
    }

    // 建立查詢條件
    const filter = { status: 'public' }

    // 如果有標籤篩選，加入標籤條件
    if (tags && tags.length > 0) {
      filter.tags_cache = { $in: tags }
    }

    // 取得所有公開的迷因
    const allMemes = await Meme.find(filter).populate('author_id', 'username display_name avatar')

    // 排除用戶已互動的迷因
    let candidateMemes = allMemes
    if (excludeInteracted) {
      const [likedMemes, collectedMemes, commentedMemes, sharedMemes] = await Promise.all([
        Like.find({ user_id: userId }).distinct('meme_id'),
        Collection.find({ user_id: userId }).distinct('meme_id'),
        Comment.find({ user_id: userId }).distinct('meme_id'),
        Share.find({ user_id: userId }).distinct('meme_id'),
      ])

      const interactedMemeIds = new Set([
        ...likedMemes,
        ...collectedMemes,
        ...commentedMemes,
        ...sharedMemes,
      ])

      candidateMemes = allMemes.filter((meme) => !interactedMemeIds.has(meme._id.toString()))
    }

    // 計算每個迷因的推薦分數
    const scoredMemes = candidateMemes.map((meme) => {
      const memeObj = meme.toObject()
      const memeTags = memeObj.tags_cache || []

      // 計算偏好匹配度
      const preferenceMatch = calculatePreferenceMatch(memeTags, userPreferences.preferences)

      // 計算內容相似度（與用戶最喜歡的標籤相比）
      const topTags = Object.keys(userPreferences.preferences)
        .sort((a, b) => userPreferences.preferences[b] - userPreferences.preferences[a])
        .slice(0, 5)

      let contentSimilarity = 0
      if (topTags.length > 0) {
        contentSimilarity = calculateTagSimilarity(memeTags, topTags, userPreferences.preferences)
      }

      // 計算最終推薦分數
      let finalScore = preferenceMatch * 0.6 + contentSimilarity * 0.4

      // 結合熱門分數
      if (includeHotScore && memeObj.hot_score > 0) {
        const normalizedHotScore = Math.min(memeObj.hot_score / 1000, 1) // 標準化熱門分數
        finalScore = finalScore * (1 - hotScoreWeight) + normalizedHotScore * hotScoreWeight
      }

      return {
        ...memeObj,
        recommendation_score: finalScore,
        recommendation_type: 'content_based',
        content_similarity: contentSimilarity,
        preference_match: preferenceMatch,
        matched_tags: memeTags.filter((tag) => userPreferences.preferences[tag]),
        user_preferences: userPreferences.preferences,
      }
    })

    // 過濾相似度過低的迷因並排序
    const filteredMemes = scoredMemes
      .filter((meme) => meme.recommendation_score >= minSimilarity)
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, limit)

    return filteredMemes
  } catch (error) {
    console.error('取得內容基礎推薦時發生錯誤:', error)
    return []
  }
}

/**
 * 取得標籤相關推薦
 * @param {Array} tags - 標籤列表
 * @param {Object} options - 配置選項
 * @returns {Array} 相關迷因列表
 */
export const getTagBasedRecommendations = async (tags, options = {}) => {
  const {
    limit = 20,
    minSimilarity = 0.1,
    includeHotScore = true,
    hotScoreWeight = 0.3,
  } = options || {}

  try {
    if (!tags || tags.length === 0) {
      return []
    }

    // 取得包含指定標籤的迷因
    const memes = await Meme.find({
      status: 'public',
      tags_cache: { $in: tags },
    }).populate('author_id', 'username display_name avatar')

    // 計算每個迷因的相關性分數
    const scoredMemes = memes.map((meme) => {
      const memeObj = meme.toObject()
      const memeTags = memeObj.tags_cache || []

      // 計算標籤重疊度
      const intersection = tags.filter((tag) => memeTags.includes(tag))
      const union = [...new Set([...tags, ...memeTags])]
      const tagSimilarity = intersection.length / union.length

      // 計算最終分數
      let finalScore = tagSimilarity

      // 結合熱門分數
      if (includeHotScore && memeObj.hot_score > 0) {
        const normalizedHotScore = Math.min(memeObj.hot_score / 1000, 1)
        finalScore = finalScore * (1 - hotScoreWeight) + normalizedHotScore * hotScoreWeight
      }

      return {
        ...memeObj,
        recommendation_score: finalScore,
        recommendation_type: 'tag_based',
        tag_similarity: tagSimilarity,
        matched_tags: intersection,
        query_tags: tags,
      }
    })

    // 過濾並排序
    return scoredMemes
      .filter((meme) => meme.recommendation_score >= minSimilarity)
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, limit)
  } catch (error) {
    console.error('取得標籤相關推薦時發生錯誤:', error)
    return []
  }
}

/**
 * 更新用戶偏好快取
 * @param {string} userId - 用戶ID
 * @returns {Object} 更新結果
 */
export const updateUserPreferencesCache = async (userId) => {
  try {
    const preferences = await calculateUserTagPreferences(userId)

    // 這裡可以將偏好存入 Redis 快取
    // 暫時返回計算結果
    return {
      success: true,
      userId,
      preferences: preferences.preferences,
      confidence: preferences.confidence,
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('更新用戶偏好快取時發生錯誤:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
