import Meme from '../models/Meme.js'
import Like from '../models/Like.js'
import Dislike from '../models/Dislike.js'
import Comment from '../models/Comment.js'
import Collection from '../models/Collection.js'
import Share from '../models/Share.js'
import View from '../models/View.js'
import Follow from '../models/Follow.js'
import User from '../models/User.js'

/**
 * 檢查並修正迷因的計數欄位
 * @param {string} memeId - 可選的迷因ID，如果不提供則檢查所有迷因
 * @returns {Object} 檢查結果
 */
export const checkAndFixCounts = async (memeId = null) => {
  const results = {
    total: 0,
    fixed: 0,
    errors: [],
    details: [],
  }

  try {
    // 決定要檢查哪些迷因
    const query = memeId ? { _id: memeId } : {}
    const memes = await Meme.find(query)
    results.total = memes.length

    for (const meme of memes) {
      try {
        const memeResult = await checkSingleMemeCounts(meme)
        results.details.push(memeResult)

        if (memeResult.fixed) {
          results.fixed++
        }
      } catch (error) {
        results.errors.push({
          meme_id: meme._id,
          error: error.message,
        })
      }
    }

    return results
  } catch (error) {
    throw new Error(`檢查計數時發生錯誤: ${error.message}`)
  }
}

/**
 * 檢查單一迷因的計數
 * @param {Object} meme - 迷因物件
 * @returns {Object} 檢查結果
 */
const checkSingleMemeCounts = async (meme) => {
  const result = {
    meme_id: meme._id,
    meme_title: meme.title,
    fixed: false,
    changes: {},
  }

  // 計算實際的計數
  const [
    actualLikeCount,
    actualDislikeCount,
    actualCommentCount,
    actualCollectionCount,
    actualShareCount,
    actualViewCount,
  ] = await Promise.all([
    Like.countDocuments({ meme_id: meme._id }),
    Dislike.countDocuments({ meme_id: meme._id }),
    Comment.countDocuments({ meme_id: meme._id }),
    Collection.countDocuments({ meme_id: meme._id }),
    Share.countDocuments({ meme_id: meme._id }),
    View.countDocuments({ meme_id: meme._id, is_duplicate: false }),
  ])

  // 檢查並記錄差異
  const updates = {}

  if (meme.like_count !== actualLikeCount) {
    updates.like_count = actualLikeCount
    result.changes.like_count = { from: meme.like_count, to: actualLikeCount }
  }

  if (meme.dislike_count !== actualDislikeCount) {
    updates.dislike_count = actualDislikeCount
    result.changes.dislike_count = { from: meme.dislike_count, to: actualDislikeCount }
  }

  if (meme.comment_count !== actualCommentCount) {
    updates.comment_count = actualCommentCount
    result.changes.comment_count = { from: meme.comment_count, to: actualCommentCount }
  }

  if (meme.collection_count !== actualCollectionCount) {
    updates.collection_count = actualCollectionCount
    result.changes.collection_count = { from: meme.collection_count, to: actualCollectionCount }
  }

  if (meme.share_count !== actualShareCount) {
    updates.share_count = actualShareCount
    result.changes.share_count = { from: meme.share_count, to: actualShareCount }
  }

  if (meme.views !== actualViewCount) {
    updates.views = actualViewCount
    result.changes.views = { from: meme.views, to: actualViewCount }
  }

  // 如果有差異，則更新
  if (Object.keys(updates).length > 0) {
    await Meme.findByIdAndUpdate(meme._id, updates)
    result.fixed = true
  }

  return result
}

/**
 * 檢查並修正用戶的計數欄位
 * @param {string} userId - 可選的用戶ID，如果不提供則檢查所有用戶
 * @returns {Object} 檢查結果
 */
export const checkAndFixUserCounts = async (userId = null) => {
  const results = {
    total: 0,
    fixed: 0,
    errors: [],
    details: [],
  }

  try {
    // 決定要檢查哪些用戶
    const query = userId ? { _id: userId } : {}
    const users = await User.find(query)
    results.total = users.length

    for (const user of users) {
      try {
        const userResult = await checkSingleUserCounts(user)
        results.details.push(userResult)

        if (userResult.fixed) {
          results.fixed++
        }
      } catch (error) {
        results.errors.push({
          user_id: user._id,
          error: error.message,
        })
      }
    }

    return results
  } catch (error) {
    throw new Error(`檢查用戶計數時發生錯誤: ${error.message}`)
  }
}

/**
 * 檢查單一用戶的計數
 * @param {Object} user - 用戶物件
 * @returns {Object} 檢查結果
 */
const checkSingleUserCounts = async (user) => {
  const result = {
    user_id: user._id,
    username: user.username,
    fixed: false,
    changes: {},
  }

  // 計算實際的計數
  const [
    actualFollowerCount,
    actualFollowingCount,
    actualMemeCount,
    actualCollectionCount,
    actualTotalLikesReceived,
    actualCommentCount,
    actualShareCount,
  ] = await Promise.all([
    Follow.countDocuments(mongoose.trusted({ following_id: user._id })),
    Follow.countDocuments(mongoose.trusted({ follower_id: user._id })),
    Meme.countDocuments({ author_id: user._id }),
    Collection.countDocuments({ user_id: user._id }),
    // 計算用戶發布的所有迷因獲得的總讚數
    calculateUserTotalLikesReceived(user._id),
    Comment.countDocuments({ user_id: user._id }),
    Share.countDocuments({ user_id: user._id }),
  ])

  // 檢查並記錄差異
  const updates = {}

  if (user.follower_count !== actualFollowerCount) {
    updates.follower_count = actualFollowerCount
    result.changes.follower_count = { from: user.follower_count, to: actualFollowerCount }
  }

  if (user.following_count !== actualFollowingCount) {
    updates.following_count = actualFollowingCount
    result.changes.following_count = { from: user.following_count, to: actualFollowingCount }
  }

  if (user.meme_count !== actualMemeCount) {
    updates.meme_count = actualMemeCount
    result.changes.meme_count = { from: user.meme_count, to: actualMemeCount }
  }

  if (user.collection_count !== actualCollectionCount) {
    updates.collection_count = actualCollectionCount
    result.changes.collection_count = { from: user.collection_count, to: actualCollectionCount }
  }

  if (user.total_likes_received !== actualTotalLikesReceived) {
    updates.total_likes_received = actualTotalLikesReceived
    result.changes.total_likes_received = {
      from: user.total_likes_received,
      to: actualTotalLikesReceived,
    }
  }

  if (user.comment_count !== actualCommentCount) {
    updates.comment_count = actualCommentCount
    result.changes.comment_count = { from: user.comment_count, to: actualCommentCount }
  }

  if (user.share_count !== actualShareCount) {
    updates.share_count = actualShareCount
    result.changes.share_count = { from: user.share_count, to: actualShareCount }
  }

  // 如果有差異，則更新
  if (Object.keys(updates).length > 0) {
    await User.findByIdAndUpdate(user._id, updates)
    result.fixed = true
  }

  return result
}

/**
 * 計算用戶發布的所有迷因獲得的總讚數
 * @param {string} userId - 用戶ID
 * @returns {number} 總讚數
 */
const calculateUserTotalLikesReceived = async (userId) => {
  const result = await Meme.aggregate([
    { $match: { author_id: userId } },
    { $group: { _id: null, totalLikes: { $sum: '$like_count' } } },
  ])

  return result.length > 0 ? result[0].totalLikes : 0
}

/**
 * 取得計數統計資訊
 * @returns {Object} 統計資訊
 */
export const getCountStatistics = async () => {
  try {
    const [
      totalMemes,
      totalLikes,
      totalDislikes,
      totalComments,
      totalCollections,
      totalShares,
      totalFollows,
      totalUsers,
    ] = await Promise.all([
      Meme.countDocuments(),
      Like.countDocuments(),
      Dislike.countDocuments(),
      Comment.countDocuments(),
      Collection.countDocuments(),
      Share.countDocuments(),
      Follow.countDocuments(),
      User.countDocuments(),
    ])

    return {
      memes: totalMemes,
      likes: totalLikes,
      dislikes: totalDislikes,
      comments: totalComments,
      collections: totalCollections,
      shares: totalShares,
      follows: totalFollows,
      users: totalUsers,
    }
  } catch (error) {
    throw new Error(`取得統計資訊時發生錯誤: ${error.message}`)
  }
}

/**
 * 批次檢查並修正迷因計數
 * @param {number} batchSize - 批次處理大小
 * @returns {Object} 檢查結果
 */
export const batchCheckCounts = async (batchSize = 100) => {
  const results = {
    total: 0,
    fixed: 0,
    errors: [],
    details: [],
  }

  try {
    // 分批處理所有迷因
    let skip = 0
    let hasMore = true

    while (hasMore) {
      const memes = await Meme.find({}).skip(skip).limit(batchSize)

      if (memes.length === 0) {
        hasMore = false
        break
      }

      results.total += memes.length

      for (const meme of memes) {
        try {
          const memeResult = await checkSingleMemeCounts(meme)
          results.details.push(memeResult)

          if (memeResult.fixed) {
            results.fixed++
          }
        } catch (error) {
          results.errors.push({
            meme_id: meme._id,
            error: error.message,
          })
        }
      }

      skip += batchSize
    }

    return results
  } catch (error) {
    throw new Error(`批次檢查計數時發生錯誤: ${error.message}`)
  }
}
