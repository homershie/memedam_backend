/**
 * 協同過濾推薦系統
 * 基於用戶行為相似性的推薦演算法
 */

import Like from '../models/Like.js'
import Collection from '../models/Collection.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import View from '../models/View.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'

/**
 * 互動權重配置
 */
const INTERACTION_WEIGHTS = {
  like: 1.0, // 按讚權重
  dislike: -0.5, // 按噓權重（負面）
  comment: 2.0, // 留言權重（互動性更高）
  share: 3.0, // 分享權重（傳播性最強）
  collection: 1.5, // 收藏權重
  view: 0.1, // 瀏覽權重
}

/**
 * 時間衰減配置
 */
const TIME_DECAY_CONFIG = {
  decayFactor: 0.95, // 衰減因子
  maxDays: 365, // 最大考慮天數
}

/**
 * 建立用戶-迷因互動矩陣
 * @param {Array} userIds - 用戶ID列表
 * @param {Array} memeIds - 迷因ID列表
 * @returns {Object} 互動矩陣 {userId: {memeId: score}}
 */
export const buildInteractionMatrix = async (userIds = [], memeIds = []) => {
  try {
    console.log('開始建立用戶-迷因互動矩陣...')

    // 如果沒有提供用戶ID，取得所有活躍用戶
    let targetUserIds = userIds
    if (userIds.length === 0) {
      const activeUsers = await User.find({ status: 'active' }).select('_id').limit(1000) // 限制用戶數量避免效能問題
      targetUserIds = activeUsers.map((user) => user._id)
    }

    // 如果沒有提供迷因ID，取得所有公開迷因
    let targetMemeIds = memeIds
    if (memeIds.length === 0) {
      const publicMemes = await Meme.find({ status: 'public' }).select('_id').limit(5000) // 限制迷因數量避免效能問題
      targetMemeIds = publicMemes.map((meme) => meme._id)
    }

    console.log(`處理 ${targetUserIds.length} 個用戶和 ${targetMemeIds.length} 個迷因`)

    // 取得所有互動數據
    const [likes, collections, comments, shares, views] = await Promise.all([
      Like.find({
        user_id: { $in: targetUserIds },
        meme_id: { $in: targetMemeIds },
      }).select('user_id meme_id createdAt'),
      Collection.find({
        user_id: { $in: targetUserIds },
        meme_id: { $in: targetMemeIds },
      }).select('user_id meme_id createdAt'),
      Comment.find({
        user_id: { $in: targetUserIds },
        meme_id: { $in: targetMemeIds },
        status: 'normal',
      }).select('user_id meme_id createdAt'),
      Share.find({
        user_id: { $in: targetUserIds },
        meme_id: { $in: targetMemeIds },
      }).select('user_id meme_id createdAt'),
      View.find({
        user_id: { $in: targetUserIds },
        meme_id: { $in: targetMemeIds },
      }).select('user_id meme_id createdAt'),
    ])

    // 初始化互動矩陣
    const interactionMatrix = {}

    // 處理按讚數據
    likes.forEach((like) => {
      const userId = like.user_id.toString()
      const memeId = like.meme_id.toString()
      const timeDecay = calculateTimeDecay(like.createdAt)

      if (!interactionMatrix[userId]) {
        interactionMatrix[userId] = {}
      }

      interactionMatrix[userId][memeId] =
        (interactionMatrix[userId][memeId] || 0) + INTERACTION_WEIGHTS.like * timeDecay
    })

    // 處理收藏數據
    collections.forEach((collection) => {
      const userId = collection.user_id.toString()
      const memeId = collection.meme_id.toString()
      const timeDecay = calculateTimeDecay(collection.createdAt)

      if (!interactionMatrix[userId]) {
        interactionMatrix[userId] = {}
      }

      interactionMatrix[userId][memeId] =
        (interactionMatrix[userId][memeId] || 0) + INTERACTION_WEIGHTS.collection * timeDecay
    })

    // 處理留言數據
    comments.forEach((comment) => {
      const userId = comment.user_id.toString()
      const memeId = comment.meme_id.toString()
      const timeDecay = calculateTimeDecay(comment.createdAt)

      if (!interactionMatrix[userId]) {
        interactionMatrix[userId] = {}
      }

      interactionMatrix[userId][memeId] =
        (interactionMatrix[userId][memeId] || 0) + INTERACTION_WEIGHTS.comment * timeDecay
    })

    // 處理分享數據
    shares.forEach((share) => {
      const userId = share.user_id.toString()
      const memeId = share.meme_id.toString()
      const timeDecay = calculateTimeDecay(share.createdAt)

      if (!interactionMatrix[userId]) {
        interactionMatrix[userId] = {}
      }

      interactionMatrix[userId][memeId] =
        (interactionMatrix[userId][memeId] || 0) + INTERACTION_WEIGHTS.share * timeDecay
    })

    // 處理瀏覽數據
    views.forEach((view) => {
      const userId = view.user_id.toString()
      const memeId = view.meme_id.toString()
      const timeDecay = calculateTimeDecay(view.createdAt)

      if (!interactionMatrix[userId]) {
        interactionMatrix[userId] = {}
      }

      interactionMatrix[userId][memeId] =
        (interactionMatrix[userId][memeId] || 0) + INTERACTION_WEIGHTS.view * timeDecay
    })

    console.log(`互動矩陣建立完成，包含 ${Object.keys(interactionMatrix).length} 個用戶`)
    return interactionMatrix
  } catch (error) {
    console.error('建立互動矩陣時發生錯誤:', error)
    throw error
  }
}

/**
 * 計算時間衰減因子
 * @param {Date} interactionDate - 互動時間
 * @returns {number} 衰減因子 (0-1)
 */
const calculateTimeDecay = (interactionDate) => {
  const now = new Date()
  const daysDiff = (now - interactionDate) / (1000 * 60 * 60 * 24)

  if (daysDiff <= 0) return 1.0
  if (daysDiff >= TIME_DECAY_CONFIG.maxDays) return 0.1

  return Math.pow(TIME_DECAY_CONFIG.decayFactor, daysDiff)
}

/**
 * 計算用戶相似度
 * @param {Object} user1Interactions - 用戶1的互動數據
 * @param {Object} user2Interactions - 用戶2的互動數據
 * @returns {number} 相似度分數 (0-1)
 */
export const calculateUserSimilarity = (user1Interactions, user2Interactions) => {
  try {
    // 取得兩個用戶都互動過的迷因
    const user1MemeIds = new Set(Object.keys(user1Interactions))
    const user2MemeIds = new Set(Object.keys(user2Interactions))
    const commonMemeIds = new Set([...user1MemeIds].filter((id) => user2MemeIds.has(id)))

    if (commonMemeIds.size === 0) {
      return 0 // 沒有共同互動的迷因
    }

    // 計算皮爾遜相關係數
    let sum1 = 0,
      sum2 = 0,
      sum1Sq = 0,
      sum2Sq = 0,
      pSum = 0
    let n = 0

    for (const memeId of commonMemeIds) {
      const score1 = user1Interactions[memeId] || 0
      const score2 = user2Interactions[memeId] || 0

      sum1 += score1
      sum2 += score2
      sum1Sq += score1 * score1
      sum2Sq += score2 * score2
      pSum += score1 * score2
      n++
    }

    if (n === 0) return 0

    const num = pSum - (sum1 * sum2) / n
    const den = Math.sqrt((sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n))

    if (den === 0) return 0

    return Math.max(0, num / den) // 確保相似度不為負數
  } catch (error) {
    console.error('計算用戶相似度時發生錯誤:', error)
    return 0
  }
}

/**
 * 找到相似用戶
 * @param {string} targetUserId - 目標用戶ID
 * @param {Object} interactionMatrix - 互動矩陣
 * @param {number} minSimilarity - 最小相似度閾值
 * @param {number} maxUsers - 最大返回用戶數
 * @returns {Array} 相似用戶列表 [{userId, similarity}]
 */
export const findSimilarUsers = (
  targetUserId,
  interactionMatrix,
  minSimilarity = 0.1,
  maxUsers = 50,
) => {
  try {
    const targetUserInteractions = interactionMatrix[targetUserId]
    if (!targetUserInteractions) {
      return []
    }

    const similarities = []

    for (const [userId, userInteractions] of Object.entries(interactionMatrix)) {
      if (userId === targetUserId) continue

      const similarity = calculateUserSimilarity(targetUserInteractions, userInteractions)

      if (similarity >= minSimilarity) {
        similarities.push({
          userId,
          similarity,
          interactionCount: Object.keys(userInteractions).length,
        })
      }
    }

    // 按相似度排序並限制數量
    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, maxUsers)
  } catch (error) {
    console.error('尋找相似用戶時發生錯誤:', error)
    return []
  }
}

/**
 * 生成協同過濾推薦
 * @param {string} targetUserId - 目標用戶ID
 * @param {Object} options - 配置選項
 * @returns {Array} 推薦的迷因列表
 */
export const getCollaborativeFilteringRecommendations = async (targetUserId, options = {}) => {
  const {
    limit = 20,
    minSimilarity = 0.1,
    maxSimilarUsers = 50,
    excludeInteracted = true,
    includeHotScore = true,
    hotScoreWeight = 0.3,
  } = options

  try {
    console.log(`開始為用戶 ${targetUserId} 生成協同過濾推薦...`)

    // 建立互動矩陣
    const interactionMatrix = await buildInteractionMatrix([targetUserId])

    // 如果目標用戶沒有互動歷史，返回熱門推薦
    if (
      !interactionMatrix[targetUserId] ||
      Object.keys(interactionMatrix[targetUserId]).length === 0
    ) {
      console.log('用戶沒有互動歷史，使用熱門推薦作為備選')
      const hotMemes = await Meme.find({ status: 'public' })
        .sort({ hot_score: -1 })
        .limit(limit)
        .populate('author_id', 'username display_name avatar')

      return hotMemes.map((meme) => ({
        ...meme.toObject(),
        recommendation_score: meme.hot_score,
        recommendation_type: 'collaborative_fallback',
        collaborative_score: 0,
        similar_users_count: 0,
      }))
    }

    // 找到相似用戶
    const similarUsers = findSimilarUsers(
      targetUserId,
      interactionMatrix,
      minSimilarity,
      maxSimilarUsers,
    )

    if (similarUsers.length === 0) {
      console.log('沒有找到相似用戶，使用熱門推薦作為備選')
      const hotMemes = await Meme.find({ status: 'public' })
        .sort({ hot_score: -1 })
        .limit(limit)
        .populate('author_id', 'username display_name avatar')

      return hotMemes.map((meme) => ({
        ...meme.toObject(),
        recommendation_score: meme.hot_score,
        recommendation_type: 'collaborative_fallback',
        collaborative_score: 0,
        similar_users_count: 0,
      }))
    }

    // 收集相似用戶互動過的迷因
    const candidateMemes = new Map()
    const targetUserInteractions = new Set(Object.keys(interactionMatrix[targetUserId]))

    for (const { userId, similarity } of similarUsers) {
      const userInteractions = interactionMatrix[userId]

      for (const [memeId, score] of Object.entries(userInteractions)) {
        // 排除目標用戶已互動的迷因
        if (excludeInteracted && targetUserInteractions.has(memeId)) {
          continue
        }

        if (!candidateMemes.has(memeId)) {
          candidateMemes.set(memeId, {
            totalScore: 0,
            totalSimilarity: 0,
            similarUsers: [],
          })
        }

        const memeData = candidateMemes.get(memeId)
        memeData.totalScore += score * similarity
        memeData.totalSimilarity += similarity
        memeData.similarUsers.push({ userId, similarity, score })
      }
    }

    // 計算推薦分數並排序
    const recommendations = []
    for (const [memeId, data] of candidateMemes) {
      if (data.totalSimilarity > 0) {
        const collaborativeScore = data.totalScore / data.totalSimilarity

        recommendations.push({
          memeId,
          collaborativeScore,
          similarUsersCount: data.similarUsers.length,
          averageSimilarity: data.totalSimilarity / data.similarUsers.length,
        })
      }
    }

    // 按協同過濾分數排序
    recommendations.sort((a, b) => b.collaborativeScore - a.collaborativeScore)

    // 取得迷因詳細資訊
    const memeIds = recommendations.slice(0, limit).map((r) => r.memeId)
    const memes = await Meme.find({
      _id: { $in: memeIds },
      status: 'public',
    }).populate('author_id', 'username display_name avatar')

    // 建立迷因ID到推薦數據的映射
    const recommendationMap = new Map()
    recommendations.forEach((rec) => {
      recommendationMap.set(rec.memeId, rec)
    })

    // 組合最終推薦結果
    const finalRecommendations = memes.map((meme) => {
      const memeObj = meme.toObject()
      const recommendationData = recommendationMap.get(meme._id.toString())

      let finalScore = recommendationData.collaborativeScore

      // 結合熱門分數
      if (includeHotScore && memeObj.hot_score > 0) {
        const normalizedHotScore = Math.min(memeObj.hot_score / 1000, 1)
        finalScore = finalScore * (1 - hotScoreWeight) + normalizedHotScore * hotScoreWeight
      }

      return {
        ...memeObj,
        recommendation_score: finalScore,
        recommendation_type: 'collaborative_filtering',
        collaborative_score: recommendationData.collaborativeScore,
        similar_users_count: recommendationData.similarUsersCount,
        average_similarity: recommendationData.averageSimilarity,
        algorithm_details: {
          description: '基於用戶行為相似性的協同過濾推薦',
          features: [
            '分析用戶的按讚、留言、分享、收藏、瀏覽歷史',
            '計算用戶間的相似度',
            '推薦相似用戶喜歡但當前用戶未互動的內容',
            '結合熱門分數提升推薦品質',
            '支援時間衰減，新互動權重更高',
          ],
        },
      }
    })

    console.log(
      `協同過濾推薦生成完成，找到 ${similarUsers.length} 個相似用戶，推薦 ${finalRecommendations.length} 個迷因`,
    )
    return finalRecommendations
  } catch (error) {
    console.error('生成協同過濾推薦時發生錯誤:', error)
    throw error
  }
}

/**
 * 取得用戶協同過濾統計
 * @param {string} userId - 用戶ID
 * @returns {Object} 統計資訊
 */
export const getCollaborativeFilteringStats = async (userId) => {
  try {
    const interactionMatrix = await buildInteractionMatrix([userId])
    const userInteractions = interactionMatrix[userId] || {}

    const similarUsers = findSimilarUsers(userId, interactionMatrix, 0.1, 100)

    return {
      user_id: userId,
      interaction_count: Object.keys(userInteractions).length,
      similar_users_count: similarUsers.length,
      average_similarity:
        similarUsers.length > 0
          ? similarUsers.reduce((sum, user) => sum + user.similarity, 0) / similarUsers.length
          : 0,
      top_similar_users: similarUsers.slice(0, 5).map((user) => ({
        user_id: user.userId,
        similarity: user.similarity,
        interaction_count: user.interactionCount,
      })),
      interaction_distribution: {
        total_interactions: Object.values(userInteractions).reduce(
          (sum, score) => sum + Math.abs(score),
          0,
        ),
        positive_interactions: Object.values(userInteractions).filter((score) => score > 0).length,
        negative_interactions: Object.values(userInteractions).filter((score) => score < 0).length,
      },
    }
  } catch (error) {
    console.error('取得協同過濾統計時發生錯誤:', error)
    throw error
  }
}

/**
 * 批次更新協同過濾快取
 * @param {Array} userIds - 用戶ID列表（可選）
 * @returns {Object} 更新結果
 */
export const updateCollaborativeFilteringCache = async (userIds = []) => {
  try {
    console.log('開始更新協同過濾快取...')

    const startTime = Date.now()

    // 建立互動矩陣
    const interactionMatrix = await buildInteractionMatrix(userIds)

    // 計算所有用戶的相似度（這裡可以實作更複雜的快取策略）
    const cacheResults = {
      total_users: Object.keys(interactionMatrix).length,
      total_interactions: Object.values(interactionMatrix).reduce(
        (sum, interactions) => sum + Object.keys(interactions).length,
        0,
      ),
      processing_time: Date.now() - startTime,
    }

    console.log(`協同過濾快取更新完成，處理時間: ${cacheResults.processing_time}ms`)
    return cacheResults
  } catch (error) {
    console.error('更新協同過濾快取時發生錯誤:', error)
    throw error
  }
}
