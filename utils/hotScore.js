/**
 * 熱門分數演算法工具函數
 * 提供多種熱門分數計算方法，用於推薦系統
 * 包含版本控制快取支援
 */

import cacheVersionManager from './cacheVersionManager.js'
import redisCache from '../config/redis.js'

/**
 * 安全的JSON序列化函數，避免"[object Object]"問題
 * @param {any} data - 要序列化的數據
 * @returns {string} JSON字符串
 */
const safeJsonStringify = (data) => {
  try {
    // 首先嘗試標準的JSON.stringify
    return JSON.stringify(data)
  } catch (error) {
    console.warn('標準JSON序列化失敗，嘗試安全序列化:', error.message)

    // 如果失敗，使用自定義的序列化邏輯
    const safeStringify = (obj, seen = new WeakSet()) => {
      // 處理基本類型
      if (obj === null || obj === undefined) return obj
      if (typeof obj === 'string') return obj
      if (typeof obj === 'number') return obj
      if (typeof obj === 'boolean') return obj

      // 處理函數
      if (typeof obj === 'function') return '[Function]'

      // 處理日期
      if (obj instanceof Date) return obj.toISOString()

      // 處理ObjectId
      if (obj.constructor && obj.constructor.name === 'ObjectId') return obj.toString()

      // 處理數組
      if (Array.isArray(obj)) {
        return obj.map((item) => safeStringify(item, seen))
      }

      // 處理對象
      if (typeof obj === 'object') {
        // 檢查循環引用
        if (seen.has(obj)) return '[Circular Reference]'
        seen.add(obj)

        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          try {
            result[key] = safeStringify(value, seen)
          } catch {
            result[key] = '[Serialization Error]'
          }
        }
        seen.delete(obj)
        return result
      }

      // 其他類型轉為字符串
      return String(obj)
    }

    return JSON.stringify(safeStringify(data))
  }
}

/**
 * 熱門分數快取配置
 */
const HOT_SCORE_CACHE_CONFIG = {
  batchUpdate: 1800, // 30分鐘
  memeHotScore: 3600, // 1小時
}

/**
 * 熱門分數版本控制快取處理器
 */
class HotScoreVersionedCacheProcessor {
  constructor() {
    this.redis = redisCache
  }

  /**
   * 帶版本控制的快取處理
   * @param {string} cacheKey - 快取鍵
   * @param {Function} fetchFunction - 數據獲取函數
   * @param {Object} options - 選項
   * @returns {Object} 包含數據和版本資訊的結果
   */
  async processWithVersion(cacheKey, fetchFunction, options = {}) {
    const ttl = options.ttl || 3600
    const forceRefresh = options.forceRefresh || false

    try {
      // 取得當前版本
      const currentVersion = await cacheVersionManager.getVersion(cacheKey)

      if (!forceRefresh) {
        // 嘗試從快取取得數據
        const cachedData = await this.redis.get(cacheKey)

        if (cachedData !== null) {
          try {
            const parsedData =
              typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData

            // 如果快取包含版本資訊且版本匹配，返回快取數據
            if (parsedData.version && parsedData.version === currentVersion) {
              return {
                data: parsedData.data,
                version: parsedData.version,
                fromCache: true,
              }
            }
          } catch (parseError) {
            console.warn(`快取數據解析失敗 (${cacheKey}), 將重新獲取數據:`, parseError.message)
            // 刪除無效的快取數據
            await this.redis.del(cacheKey)
          }
        }
      }

      // 獲取新數據
      const freshData = await fetchFunction()

      // 準備帶版本的快取數據
      const versionedData = {
        data: freshData,
        version: currentVersion,
        timestamp: Date.now(),
      }

      // 設定快取（包含版本資訊）
      await this.redis.set(cacheKey, safeJsonStringify(versionedData), ttl)

      return {
        data: freshData,
        version: currentVersion,
        fromCache: false,
      }
    } catch (error) {
      console.error(`熱門分數版本控制快取處理失敗 (${cacheKey}):`, error)

      // 降級到普通快取處理
      try {
        if (!forceRefresh) {
          const cached = await this.redis.get(cacheKey)
          if (cached !== null) {
            try {
              const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
              return {
                data: parsed,
                version: '1.0.0',
                fromCache: true,
              }
            } catch (parseError) {
              console.warn(
                `降級快取數據解析失敗 (${cacheKey}), 將重新獲取數據:`,
                parseError.message,
              )
              // 刪除無效的快取數據
              await this.redis.del(cacheKey)
            }
          }
        }

        const data = await fetchFunction()
        await this.redis.set(cacheKey, safeJsonStringify(data), ttl)

        return {
          data: data,
          version: '1.0.0',
          fromCache: false,
        }
      } catch (fallbackError) {
        console.error('降級快取處理也失敗:', fallbackError)
        throw error
      }
    }
  }

  /**
   * 清除熱門分數相關快取並更新版本
   * @param {string} level - 版本更新層級
   */
  async invalidateHotScoreCache(level = 'patch') {
    try {
      const cacheKeys = ['hot_score_batch:*', 'meme_hot_score:*']

      // 使用版本控制批量更新
      const results = await cacheVersionManager.batchUpdateVersions(cacheKeys, level)

      // 清除所有相關快取
      const cachePromises = cacheKeys.map((key) => this.redis.del(key))
      await Promise.all(cachePromises)

      console.log(`清除熱門分數快取並更新版本完成: ${cacheKeys.length} 個鍵`)
      return results
    } catch (error) {
      console.error('清除熱門分數快取失敗:', error)
      throw error
    }
  }
}

// 建立熱門分數版本控制快取處理器實例
const hotScoreCacheProcessor = new HotScoreVersionedCacheProcessor()

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
export const calculateMemeHotScore = async (memeData, now = new Date()) => {
  try {
    // 驗證輸入參數
    if (!memeData || typeof memeData !== 'object') {
      throw new Error('無效的迷因資料')
    }

    if (!(now instanceof Date) || isNaN(now.getTime())) {
      now = new Date()
    }

    // 生成快取鍵 - 基於迷因ID和時間戳
    const memeId = memeData._id || memeData.id || 'unknown'
    const timeKey = Math.floor(now.getTime() / (1000 * 60 * 5)) // 5分鐘粒度
    const cacheKey = `meme_hot_score:${memeId}:${timeKey}`

    // 嘗試從快取取得數據
    const cacheResult = await hotScoreCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log(`快取未命中，重新計算迷因熱門分數，ID: ${memeId}...`)

        // 安全地提取數值，確保都是數字類型
        const like_count = Math.max(0, parseInt(memeData.like_count) || 0)
        const dislike_count = Math.max(0, parseInt(memeData.dislike_count) || 0)
        const views = Math.max(0, parseInt(memeData.views) || 0)
        const comment_count = Math.max(0, parseInt(memeData.comment_count) || 0)
        const collection_count = Math.max(0, parseInt(memeData.collection_count) || 0)
        const share_count = Math.max(0, parseInt(memeData.share_count) || 0)

        // 驗證時間欄位
        let createdAt = memeData.createdAt
        let modified_at = memeData.modified_at

        if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
          throw new Error('無效的創建時間')
        }

        if (modified_at && (!(modified_at instanceof Date) || isNaN(modified_at.getTime()))) {
          // 如果修改時間無效，忽略它
          modified_at = null
        }

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
        const timeDiff = Math.max(0, (now - effectiveDate) / (1000 * 60 * 60 * 24)) // 轉換為天

        // 時間衰減因子（使用對數衰減）
        let timeDecay = 1 / (1 + Math.log(timeDiff + 1))

        // 如果內容曾被修改，給予額外的新鮮度加成
        if (modified_at && modified_at !== createdAt) {
          const freshnesBonus = 1.2 // 20% 新鮮度加成
          timeDecay *= freshnesBonus
        }

        // 最終熱門分數
        const hotScore = baseScore * timeDecay

        // 驗證計算結果
        if (typeof hotScore !== 'number' || isNaN(hotScore) || !isFinite(hotScore)) {
          throw new Error(`熱門分數計算結果無效: ${hotScore}`)
        }

        return Math.max(hotScore, 0)
      },
      { ttl: HOT_SCORE_CACHE_CONFIG.memeHotScore },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log(`從快取取得迷因熱門分數，ID: ${memeId}`)
      return cacheResult.data
    }

    console.log(`迷因熱門分數計算完成並已快取，ID: ${memeId}`)
    return cacheResult.data
  } catch (error) {
    // 記錄錯誤並返回預設值
    console.error('計算熱門分數時發生錯誤:', {
      error: error.message,
      memeData: {
        _id: memeData._id,
        like_count: memeData.like_count,
        dislike_count: memeData.dislike_count,
        views: memeData.views,
        comment_count: memeData.comment_count,
        collection_count: memeData.collection_count,
        share_count: memeData.share_count,
        createdAt: memeData.createdAt,
        modified_at: memeData.modified_at,
      },
    })

    // 返回預設分數而不是拋出錯誤
    return 0
  }
}

/**
 * 批次更新迷因熱門分數
 *
 * @param {Array} memes - 迷因資料陣列
 * @param {Date} now - 當前時間（可選）
 * @returns {Array} 更新後的迷因資料陣列
 */
export const batchUpdateHotScores = async (memes, now = new Date()) => {
  try {
    // 生成快取鍵 - 基於迷因數量和時間戳
    const memeIds = memes.map((m) => m._id || m.id || 'unknown').sort()
    const timeKey = Math.floor(now.getTime() / (1000 * 60 * 10)) // 10分鐘粒度
    const cacheKey = `hot_score_batch:${memeIds.length}:${timeKey}`

    // 嘗試從快取取得數據
    const cacheResult = await hotScoreCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log(`快取未命中，重新計算批次熱門分數，數量: ${memes.length}...`)

        // 並行計算所有迷因的熱門分數
        const updatedMemes = await Promise.all(
          memes.map(async (meme) => ({
            ...meme,
            hot_score: await calculateMemeHotScore(meme, now),
          })),
        )

        return updatedMemes
      },
      { ttl: HOT_SCORE_CACHE_CONFIG.batchUpdate },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log(`從快取取得批次熱門分數，數量: ${memes.length}`)
      return cacheResult.data
    }

    console.log(`批次熱門分數計算完成並已快取，數量: ${memes.length}`)
    return cacheResult.data
  } catch (error) {
    console.error('批次更新熱門分數時發生錯誤:', error)
    // 降級到同步計算
    return memes.map((meme) => ({
      ...meme,
      hot_score: 0, // 返回預設分數
    }))
  }
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
