import Meme from '../models/Meme.js'
import Like from '../models/Like.js'
import Dislike from '../models/Dislike.js'
import Comment from '../models/Comment.js'
import Collection from '../models/Collection.js'
import Share from '../models/Share.js'

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
  ] = await Promise.all([
    Like.countDocuments({ meme_id: meme._id }),
    Dislike.countDocuments({ meme_id: meme._id }),
    Comment.countDocuments({ meme_id: meme._id }),
    Collection.countDocuments({ meme_id: meme._id }),
    Share.countDocuments({ meme_id: meme._id }),
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

  // 如果有差異，則更新
  if (Object.keys(updates).length > 0) {
    await Meme.findByIdAndUpdate(meme._id, updates)
    result.fixed = true
  }

  return result
}

/**
 * 批次檢查所有迷因的計數（用於定期維護）
 * @param {number} batchSize - 批次大小
 * @returns {Object} 批次處理結果
 */
export const batchCheckCounts = async (batchSize = 100) => {
  const results = {
    total: 0,
    processed: 0,
    fixed: 0,
    errors: [],
  }

  try {
    const totalMemes = await Meme.countDocuments()
    results.total = totalMemes

    for (let skip = 0; skip < totalMemes; skip += batchSize) {
      const memes = await Meme.find({}).skip(skip).limit(batchSize)

      for (const meme of memes) {
        try {
          const memeResult = await checkSingleMemeCounts(meme)
          results.processed++

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
    }

    return results
  } catch (error) {
    throw new Error(`批次檢查計數時發生錯誤: ${error.message}`)
  }
}

/**
 * 取得計數統計資訊
 * @returns {Object} 統計資訊
 */
export const getCountStatistics = async () => {
  try {
    const [totalMemes, totalLikes, totalDislikes, totalComments, totalCollections, totalShares] =
      await Promise.all([
        Meme.countDocuments(),
        Like.countDocuments(),
        Dislike.countDocuments(),
        Comment.countDocuments(),
        Collection.countDocuments(),
        Share.countDocuments(),
      ])

    return {
      memes: totalMemes,
      likes: totalLikes,
      dislikes: totalDislikes,
      comments: totalComments,
      collections: totalCollections,
      shares: totalShares,
    }
  } catch (error) {
    throw new Error(`取得統計資訊時發生錯誤: ${error.message}`)
  }
}
