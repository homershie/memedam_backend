/**
 * 協同過濾推薦系統
 * 基於用戶行為相似性的推薦演算法
 * 包含社交協同過濾功能
 */

import Like from '../models/Like.js'
import Collection from '../models/Collection.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import View from '../models/View.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'

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
 * 社交影響力配置
 */
const SOCIAL_INFLUENCE_CONFIG = {
  followerWeight: 0.3, // 追隨者權重
  followingWeight: 0.2, // 追隨中權重
  mutualFollowWeight: 0.5, // 互追權重
  influenceDecayFactor: 0.9, // 影響力衰減因子
  maxInfluenceDepth: 3, // 最大影響深度
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
    tags = [],
  } = options || {}

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

    // 建立查詢條件
    const filter = {
      _id: { $in: recommendations.slice(0, limit).map((r) => r.memeId) },
      status: 'public',
    }

    // 如果有標籤篩選，加入標籤條件
    if (tags && tags.length > 0) {
      filter.tags_cache = { $in: tags }
    }

    // 取得迷因詳細資訊
    const memes = await Meme.find(filter).populate('author_id', 'username display_name avatar')

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
            '標籤篩選支援',
          ],
        },
      }
    })

    console.log(
      `協同過濾推薦生成完成，找到 ${similarUsers.length} 個相似用戶，推薦 ${finalRecommendations.length} 個迷因`,
    )

    return finalRecommendations
  } catch (error) {
    console.error('協同過濾推薦生成失敗:', error)
    return []
  }
}

/**
 * 建立社交關係圖譜
 * @param {Array} userIds - 用戶ID列表
 * @returns {Object} 社交關係圖譜 {userId: {followers: [], following: [], mutual: []}}
 */
export const buildSocialGraph = async (userIds = []) => {
  try {
    console.log('開始建立社交關係圖譜...')

    // 如果沒有提供用戶ID，取得所有活躍用戶
    let targetUserIds = userIds
    if (userIds.length === 0) {
      const activeUsers = await User.find({ status: 'active' }).select('_id').limit(1000)
      targetUserIds = activeUsers.map((user) => user._id)
    }

    // 取得所有追隨關係
    const follows = await Follow.find({
      $or: [{ follower_id: { $in: targetUserIds } }, { following_id: { $in: targetUserIds } }],
      status: 'active',
    }).select('follower_id following_id createdAt')

    // 建立社交圖譜
    const socialGraph = {}

    // 初始化用戶節點
    targetUserIds.forEach((userId) => {
      const userIdStr = userId.toString()
      socialGraph[userIdStr] = {
        followers: [],
        following: [],
        mutual: [],
        influence_score: 0,
        social_connections: 0,
      }
    })

    // 處理追隨關係
    follows.forEach((follow) => {
      const followerId = follow.follower_id.toString()
      const followingId = follow.following_id.toString()

      // 添加到追隨者列表
      if (socialGraph[followingId]) {
        socialGraph[followingId].followers.push({
          user_id: followerId,
          followed_at: follow.createdAt,
        })
      }

      // 添加到追隨中列表
      if (socialGraph[followerId]) {
        socialGraph[followerId].following.push({
          user_id: followingId,
          followed_at: follow.createdAt,
        })
      }
    })

    // 計算互追關係和社交影響力分數
    for (const [, userData] of Object.entries(socialGraph)) {
      const followers = new Set(userData.followers.map((f) => f.user_id))
      const following = new Set(userData.following.map((f) => f.user_id))

      // 找出互追關係
      for (const followerId of followers) {
        if (following.has(followerId)) {
          userData.mutual.push(followerId)
        }
      }

      // 計算社交影響力分數
      userData.influence_score = calculateSocialInfluenceScore(userData)
      userData.social_connections = userData.followers.length + userData.following.length
    }

    console.log(`社交關係圖譜建立完成，包含 ${Object.keys(socialGraph).length} 個用戶`)
    return socialGraph
  } catch (error) {
    console.error('建立社交關係圖譜時發生錯誤:', error)
    throw error
  }
}

/**
 * 計算社交影響力分數
 * @param {Object} userData - 用戶社交數據
 * @returns {number} 影響力分數
 */
const calculateSocialInfluenceScore = (userData) => {
  const followerCount = userData.followers.length
  const followingCount = userData.following.length
  const mutualCount = userData.mutual.length

  // 基礎影響力分數
  let influenceScore = 0

  // 追隨者影響力（被追隨表示有影響力）
  influenceScore += followerCount * SOCIAL_INFLUENCE_CONFIG.followerWeight

  // 追隨中影響力（主動追隨表示活躍）
  influenceScore += followingCount * SOCIAL_INFLUENCE_CONFIG.followingWeight

  // 互追影響力（互追關係表示強連接）
  influenceScore += mutualCount * SOCIAL_INFLUENCE_CONFIG.mutualFollowWeight

  // 應用衰減因子（避免分數過高）
  influenceScore = Math.log10(influenceScore + 1) * 10

  return Math.round(influenceScore * 100) / 100
}

/**
 * 計算社交相似度
 * @param {string} user1Id - 用戶1 ID
 * @param {string} user2Id - 用戶2 ID
 * @param {Object} socialGraph - 社交關係圖譜
 * @returns {number} 社交相似度分數 (0-1)
 */
export const calculateSocialSimilarity = (user1Id, user2Id, socialGraph) => {
  try {
    const user1Data = socialGraph[user1Id]
    const user2Data = socialGraph[user2Id]

    if (!user1Data || !user2Data) {
      return 0
    }

    // 計算共同追隨者
    const user1Followers = new Set(user1Data.followers.map((f) => f.user_id))
    const user2Followers = new Set(user2Data.followers.map((f) => f.user_id))
    const commonFollowers = new Set([...user1Followers].filter((id) => user2Followers.has(id)))

    // 計算共同追隨中
    const user1Following = new Set(user1Data.following.map((f) => f.user_id))
    const user2Following = new Set(user2Data.following.map((f) => f.user_id))
    const commonFollowing = new Set([...user1Following].filter((id) => user2Following.has(id)))

    // 計算互追關係
    const isUser1FollowingUser2 = user1Following.has(user2Id)
    const isUser2FollowingUser1 = user2Followers.has(user1Id)

    // 社交相似度計算
    let socialSimilarity = 0

    // 共同追隨者相似度
    if (user1Followers.size > 0 && user2Followers.size > 0) {
      const followerSimilarity =
        commonFollowers.size / Math.max(user1Followers.size, user2Followers.size)
      socialSimilarity += followerSimilarity * 0.3
    }

    // 共同追隨中相似度
    if (user1Following.size > 0 && user2Following.size > 0) {
      const followingSimilarity =
        commonFollowing.size / Math.max(user1Following.size, user2Following.size)
      socialSimilarity += followingSimilarity * 0.3
    }

    // 直接關係相似度
    if (isUser1FollowingUser2 && isUser2FollowingUser1) {
      socialSimilarity += 0.4 // 互追關係
    } else if (isUser1FollowingUser2 || isUser2FollowingUser1) {
      socialSimilarity += 0.2 // 單向追隨
    }

    return Math.min(socialSimilarity, 1)
  } catch (error) {
    console.error('計算社交相似度時發生錯誤:', error)
    return 0
  }
}

/**
 * 找到社交相似用戶
 * @param {string} targetUserId - 目標用戶ID
 * @param {Object} socialGraph - 社交關係圖譜
 * @param {number} minSimilarity - 最小相似度閾值
 * @param {number} maxUsers - 最大返回用戶數
 * @returns {Array} 社交相似用戶列表 [{userId, similarity, influence_score}]
 */
export const findSocialSimilarUsers = (
  targetUserId,
  socialGraph,
  minSimilarity = 0.1,
  maxUsers = 50,
) => {
  try {
    const similarities = []

    for (const [userId, userData] of Object.entries(socialGraph)) {
      if (userId === targetUserId) continue

      const similarity = calculateSocialSimilarity(targetUserId, userId, socialGraph)

      if (similarity >= minSimilarity) {
        similarities.push({
          userId,
          similarity,
          influence_score: userData.influence_score,
          social_connections: userData.social_connections,
        })
      }
    }

    // 按相似度和影響力排序並限制數量
    return similarities
      .sort((a, b) => {
        // 主要按相似度排序，次要按影響力排序
        if (Math.abs(a.similarity - b.similarity) < 0.01) {
          return b.influence_score - a.influence_score
        }
        return b.similarity - a.similarity
      })
      .slice(0, maxUsers)
  } catch (error) {
    console.error('尋找社交相似用戶時發生錯誤:', error)
    return []
  }
}

/**
 * 計算社交影響力加權的用戶相似度
 * @param {Object} user1Interactions - 用戶1的互動數據
 * @param {Object} user2Interactions - 用戶2的互動數據
 * @param {number} socialSimilarity - 社交相似度
 * @param {number} user2InfluenceScore - 用戶2的影響力分數
 * @returns {number} 加權相似度分數
 */
export const calculateSocialWeightedSimilarity = (
  user1Interactions,
  user2Interactions,
  socialSimilarity,
  user2InfluenceScore,
) => {
  try {
    // 基礎行為相似度
    const behaviorSimilarity = calculateUserSimilarity(user1Interactions, user2Interactions)

    // 社交影響力權重（影響力越高的用戶權重越大）
    const influenceWeight = Math.min(user2InfluenceScore / 100, 1)

    // 社交相似度權重
    const socialWeight = socialSimilarity

    // 綜合相似度計算
    const weightedSimilarity =
      behaviorSimilarity * 0.6 + // 行為相似度權重
      socialWeight * 0.3 + // 社交相似度權重
      influenceWeight * 0.1 // 影響力權重

    return Math.min(weightedSimilarity, 1)
  } catch (error) {
    console.error('計算社交加權相似度時發生錯誤:', error)
    return 0
  }
}

/**
 * 生成社交協同過濾推薦
 * @param {string} targetUserId - 目標用戶ID
 * @param {Object} options - 配置選項
 * @returns {Array} 推薦的迷因列表
 */
export const getSocialCollaborativeFilteringRecommendations = async (
  targetUserId,
  options = {},
) => {
  const {
    limit = 20,
    minSimilarity = 0.1,
    maxSimilarUsers = 50,
    excludeInteracted = true,
    includeHotScore = true,
    hotScoreWeight = 0.3,
    tags = [],
  } = options || {}

  try {
    console.log(`開始為用戶 ${targetUserId} 生成社交協同過濾推薦...`)

    // 建立互動矩陣和社交圖譜
    const [interactionMatrix, socialGraph] = await Promise.all([
      buildInteractionMatrix([targetUserId]),
      buildSocialGraph([targetUserId]),
    ])

    // 如果目標用戶沒有互動歷史，返回熱門推薦
    if (
      !interactionMatrix[targetUserId] ||
      Object.keys(interactionMatrix[targetUserId]).length === 0
    ) {
      console.log('用戶沒有互動歷史，使用熱門推薦作為備選')
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
        recommendation_type: 'social_collaborative_fallback',
        social_collaborative_score: 0,
        similar_users_count: 0,
        social_influence_score: 0,
      }))
    }

    // 找到社交相似用戶
    const socialSimilarUsers = findSocialSimilarUsers(
      targetUserId,
      socialGraph,
      minSimilarity,
      maxSimilarUsers,
    )

    if (socialSimilarUsers.length === 0) {
      console.log('沒有找到社交相似用戶，使用熱門推薦作為備選')
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
        recommendation_type: 'social_collaborative_fallback',
        social_collaborative_score: 0,
        similar_users_count: 0,
        social_influence_score: 0,
      }))
    }

    // 收集社交相似用戶互動過的迷因
    const candidateMemes = new Map()
    const targetUserInteractions = new Set(Object.keys(interactionMatrix[targetUserId]))

    for (const { userId, similarity, influence_score } of socialSimilarUsers) {
      const userInteractions = interactionMatrix[userId] || {}

      for (const [memeId, score] of Object.entries(userInteractions)) {
        // 排除目標用戶已互動的迷因
        if (excludeInteracted && targetUserInteractions.has(memeId)) {
          continue
        }

        if (!candidateMemes.has(memeId)) {
          candidateMemes.set(memeId, {
            totalScore: 0,
            totalSimilarity: 0,
            totalInfluenceScore: 0,
            similarUsers: [],
          })
        }

        const memeData = candidateMemes.get(memeId)
        const weightedScore = score * similarity * (1 + influence_score / 100)

        memeData.totalScore += weightedScore
        memeData.totalSimilarity += similarity
        memeData.totalInfluenceScore += influence_score
        memeData.similarUsers.push({ userId, similarity, influence_score, score })
      }
    }

    // 計算推薦分數並排序
    const recommendations = []
    for (const [memeId, data] of candidateMemes) {
      if (data.totalSimilarity > 0) {
        const socialCollaborativeScore = data.totalScore / data.totalSimilarity
        const averageInfluenceScore = data.totalInfluenceScore / data.similarUsers.length

        recommendations.push({
          memeId,
          socialCollaborativeScore,
          similarUsersCount: data.similarUsers.length,
          averageSimilarity: data.totalSimilarity / data.similarUsers.length,
          averageInfluenceScore,
        })
      }
    }

    // 按社交協同過濾分數排序
    recommendations.sort((a, b) => b.socialCollaborativeScore - a.socialCollaborativeScore)

    // 建立查詢條件
    const filter = {
      _id: { $in: recommendations.slice(0, limit).map((r) => r.memeId) },
      status: 'public',
    }

    // 如果有標籤篩選，加入標籤條件
    if (tags && tags.length > 0) {
      filter.tags_cache = { $in: tags }
    }

    // 取得迷因詳細資訊
    const memes = await Meme.find(filter).populate('author_id', 'username display_name avatar')

    // 建立迷因ID到推薦數據的映射
    const recommendationMap = new Map()
    recommendations.forEach((rec) => {
      recommendationMap.set(rec.memeId, rec)
    })

    // 組合最終推薦結果
    const finalRecommendations = memes.map((meme) => {
      const memeObj = meme.toObject()
      const recommendationData = recommendationMap.get(meme._id.toString())

      let finalScore = recommendationData.socialCollaborativeScore

      // 結合熱門分數
      if (includeHotScore && memeObj.hot_score > 0) {
        const normalizedHotScore = Math.min(memeObj.hot_score / 1000, 1)
        finalScore = finalScore * (1 - hotScoreWeight) + normalizedHotScore * hotScoreWeight
      }

      return {
        ...memeObj,
        recommendation_score: finalScore,
        recommendation_type: 'social_collaborative_filtering',
        social_collaborative_score: recommendationData.socialCollaborativeScore,
        similar_users_count: recommendationData.similarUsersCount,
        average_similarity: recommendationData.averageSimilarity,
        average_influence_score: recommendationData.averageInfluenceScore,
        algorithm_details: {
          description: '基於社交關係和用戶行為相似性的社交協同過濾推薦',
          features: [
            '分析用戶的社交關係圖譜（追隨者、追隨中、互追）',
            '計算社交影響力分數和社交相似度',
            '結合行為相似度和社交相似度進行推薦',
            '考慮社交影響力加權，影響力高的用戶推薦權重更大',
            '支援時間衰減，新互動權重更高',
            '標籤篩選支援',
          ],
        },
      }
    })

    console.log(
      `社交協同過濾推薦生成完成，找到 ${socialSimilarUsers.length} 個社交相似用戶，推薦 ${finalRecommendations.length} 個迷因`,
    )
    return finalRecommendations
  } catch (error) {
    console.error('生成社交協同過濾推薦時發生錯誤:', error)
    throw error
  }
}

/**
 * 取得用戶社交協同過濾統計
 * @param {string} userId - 用戶ID
 * @returns {Object} 統計資訊
 */
export const getSocialCollaborativeFilteringStats = async (userId) => {
  try {
    const [interactionMatrix, socialGraph] = await Promise.all([
      buildInteractionMatrix([userId]),
      buildSocialGraph([userId]),
    ])

    const userInteractions = interactionMatrix[userId] || {}
    const userSocialData = socialGraph[userId] || {}

    const socialSimilarUsers = findSocialSimilarUsers(userId, socialGraph, 0.1, 100)

    return {
      user_id: userId,
      interaction_count: Object.keys(userInteractions).length,
      social_connections: userSocialData.social_connections,
      followers_count: userSocialData.followers.length,
      following_count: userSocialData.following.length,
      mutual_follows_count: userSocialData.mutual.length,
      influence_score: userSocialData.influence_score,
      social_similar_users_count: socialSimilarUsers.length,
      average_social_similarity:
        socialSimilarUsers.length > 0
          ? socialSimilarUsers.reduce((sum, user) => sum + user.similarity, 0) /
            socialSimilarUsers.length
          : 0,
      top_social_similar_users: socialSimilarUsers.slice(0, 5).map((user) => ({
        user_id: user.userId,
        similarity: user.similarity,
        influence_score: user.influence_score,
        social_connections: user.social_connections,
      })),
      social_network_analysis: {
        total_connections: userSocialData.social_connections,
        influence_level: getInfluenceLevel(userSocialData.influence_score),
        social_activity: userSocialData.following.length > 0 ? 'active' : 'passive',
        network_density: calculateNetworkDensity(userSocialData),
      },
    }
  } catch (error) {
    console.error('取得社交協同過濾統計時發生錯誤:', error)
    throw error
  }
}

/**
 * 取得影響力等級
 * @param {number} influenceScore - 影響力分數
 * @returns {string} 影響力等級
 */
const getInfluenceLevel = (influenceScore) => {
  if (influenceScore >= 50) return 'high'
  if (influenceScore >= 20) return 'medium'
  if (influenceScore >= 5) return 'low'
  return 'minimal'
}

/**
 * 計算網絡密度
 * @param {Object} userSocialData - 用戶社交數據
 * @returns {number} 網絡密度 (0-1)
 */
const calculateNetworkDensity = (userSocialData) => {
  const totalConnections = userSocialData.followers.length + userSocialData.following.length
  const mutualConnections = userSocialData.mutual.length

  if (totalConnections === 0) return 0

  // 網絡密度 = 互追關係 / 總連接數
  return Math.round((mutualConnections / totalConnections) * 100) / 100
}

/**
 * 更新協同過濾快取
 * @param {Array} userIds - 用戶ID列表（可選）
 * @returns {Object} 更新結果
 */
export const updateCollaborativeFilteringCache = async (userIds = []) => {
  try {
    console.log('開始更新協同過濾快取...')

    const startTime = Date.now()

    // 建立互動矩陣
    const interactionMatrix = await buildInteractionMatrix(userIds)

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

/**
 * 更新社交協同過濾快取
 * @param {Array} userIds - 用戶ID列表（可選）
 * @returns {Object} 更新結果
 */
export const updateSocialCollaborativeFilteringCache = async (userIds = []) => {
  try {
    console.log('開始更新社交協同過濾快取...')

    const startTime = Date.now()

    // 建立互動矩陣和社交圖譜
    const [interactionMatrix, socialGraph] = await Promise.all([
      buildInteractionMatrix(userIds),
      buildSocialGraph(userIds),
    ])

    const cacheResults = {
      total_users: Object.keys(interactionMatrix).length,
      total_interactions: Object.values(interactionMatrix).reduce(
        (sum, interactions) => sum + Object.keys(interactions).length,
        0,
      ),
      total_social_connections: Object.values(socialGraph).reduce(
        (sum, userData) => sum + userData.social_connections,
        0,
      ),
      average_influence_score:
        Object.values(socialGraph).reduce((sum, userData) => sum + userData.influence_score, 0) /
        Object.keys(socialGraph).length,
      processing_time: Date.now() - startTime,
    }

    console.log(`社交協同過濾快取更新完成，處理時間: ${cacheResults.processing_time}ms`)
    return cacheResults
  } catch (error) {
    console.error('更新社交協同過濾快取時發生錯誤:', error)
    throw error
  }
}
