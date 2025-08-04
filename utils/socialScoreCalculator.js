/**
 * 社交層分數計算器
 * 實作詳細的社交分數配置、社交距離計算、社交影響力傳播效果和推薦原因生成
 */

import mongoose from 'mongoose'
import Follow from '../models/Follow.js'
import Like from '../models/Like.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import Collection from '../models/Collection.js'
import View from '../models/View.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'

/**
 * 社交分數配置
 */
const SOCIAL_SCORE_CONFIG = {
  // 社交互動分數配置
  interactions: {
    publish: 5, // 被你追蹤的人發佈
    like: 3, // 被你追蹤的人按讚
    comment: 3, // 被你追蹤的人留言
    share: 4, // 被你追蹤的人分享
    collect: 2, // 被你追蹤的人收藏
    view: 1, // 被你追蹤的人瀏覽
  },

  // 社交距離權重配置
  distanceWeights: {
    directFollow: 1.0, // 直接關注
    mutualFollow: 1.5, // 互相關注
    secondDegree: 0.6, // 二度關係
    thirdDegree: 0.3, // 三度關係
  },

  // 社交影響力配置
  influenceConfig: {
    followerWeight: 0.3, // 追隨者權重
    followingWeight: 0.2, // 追隨中權重
    mutualFollowWeight: 0.5, // 互追權重
    influenceDecayFactor: 0.9, // 影響力衰減因子
    maxInfluenceDepth: 3, // 最大影響深度
  },

  // 分數上限配置
  scoreLimits: {
    maxSocialScore: 20, // 單一迷因最大社交分數
    maxInfluenceScore: 100, // 最大影響力分數
    maxDistanceScore: 10, // 最大距離分數
  },

  // 推薦原因配置
  reasonConfig: {
    maxReasons: 3, // 最多顯示的推薦原因數量
    minScoreForReason: 2, // 最小分數才顯示原因
    reasonTemplates: {
      publish: '你的好友 {username} 發佈了這則迷因',
      like: '你的好友 {username} 按讚了這則迷因',
      comment: '你的好友 {username} 留言了這則迷因',
      share: '你的好友 {username} 分享了這則迷因',
      collect: '你的好友 {username} 收藏了這則迷因',
      view: '你的好友 {username} 瀏覽了這則迷因',
    },
  },
}

/**
 * 計算社交距離
 * @param {string} userId - 目標用戶ID
 * @param {string} targetUserId - 目標用戶ID
 * @param {Object} socialGraph - 社交圖譜
 * @returns {Object} 社交距離資訊
 */
export const calculateSocialDistance = async (userId, targetUserId, socialGraph = null) => {
  try {
    if (!socialGraph) {
      socialGraph = await buildSocialGraph([userId, targetUserId])
    }

    const userSocialData = socialGraph[userId]
    const targetSocialData = socialGraph[targetUserId]

    if (!userSocialData || !targetSocialData) {
      return { distance: Infinity, type: 'unknown', weight: 0 }
    }

    // 檢查直接關注關係
    if (userSocialData.following.includes(targetUserId)) {
      const isMutual = targetSocialData.following.includes(userId)
      return {
        distance: 1,
        type: isMutual ? 'mutual_follow' : 'direct_follow',
        weight: SOCIAL_SCORE_CONFIG.distanceWeights[isMutual ? 'mutualFollow' : 'directFollow'],
      }
    }

    // 檢查二度關係
    const secondDegreeUsers = new Set()
    for (const followingId of userSocialData.following) {
      const followingSocialData = socialGraph[followingId]
      if (followingSocialData) {
        followingSocialData.following.forEach((id) => secondDegreeUsers.add(id))
      }
    }

    if (secondDegreeUsers.has(targetUserId)) {
      return {
        distance: 2,
        type: 'second_degree',
        weight: SOCIAL_SCORE_CONFIG.distanceWeights.secondDegree,
      }
    }

    // 檢查三度關係
    const thirdDegreeUsers = new Set()
    for (const secondDegreeId of secondDegreeUsers) {
      const secondDegreeSocialData = socialGraph[secondDegreeId]
      if (secondDegreeSocialData) {
        secondDegreeSocialData.following.forEach((id) => thirdDegreeUsers.add(id))
      }
    }

    if (thirdDegreeUsers.has(targetUserId)) {
      return {
        distance: 3,
        type: 'third_degree',
        weight: SOCIAL_SCORE_CONFIG.distanceWeights.thirdDegree,
      }
    }

    return { distance: Infinity, type: 'unknown', weight: 0 }
  } catch (error) {
    console.error('計算社交距離時發生錯誤:', error)
    return { distance: Infinity, type: 'unknown', weight: 0 }
  }
}

/**
 * 建立社交圖譜
 * @param {Array} userIds - 用戶ID列表
 * @returns {Object} 社交圖譜
 */
export const buildSocialGraph = async (userIds = []) => {
  try {
    console.log('開始建立社交圖譜...')

    // 如果沒有提供用戶ID，取得所有活躍用戶
    let targetUserIds = userIds
    if (userIds.length === 0) {
      const activeUsers = await User.find({ status: 'active' }).select('_id').limit(1000)
      targetUserIds = activeUsers.map((user) => user._id)
    } else {
      // 確保所有用戶ID都是ObjectId格式
      targetUserIds = userIds
        .map((id) => {
          if (id instanceof mongoose.Types.ObjectId) return id
          if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
            return new mongoose.Types.ObjectId(id)
          }
          console.warn(`無效的用戶ID格式: ${id}`)
          return null
        })
        .filter(Boolean) // 過濾掉無效的ID
    }

    // 確保 targetUserIds 是純 ObjectId 數組
    targetUserIds = targetUserIds
      .map((id) => {
        if (id instanceof mongoose.Types.ObjectId) {
          return id
        }
        if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
          return new mongoose.Types.ObjectId(id)
        }
        console.warn(`無效的用戶ID格式: ${id}`)
        return null
      })
      .filter(Boolean) // 過濾掉無效的ID

    // 如果沒有有效的用戶ID，返回空的社交圖譜
    if (targetUserIds.length === 0) {
      console.log('沒有有效的用戶ID，返回空的社交圖譜')
      return {}
    }

    // 取得所有關注關係
    // 確保使用純 ObjectId 進行查詢，避免 CastError
    const follows = await Follow.find({
      $or: [{ follower_id: { $in: targetUserIds } }, { following_id: { $in: targetUserIds } }],
    })
      .setOptions({ sanitizeFilter: false })
      .select('follower_id following_id createdAt')

    // 建立社交圖譜
    const socialGraph = {}

    for (const follow of follows) {
      const followerId = follow.follower_id.toString()
      const followingId = follow.following_id.toString()

      // 初始化用戶社交數據
      if (!socialGraph[followerId]) {
        socialGraph[followerId] = {
          followers: [],
          following: [],
          mutualFollows: [],
        }
      }
      if (!socialGraph[followingId]) {
        socialGraph[followingId] = {
          followers: [],
          following: [],
          mutualFollows: [],
        }
      }

      // 添加關注關係
      if (!socialGraph[followerId].following.includes(followingId)) {
        socialGraph[followerId].following.push(followingId)
      }
      if (!socialGraph[followingId].followers.includes(followerId)) {
        socialGraph[followingId].followers.push(followerId)
      }
    }

    // 計算互相關注關係
    for (const userId in socialGraph) {
      for (const followingId of socialGraph[userId].following) {
        if (socialGraph[followingId] && socialGraph[followingId].following.includes(userId)) {
          if (!socialGraph[userId].mutualFollows.includes(followingId)) {
            socialGraph[userId].mutualFollows.push(followingId)
          }
        }
      }
    }

    console.log(`社交圖譜建立完成，包含 ${Object.keys(socialGraph).length} 個用戶`)
    return socialGraph
  } catch (error) {
    console.error('建立社交圖譜時發生錯誤:', error)
    return {}
  }
}

/**
 * 計算社交影響力分數
 * @param {Object} userSocialData - 用戶社交數據
 * @returns {Object} 影響力分數和等級
 */
export const calculateSocialInfluenceScore = (userSocialData) => {
  try {
    if (!userSocialData) {
      return { score: 0, level: 'none', followers: 0, following: 0, mutualFollows: 0 }
    }

    const { followers, following, mutualFollows } = userSocialData
    const followersCount = followers.length
    const followingCount = following.length
    const mutualFollowsCount = mutualFollows.length

    // 計算影響力分數
    const influenceScore =
      followersCount * SOCIAL_SCORE_CONFIG.influenceConfig.followerWeight +
      followingCount * SOCIAL_SCORE_CONFIG.influenceConfig.followingWeight +
      mutualFollowsCount * SOCIAL_SCORE_CONFIG.influenceConfig.mutualFollowWeight

    // 限制最大分數
    const cappedInfluenceScore = Math.min(
      influenceScore,
      SOCIAL_SCORE_CONFIG.scoreLimits.maxInfluenceScore,
    )

    // 確定影響力等級
    let level = 'none'
    if (cappedInfluenceScore >= 50) level = 'influencer'
    else if (cappedInfluenceScore >= 20) level = 'popular'
    else if (cappedInfluenceScore >= 10) level = 'active'
    else if (cappedInfluenceScore >= 5) level = 'moderate'
    else if (cappedInfluenceScore >= 1) level = 'low'
    else level = 'none'

    return {
      score: cappedInfluenceScore,
      level,
      followers: followersCount,
      following: followingCount,
      mutualFollows: mutualFollowsCount,
    }
  } catch (error) {
    console.error('計算社交影響力分數時發生錯誤:', error)
    return { score: 0, level: 'none', followers: 0, following: 0, mutualFollows: 0 }
  }
}

/**
 * 計算迷因的社交層分數
 * @param {string} userId - 目標用戶ID
 * @param {string} memeId - 迷因ID
 * @param {Object} options - 配置選項
 * @returns {Object} 社交層分數和詳細資訊
 */
export const calculateMemeSocialScore = async (userId, memeId, options = {}) => {
  try {
    const {
      includeDistance = true,
      includeInfluence = true,
      includeInteractions = true,
      maxDistance = 3,
    } = options || {}

    console.log(`開始計算迷因 ${memeId} 對用戶 ${userId} 的社交層分數...`)

    // 建立社交圖譜
    const socialGraph = await buildSocialGraph([userId])
    const userSocialData = socialGraph[userId]

    if (!userSocialData) {
      return {
        socialScore: 0,
        distanceScore: 0,
        influenceScore: 0,
        interactionScore: 0,
        reasons: [],
        socialInteractions: [],
      }
    }

    let totalSocialScore = 0
    let distanceScore = 0
    let influenceScore = 0
    let interactionScore = 0
    const reasons = []
    const socialInteractions = []

    // 取得迷因的所有互動
    const [likes, comments, shares, collections, views] = await Promise.all([
      Like.find({ meme_id: memeId }).populate('user_id', 'username display_name'),
      Comment.find({ meme_id: memeId, status: 'normal' }).populate(
        'user_id',
        'username display_name',
      ),
      Share.find({ meme_id: memeId }).populate('user_id', 'username display_name'),
      Collection.find({ meme_id: memeId }).populate('user_id', 'username display_name'),
      View.find({ meme_id: memeId }).populate('user_id', 'username display_name'),
    ])

    // 取得迷因作者
    const meme = await Meme.findById(memeId).populate('author_id', 'username display_name')
    const authorId = meme?.author_id?._id?.toString()

    // 處理所有互動用戶
    const allInteractingUsers = new Map()

    // 添加作者
    if (authorId && authorId !== userId) {
      allInteractingUsers.set(authorId, {
        type: 'publish',
        user: meme.author_id,
        weight: SOCIAL_SCORE_CONFIG.interactions.publish,
      })
    }

    // 添加按讚用戶
    likes.forEach((like) => {
      const likeUserId = like.user_id._id.toString()
      if (likeUserId !== userId) {
        allInteractingUsers.set(likeUserId, {
          type: 'like',
          user: like.user_id,
          weight: SOCIAL_SCORE_CONFIG.interactions.like,
        })
      }
    })

    // 添加留言用戶
    comments.forEach((comment) => {
      const commentUserId = comment.user_id._id.toString()
      if (commentUserId !== userId) {
        allInteractingUsers.set(commentUserId, {
          type: 'comment',
          user: comment.user_id,
          weight: SOCIAL_SCORE_CONFIG.interactions.comment,
        })
      }
    })

    // 添加分享用戶
    shares.forEach((share) => {
      const shareUserId = share.user_id._id.toString()
      if (shareUserId !== userId) {
        allInteractingUsers.set(shareUserId, {
          type: 'share',
          user: share.user_id,
          weight: SOCIAL_SCORE_CONFIG.interactions.share,
        })
      }
    })

    // 添加收藏用戶
    collections.forEach((collection) => {
      const collectionUserId = collection.user_id._id.toString()
      if (collectionUserId !== userId) {
        allInteractingUsers.set(collectionUserId, {
          type: 'collect',
          user: collection.user_id,
          weight: SOCIAL_SCORE_CONFIG.interactions.collect,
        })
      }
    })

    // 添加瀏覽用戶
    views.forEach((view) => {
      const viewUserId = view.user_id._id.toString()
      if (viewUserId !== userId) {
        allInteractingUsers.set(viewUserId, {
          type: 'view',
          user: view.user_id,
          weight: SOCIAL_SCORE_CONFIG.interactions.view,
        })
      }
    })

    // 計算每個互動用戶的社交分數
    for (const [interactingUserId, interactionData] of allInteractingUsers) {
      const { type, user, weight } = interactionData

      // 計算社交距離
      const distanceInfo = await calculateSocialDistance(userId, interactingUserId, socialGraph)

      if (distanceInfo.distance <= maxDistance) {
        // 計算社交影響力
        const interactingUserSocialData = socialGraph[interactingUserId]
        const influenceInfo = includeInfluence
          ? calculateSocialInfluenceScore(interactingUserSocialData)
          : { score: 0, level: 'none' }

        // 計算互動分數
        const baseInteractionScore = weight * distanceInfo.weight
        const influenceMultiplier = 1 + influenceInfo.score / 100
        const finalInteractionScore = baseInteractionScore * influenceMultiplier

        // 累計分數
        if (includeInteractions) {
          interactionScore += finalInteractionScore
        }
        if (includeDistance) {
          distanceScore += distanceInfo.weight
        }
        if (includeInfluence) {
          influenceScore += influenceInfo.score
        }

        // 記錄社交互動
        socialInteractions.push({
          userId: interactingUserId,
          username: user.username,
          displayName: user.display_name,
          action: type,
          weight: finalInteractionScore,
          distance: distanceInfo.distance,
          distanceType: distanceInfo.type,
          influenceScore: influenceInfo.score,
          influenceLevel: influenceInfo.level,
        })

        // 生成推薦原因
        if (finalInteractionScore >= SOCIAL_SCORE_CONFIG.reasonConfig.minScoreForReason) {
          const reasonTemplate = SOCIAL_SCORE_CONFIG.reasonConfig.reasonTemplates[type]
          if (reasonTemplate) {
            reasons.push({
              type,
              text: reasonTemplate.replace('{username}', user.display_name || user.username),
              weight: finalInteractionScore,
              userId: interactingUserId,
              username: user.username,
            })
          }
        }
      }
    }

    // 計算總社交分數
    totalSocialScore = interactionScore + distanceScore + influenceScore

    // 限制最大社交分數
    totalSocialScore = Math.min(totalSocialScore, SOCIAL_SCORE_CONFIG.scoreLimits.maxSocialScore)

    // 排序推薦原因（按權重降序）
    reasons.sort((a, b) => b.weight - a.weight)
    reasons.splice(SOCIAL_SCORE_CONFIG.reasonConfig.maxReasons)

    // 排序社交互動（按權重降序）
    socialInteractions.sort((a, b) => b.weight - a.weight)

    console.log(
      `迷因 ${memeId} 的社交層分數計算完成：總分 ${totalSocialScore}，互動分數 ${interactionScore}，距離分數 ${distanceScore}，影響力分數 ${influenceScore}`,
    )

    return {
      socialScore: totalSocialScore,
      distanceScore,
      influenceScore,
      interactionScore,
      reasons,
      socialInteractions,
      algorithm_details: {
        description: '基於社交關係的詳細分數計算',
        features: [
          '考慮社交距離（直接關注、互相關注、二度關係、三度關係）',
          '計算社交影響力分數',
          '分析不同類型的社交互動（發佈、按讚、留言、分享、收藏、瀏覽）',
          '生成具體的推薦原因說明',
          '限制分數上限避免單一迷因爆分',
        ],
      },
    }
  } catch (error) {
    console.error('計算迷因社交層分數時發生錯誤:', error)
    return {
      socialScore: 0,
      distanceScore: 0,
      influenceScore: 0,
      interactionScore: 0,
      reasons: [],
      socialInteractions: [],
    }
  }
}

/**
 * 批量計算多個迷因的社交層分數
 * @param {string} userId - 目標用戶ID
 * @param {Array} memeIds - 迷因ID列表
 * @param {Object} options - 配置選項
 * @returns {Array} 社交層分數列表
 */
export const calculateMultipleMemeSocialScores = async (userId, memeIds, options = {}) => {
  try {
    console.log(`開始批量計算 ${memeIds.length} 個迷因的社交層分數...`)

    const results = []
    const batchSize = 10 // 批次處理大小

    for (let i = 0; i < memeIds.length; i += batchSize) {
      const batch = memeIds.slice(i, i + batchSize)
      const batchPromises = batch.map((memeId) => calculateMemeSocialScore(userId, memeId, options))
      const batchResults = await Promise.all(batchPromises)

      results.push(
        ...batchResults.map((result, index) => ({
          memeId: batch[index],
          ...result,
        })),
      )
    }

    // 按社交分數排序
    results.sort((a, b) => b.socialScore - a.socialScore)

    console.log(`批量計算完成，處理了 ${results.length} 個迷因`)
    return results
  } catch (error) {
    console.error('批量計算迷因社交層分數時發生錯誤:', error)
    return []
  }
}

/**
 * 取得用戶的社交影響力統計
 * @param {string} userId - 用戶ID
 * @returns {Object} 社交影響力統計
 */
export const getUserSocialInfluenceStats = async (userId) => {
  try {
    const socialGraph = await buildSocialGraph([userId])
    const userSocialData = socialGraph[userId]

    if (!userSocialData) {
      return {
        influenceScore: 0,
        influenceLevel: 'none',
        followers: 0,
        following: 0,
        mutualFollows: 0,
        networkDensity: 0,
        socialReach: 0,
      }
    }

    const influenceInfo = calculateSocialInfluenceScore(userSocialData)

    // 計算網路密度
    const totalConnections = userSocialData.followers.length + userSocialData.following.length
    const networkDensity = totalConnections > 0 ? totalConnections / 100 : 0

    // 計算社交影響範圍
    const socialReach = userSocialData.followers.length + userSocialData.mutualFollows.length

    return {
      influenceScore: influenceInfo.score,
      influenceLevel: influenceInfo.level,
      followers: influenceInfo.followers,
      following: influenceInfo.following,
      mutualFollows: influenceInfo.mutualFollows,
      networkDensity,
      socialReach,
    }
  } catch (error) {
    console.error('取得用戶社交影響力統計時發生錯誤:', error)
    return {
      influenceScore: 0,
      influenceLevel: 'none',
      followers: 0,
      following: 0,
      mutualFollows: 0,
      networkDensity: 0,
      socialReach: 0,
    }
  }
}

/**
 * 生成社交推薦原因
 * @param {Array} socialInteractions - 社交互動列表
 * @param {Object} options - 配置選項
 * @returns {Array} 推薦原因列表
 */
export const generateSocialRecommendationReasons = (socialInteractions, options = {}) => {
  try {
    const { maxReasons = 3, minWeight = 2 } = options || {}

    // 按權重分組
    const reasonsByType = {}
    for (const interaction of socialInteractions) {
      if (interaction.weight >= minWeight) {
        if (!reasonsByType[interaction.action]) {
          reasonsByType[interaction.action] = []
        }
        reasonsByType[interaction.action].push(interaction)
      }
    }

    // 生成推薦原因
    const reasons = []
    for (const [actionType, interactions] of Object.entries(reasonsByType)) {
      // 按權重排序
      interactions.sort((a, b) => b.weight - a.weight)

      // 取權重最高的互動
      const topInteraction = interactions[0]
      const reasonTemplate = SOCIAL_SCORE_CONFIG.reasonConfig.reasonTemplates[actionType]

      if (reasonTemplate) {
        reasons.push({
          type: actionType,
          text: reasonTemplate.replace(
            '{username}',
            topInteraction.displayName || topInteraction.username,
          ),
          weight: topInteraction.weight,
          userId: topInteraction.userId,
          username: topInteraction.username,
          displayName: topInteraction.displayName,
          distance: topInteraction.distance,
          distanceType: topInteraction.distanceType,
          influenceScore: topInteraction.influenceScore,
          influenceLevel: topInteraction.influenceLevel,
        })
      }
    }

    // 按權重排序並限制數量
    reasons.sort((a, b) => b.weight - a.weight)
    return reasons.slice(0, maxReasons)
  } catch (error) {
    console.error('生成社交推薦原因時發生錯誤:', error)
    return []
  }
}

export default {
  calculateSocialDistance,
  buildSocialGraph,
  calculateSocialInfluenceScore,
  calculateMemeSocialScore,
  calculateMultipleMemeSocialScores,
  getUserSocialInfluenceStats,
  generateSocialRecommendationReasons,
  SOCIAL_SCORE_CONFIG,
}
