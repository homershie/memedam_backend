/**
 * 熱門分數演算法工具函數
 * 提供多種熱門分數計算方法，用於推薦系統
 */

/**
 * Reddit 風格的熱門分數演算法
 * 公式：log10(z) + (y - 45000) / 45000
 * 其中 z = upvotes - downvotes，y = 時間差（秒）
 *
 * @param {number} upvotes - 讚數
 * @param {number} downvotes - 噓數
 * @param {Date} createdAt - 創建時間
 * @param {Date} now - 當前時間（可選）
 * @returns {number} 熱門分數
 */
export const calculateRedditHotScore = (upvotes, downvotes, createdAt, now = new Date()) => {
  const z = Math.max(upvotes - downvotes, 1) // 避免 log(0)
  const y = Math.floor((now - createdAt) / 1000) // 轉換為秒

  const score = Math.log10(z) + (y - 45000) / 45000
  return Math.max(score, 0) // 確保分數不為負數
}

/**
 * Hacker News 風格的熱門分數演算法
 * 公式：(p - 1) / (t + 2)^1.5
 * 其中 p = 點讚數，t = 時間差（小時）
 *
 * @param {number} upvotes - 讚數
 * @param {Date} createdAt - 創建時間
 * @param {Date} now - 當前時間（可選）
 * @returns {number} 熱門分數
 */
export const calculateHNHotScore = (upvotes, createdAt, now = new Date()) => {
  const p = upvotes
  const t = (now - createdAt) / (1000 * 60 * 60) // 轉換為小時

  const score = (p - 1) / Math.pow(t + 2, 1.5)
  return Math.max(score, 0)
}

/**
 * 自定義熱門分數演算法（適合迷因平台）
 * 綜合考慮：讚數、瀏覽數、留言數、收藏數、分享數、時間衰減
 *
 * @param {Object} memeData - 迷因資料
 * @param {number} memeData.like_count - 讚數
 * @param {number} memeData.dislike_count - 噓數
 * @param {number} memeData.views - 瀏覽數
 * @param {number} memeData.comment_count - 留言數
 * @param {number} memeData.collection_count - 收藏數
 * @param {number} memeData.share_count - 分享數
 * @param {Date} memeData.createdAt - 創建時間
 * @param {Date} memeData.modified_at - 修改時間（可選）
 * @param {Date} now - 當前時間（可選）
 * @returns {number} 熱門分數
 */
export const calculateMemeHotScore = (memeData, now = new Date()) => {
  const {
    like_count = 0,
    dislike_count = 0,
    views = 0,
    comment_count = 0,
    collection_count = 0,
    share_count = 0,
    createdAt,
    modified_at,
  } = memeData

  // 權重設定
  const weights = {
    like: 1.0,
    dislike: -0.5, // 噓數會降低分數
    view: 0.1, // 瀏覽數權重較低
    comment: 2.0, // 留言權重較高
    collection: 3.0, // 收藏權重最高
    share: 2.5, // 分享權重很高
  }

  // 計算基礎分數
  const baseScore =
    like_count * weights.like +
    dislike_count * weights.dislike +
    views * weights.view +
    comment_count * weights.comment +
    collection_count * weights.collection +
    share_count * weights.share

  // 使用有效時間（優先使用修改時間，提升更新內容的排名）
  const effectiveDate = modified_at || createdAt
  const timeDiff = (now - effectiveDate) / (1000 * 60 * 60 * 24) // 轉換為天

  // 時間衰減因子（使用對數衰減）
  let timeDecay = 1 / (1 + Math.log(timeDiff + 1))

  // 如果內容曾被修改，給予額外的新鮮度加成
  if (modified_at && modified_at !== createdAt) {
    const freshnesBonus = 1.2 // 20% 新鮮度加成
    timeDecay *= freshnesBonus
  }

  // 最終熱門分數
  const hotScore = baseScore * timeDecay

  return Math.max(hotScore, 0)
}

/**
 * 批次更新迷因熱門分數
 *
 * @param {Array} memes - 迷因資料陣列
 * @param {Date} now - 當前時間（可選）
 * @returns {Array} 更新後的迷因資料陣列
 */
export const batchUpdateHotScores = (memes, now = new Date()) => {
  return memes.map((meme) => ({
    ...meme,
    hot_score: calculateMemeHotScore(meme, now),
  }))
}

/**
 * 取得熱門分數等級
 *
 * @param {number} hotScore - 熱門分數
 * @returns {string} 等級描述
 */
export const getHotScoreLevel = (hotScore) => {
  if (hotScore >= 1000) return 'viral' // 病毒式傳播
  if (hotScore >= 500) return 'trending' // 趨勢熱門
  if (hotScore >= 100) return 'popular' // 受歡迎
  if (hotScore >= 50) return 'active' // 活躍
  if (hotScore >= 10) return 'normal' // 一般
  return 'new' // 新內容
}

/**
 * 計算迷因的參與度分數（Engagement Score）
 * 用於衡量用戶與內容的互動程度
 *
 * @param {Object} memeData - 迷因資料
 * @returns {number} 參與度分數
 */
export const calculateEngagementScore = (memeData) => {
  const {
    like_count = 0,
    dislike_count = 0,
    comment_count = 0,
    collection_count = 0,
    share_count = 0,
    views = 0,
  } = memeData

  // 互動總數
  const totalInteractions =
    like_count + dislike_count + comment_count + collection_count + share_count

  // 避免除以零
  if (views === 0) return 0

  // 參與度 = 互動數 / 瀏覽數
  const engagementRate = totalInteractions / views

  // 轉換為百分比並限制在 0-100 範圍
  return Math.min(engagementRate * 100, 100)
}

/**
 * 計算迷因的品質分數（Quality Score）
 * 基於正面互動與負面互動的比例
 *
 * @param {Object} memeData - 迷因資料
 * @returns {number} 品質分數 (0-100)
 */
export const calculateQualityScore = (memeData) => {
  const {
    like_count = 0,
    dislike_count = 0,
    comment_count = 0,
    collection_count = 0,
    share_count = 0,
  } = memeData

  // 正面互動
  const positiveInteractions = like_count + comment_count + collection_count + share_count

  // 負面互動
  const negativeInteractions = dislike_count

  // 總互動數
  const totalInteractions = positiveInteractions + negativeInteractions

  if (totalInteractions === 0) return 50 // 無互動時給中等分數

  // 品質分數 = 正面互動比例 * 100
  const qualityScore = (positiveInteractions / totalInteractions) * 100

  return Math.round(qualityScore)
}

/**
 * 計算更新內容的推薦分數
 * 專門用於推薦系統中優化最近更新的內容
 *
 * @param {Object} memeData - 迷因資料
 * @param {Date} now - 當前時間（可選）
 * @returns {number} 更新推薦分數
 */
export const calculateUpdatedContentScore = (memeData, now = new Date()) => {
  const { createdAt, modified_at, hot_score = 0 } = memeData

  // 如果沒有修改時間，返回原始熱門分數
  if (!modified_at || modified_at === createdAt) {
    return hot_score
  }

  // 計算修改距離現在的時間（小時）
  const hoursSinceModified = (now - modified_at) / (1000 * 60 * 60)

  // 新鮮度分數（24小時內修改的內容獲得最高加成）
  let freshnessMultiplier = 1.0
  if (hoursSinceModified <= 1) {
    freshnessMultiplier = 2.0 // 1小時內修改 +100%
  } else if (hoursSinceModified <= 6) {
    freshnessMultiplier = 1.5 // 6小時內修改 +50%
  } else if (hoursSinceModified <= 24) {
    freshnessMultiplier = 1.3 // 24小時內修改 +30%
  } else if (hoursSinceModified <= 72) {
    freshnessMultiplier = 1.1 // 3天內修改 +10%
  }

  // 計算內容年齡（天）
  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24)

  // 對於較舊的內容，修改後給予更大的推薦加成
  let ageBonus = 1.0
  if (daysSinceCreation > 7) {
    ageBonus = 1.4 // 老內容修改後加成更多
  } else if (daysSinceCreation > 3) {
    ageBonus = 1.2
  }

  return hot_score * freshnessMultiplier * ageBonus
}

export default {
  calculateRedditHotScore,
  calculateHNHotScore,
  calculateMemeHotScore,
  batchUpdateHotScores,
  getHotScoreLevel,
  calculateEngagementScore,
  calculateQualityScore,
  calculateUpdatedContentScore,
}
