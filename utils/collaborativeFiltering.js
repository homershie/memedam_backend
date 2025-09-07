/**
 * 協同過濾推薦系統
 * 基於用戶行為相似性的推薦演算法
 * 包含社交協同過濾功能
 */

import mongoose from 'mongoose'
// 移除重複匯入
// 重複匯入移除
import Like from '../models/Like.js'
import Collection from '../models/Collection.js'
import Comment from '../models/Comment.js'
import Share from '../models/Share.js'
import View from '../models/View.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'

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
      if (obj instanceof mongoose.Types.ObjectId) return obj.toString()

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
import { handleQueryError } from './errorHandler.js'
import cacheVersionManager from './cacheVersionManager.js'
import redisCache from '../config/redis.js'
 

/**
 * 資料庫連線健康檢查
 * @returns {boolean} 連線是否正常
 */
const checkDatabaseHealth = async () => {
  try {
    // 檢查連線狀態
    if (mongoose.connection.readyState !== 1) {
      console.error(`資料庫連線狀態異常: ${mongoose.connection.readyState}`)
      return false
    }

    // 執行簡單的查詢來測試連線
    await mongoose.connection.db.admin().ping()
    return true
  } catch (error) {
    console.error('資料庫健康檢查失敗:', error)
    return false
  }
}

/**
 * 重新連線到資料庫
 * @returns {boolean} 重連是否成功
 */
const reconnectDatabase = async () => {
  try {
    console.log('嘗試重新連線到資料庫...')

    // 如果連線已關閉，重新連線
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_PROD_URI || process.env.MONGO_DEV_URI, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 15000,
        retryWrites: true,
        retryReads: true,
      })
    }

    // 等待連線恢復
    let retries = 0
    while (mongoose.connection.readyState !== 1 && retries < 5) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      retries++
    }

    return mongoose.connection.readyState === 1
  } catch (error) {
    console.error('資料庫重連失敗:', error)
    return false
  }
}

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
 * 快取配置
 */
const COLLABORATIVE_CACHE_CONFIG = {
  interactionMatrix: 1800, // 30分鐘
  similarUsers: 3600, // 1小時
  collaborativeRecommendations: 1800, // 30分鐘
  socialCollaborativeRecommendations: 1800, // 30分鐘
  socialGraph: 3600, // 1小時
  socialSimilarUsers: 3600, // 1小時
}

/**
 * 協同過濾版本控制快取處理器
 */
class CollaborativeVersionedCacheProcessor {
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
            const parsedData = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData

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
      console.error(`協同過濾版本控制快取處理失敗 (${cacheKey}):`, error)

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
   * 清除協同過濾相關快取並更新版本
   * @param {string} level - 版本更新層級
   */
  async invalidateCollaborativeCache(level = 'patch') {
    try {
      const cacheKeys = [
        'interaction_matrix:*',
        'similar_users:*',
        'collaborative_recommendations:*',
        'social_collaborative_recommendations:*',
        'social_graph:*',
        'social_similar_users:*',
      ]

      // 使用版本控制批量更新
      const results = await cacheVersionManager.batchUpdateVersions(cacheKeys, level)

      // 清除所有相關快取
      const cachePromises = cacheKeys.map((key) => this.redis.del(key))
      await Promise.all(cachePromises)

      console.log(`清除協同過濾快取並更新版本完成: ${cacheKeys.length} 個鍵`)
      return results
    } catch (error) {
      console.error('清除協同過濾快取失敗:', error)
      throw error
    }
  }
}

// 建立協同過濾版本控制快取處理器實例
const collaborativeCacheProcessor = new CollaborativeVersionedCacheProcessor()

/**
 * 安全地轉換為 ObjectId
 * @param {string|ObjectId} id - 要轉換的 ID
 * @returns {ObjectId|null} 轉換後的 ObjectId 或 null
 */
const safeToObjectId = (id) => {
  try {
    if (!id) {
      console.warn('safeToObjectId: 傳入的 ID 為空')
      return null
    }

    // 如果已經是 ObjectId，直接返回
    if (id instanceof mongoose.Types.ObjectId) {
      return id
    }

    // 如果是字符串，檢查是否為有效的 ObjectId 格式
    if (typeof id === 'string') {
      // 移除可能的空格
      const trimmedId = id.trim()
      if (!trimmedId) {
        console.warn('safeToObjectId: 傳入的字符串為空')
        return null
      }

      if (!mongoose.Types.ObjectId.isValid(trimmedId)) {
        console.warn(`safeToObjectId: 無效的 ObjectId 格式: "${trimmedId}"`)
        return null
      }
      return new mongoose.Types.ObjectId(trimmedId)
    }

    // 其他類型的處理
    if (id && typeof id === 'object') {
      // 如果是包含 toString 方法的對象
      if (typeof id.toString === 'function') {
        const idStr = id.toString()
        if (mongoose.Types.ObjectId.isValid(idStr)) {
          return new mongoose.Types.ObjectId(idStr)
        }
      }

      // 如果是包含 _id 屬性的對象
      if (id._id) {
        return safeToObjectId(id._id)
      }
    }

    console.warn(`safeToObjectId: 無法轉換為 ObjectId: ${JSON.stringify(id)}, 類型: ${typeof id}`)
    return null
  } catch (error) {
    console.error(`safeToObjectId: ObjectId 轉換錯誤: ${error.message}`, { id, type: typeof id })
    return null
  }
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
 * 建立用戶-迷因互動矩陣（帶版本控制快取）
 */
export const buildInteractionMatrix = async (userIds = [], memeIds = []) => {
  try {
    console.log('開始建立用戶-迷因互動矩陣...')

    // 生成快取鍵
    const userIdsKey = userIds.length > 0 ? userIds.sort().join('_') : 'all'
    const memeIdsKey = memeIds.length > 0 ? memeIds.sort().join('_') : 'all'
    const cacheKey = `interaction_matrix:${userIdsKey}:${memeIdsKey}`

    // 嘗試從快取取得數據
    const cacheResult = await collaborativeCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log('快取未命中，重新計算互動矩陣...')

        // 如果沒有提供用戶ID，取得所有活躍用戶（限制數量避免性能問題）
        let targetUserIds = userIds
        if (userIds.length === 0) {
          try {
            const activeUsers = await User.find({ status: 'active' })
              .select('_id')
              .limit(500) // 減少限制數量以提高性能
              .lean()
              .exec()
            targetUserIds = activeUsers.map((user) => user._id)
            console.log(`找到 ${targetUserIds.length} 個活躍用戶`)
          } catch (error) {
            console.error('獲取活躍用戶失敗:', error)
            return {}
          }
        } else {
          // 確保所有用戶ID都是ObjectId格式
          targetUserIds = userIds
            .map((id) => {
              // 如果已經是 ObjectId，直接使用，否則嘗試轉換
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

        // 如果沒有有效的用戶ID，返回空的互動矩陣
        if (targetUserIds.length === 0) {
          console.log('沒有有效的用戶ID，返回空的互動矩陣')
          return {}
        }

        // 如果沒有提供迷因ID，取得所有公開迷因（大幅減少數量並添加錯誤處理）
        let targetMemeIds = memeIds
        if (memeIds.length === 0) {
          try {
            // 減少查詢數量，並添加時間限制
            const publicMemes = await Meme.find({
              status: 'public',
              createdAt: mongoose.trusted({
                $gte: (() => {
                  const thirtyDaysAgo = new Date()
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                  return thirtyDaysAgo
                })(),
              }), // 只取最近30天的迷因
            })
              .select('_id')
              .sort({ createdAt: -1 }) // 按創建時間倒序
              .limit(1000) // 大幅減少限制數量
              .lean()
              .exec()

            targetMemeIds = publicMemes.map((meme) => meme._id)
            console.log(`找到 ${targetMemeIds.length} 個公開迷因`)

            if (targetMemeIds.length === 0) {
              console.log('沒有找到公開迷因，返回空的互動矩陣')
              return {}
            }
          } catch (error) {
            console.error('獲取公開迷因失敗:', error)
            // 如果查詢失敗，嘗試使用備用方案
            try {
              const fallbackMemes = await Meme.find({ status: 'public' })
                .select('_id')
                .limit(100) // 更小的備用限制
                .lean()
                .exec()
              targetMemeIds = fallbackMemes.map((meme) => meme._id)
              console.log(`使用備用方案，找到 ${targetMemeIds.length} 個迷因`)
            } catch (fallbackError) {
              console.error('備用查詢也失敗:', fallbackError)
              return {}
            }
          }
        } else {
          // 確保所有迷因ID都是ObjectId格式
          targetMemeIds = memeIds
            .map((id) => {
              if (id instanceof mongoose.Types.ObjectId) return id
              if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
                return new mongoose.Types.ObjectId(id)
              }
              console.warn(`無效的迷因ID格式: ${id}`)
              return null
            })
            .filter(Boolean) // 過濾掉無效的ID
        }

        // 確保 targetMemeIds 是純 ObjectId 數組
        targetMemeIds = targetMemeIds
          .map((id) => {
            if (id instanceof mongoose.Types.ObjectId) {
              return id
            }
            if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
              return new mongoose.Types.ObjectId(id)
            }
            console.warn(`無效的迷因ID格式: ${id}`)
            return null
          })
          .filter(Boolean) // 過濾掉無效的ID

        // 如果沒有有效的迷因ID，返回空的互動矩陣
        if (targetMemeIds.length === 0) {
          console.log('沒有有效的迷因ID，返回空的互動矩陣')
          return {}
        }

        console.log(`處理 ${targetUserIds.length} 個用戶和 ${targetMemeIds.length} 個迷因`)

        // 驗證每個 ObjectId 的有效性 - 確保格式正確
        const validatedUserIds = []
        for (const userId of targetUserIds) {
          if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            // 確保是純 ObjectId 實例
            const objectId =
              userId instanceof mongoose.Types.ObjectId
                ? userId
                : new mongoose.Types.ObjectId(userId)
            validatedUserIds.push(objectId)
          } else {
            console.warn(`跳過無效的用戶ID: ${userId}`)
          }
        }

        const validatedMemeIds = []
        for (const memeId of targetMemeIds) {
          if (memeId && mongoose.Types.ObjectId.isValid(memeId)) {
            // 確保是純 ObjectId 實例
            const objectId =
              memeId instanceof mongoose.Types.ObjectId
                ? memeId
                : new mongoose.Types.ObjectId(memeId)
            validatedMemeIds.push(objectId)
          } else {
            console.warn(`跳過無效的迷因ID: ${memeId}`)
          }
        }

        if (validatedUserIds.length === 0 || validatedMemeIds.length === 0) {
          console.log('沒有有效的用戶ID或迷因ID，返回空的互動矩陣')
          return {}
        }

        console.log(`處理 ${validatedUserIds.length} 個用戶和 ${validatedMemeIds.length} 個迷因`)

        // 記錄查詢條件以便調試
        console.log(
          '查詢互動數據，用戶IDs:',
          validatedUserIds.slice(0, 3).map((id) => id.toString()),
          '...',
        )
        console.log(
          '查詢互動數據，迷因IDs:',
          validatedMemeIds.slice(0, 5).map((id) => id.toString()),
          '...',
        )

        // 取得所有互動數據 - 使用正確的查詢方式並添加超時保護
        const queryTimeout = 30000 // 30秒超時
        const [likes, collections, comments, shares, views] = await Promise.all([
          Like.find({
            user_id: mongoose.trusted({ $in: validatedUserIds }),
            meme_id: mongoose.trusted({ $in: validatedMemeIds }),
          })
            .select('user_id meme_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec(),
          Collection.find({
            user_id: mongoose.trusted({ $in: validatedUserIds }),
            meme_id: mongoose.trusted({ $in: validatedMemeIds }),
          })
            .select('user_id meme_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec(),
          Comment.find({
            user_id: mongoose.trusted({ $in: validatedUserIds }),
            meme_id: mongoose.trusted({ $in: validatedMemeIds }),
            status: 'normal',
          })
            .select('user_id meme_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec(),
          Share.find({
            user_id: mongoose.trusted({ $in: validatedUserIds }),
            meme_id: mongoose.trusted({ $in: validatedMemeIds }),
          })
            .select('user_id meme_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec(),
          View.find({
            user_id: mongoose.trusted({ $in: validatedUserIds }),
            meme_id: mongoose.trusted({ $in: validatedMemeIds }),
          })
            .select('user_id meme_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec(),
        ])

        console.log(
          `查詢完成 - 按讚: ${likes.length}, 收藏: ${collections.length}, 評論: ${comments.length}, 分享: ${shares.length}, 瀏覽: ${views.length}`,
        )

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
      },
      { ttl: COLLABORATIVE_CACHE_CONFIG.interactionMatrix },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log('從快取取得互動矩陣數據')
      return cacheResult.data
    }

    console.log('互動矩陣計算完成並已快取')
    return cacheResult.data
  } catch (error) {
    console.error('建立互動矩陣時發生錯誤:', error)
    return {}
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
 * 找到相似用戶（帶版本控制快取）
 * @param {string} targetUserId - 目標用戶ID
 * @param {Object} interactionMatrix - 互動矩陣
 * @param {number} minSimilarity - 最小相似度閾值
 * @param {number} maxUsers - 最大返回用戶數
 * @returns {Array} 相似用戶列表 [{userId, similarity}]
 */
export const findSimilarUsers = async (
  targetUserId,
  interactionMatrix,
  minSimilarity = 0.1,
  maxUsers = 50,
) => {
  try {
    // 生成快取鍵
    const matrixHash = Object.keys(interactionMatrix).sort().join('_')
    const cacheKey = `similar_users:${targetUserId}:${matrixHash}:${minSimilarity}:${maxUsers}`

    // 嘗試從快取取得數據
    const cacheResult = await collaborativeCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log(`快取未命中，重新計算用戶 ${targetUserId} 的相似用戶...`)

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
      },
      { ttl: COLLABORATIVE_CACHE_CONFIG.similarUsers },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log(`從快取取得用戶 ${targetUserId} 的相似用戶數據`)
      return cacheResult.data
    }

    console.log(`相似用戶計算完成並已快取，用戶: ${targetUserId}`)
    return cacheResult.data
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
    // 新增：分頁和排除功能
    page = 1,
    excludeIds = [],
    // 新增：類型篩選功能
    type = 'all',
    types = [],
  } = options || {}

  try {
    console.log(`開始為用戶 ${targetUserId} 生成協同過濾推薦...`)

    // 生成快取鍵
    const excludeIdsKey = excludeIds.length > 0 ? excludeIds.sort().join('_') : 'none'
    const tagsKey = tags.length > 0 ? tags.sort().join('_') : 'none'
    const typesKey = types.length > 0 ? types.sort().join('_') : 'all'
    const cacheKey = `collaborative_recommendations:${targetUserId}:${limit}:${minSimilarity}:${maxSimilarUsers}:${excludeInteracted}:${includeHotScore}:${hotScoreWeight}:${tagsKey}:${page}:${excludeIdsKey}:${type}:${typesKey}`

    // 嘗試從快取取得數據
    const cacheResult = await collaborativeCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log(`快取未命中，重新計算協同過濾推薦，用戶: ${targetUserId}...`)

        // 確保 targetUserId 是 ObjectId 格式
        const targetUserIdObj = safeToObjectId(targetUserId)
        if (!targetUserIdObj) {
          console.error(`無效的目標用戶ID格式: ${targetUserId}`)
          throw new Error(`無效的用戶ID格式: ${targetUserId}`)
        }

        // 建立互動矩陣
        const interactionMatrix = await buildInteractionMatrix([targetUserIdObj])

        // 如果目標用戶沒有互動歷史，返回熱門推薦
        if (
          !interactionMatrix[targetUserIdObj.toString()] ||
          Object.keys(interactionMatrix[targetUserIdObj.toString()]).length === 0
        ) {
          console.log('用戶沒有互動歷史，使用熱門推薦作為備選')
          const filter = { status: 'public' }

          // 如果有標籤篩選，加入標籤條件
          if (tags && tags.length > 0) {
            filter.tags_cache = { $in: tags }
          }

          // 新增：類型篩選功能
          if (types && types.length > 0) {
            if (types.length === 1) {
              filter.type = types[0] // 單一類型直接設置
            } else {
              filter.type = { $in: types } // 多個類型使用$in查詢
            }
          } else if (type && type !== 'all') {
            filter.type = type
          }

          // 如果有排除ID，加入查詢條件
          if (excludeIds && excludeIds.length > 0) {
            const validExcludeIds = excludeIds.map((id) => safeToObjectId(id)).filter(Boolean)
            if (validExcludeIds.length > 0) {
              filter._id = mongoose.trusted({ $nin: validExcludeIds })
            }
          }

          // 計算分頁，排除已載入的ID
          const totalLimit = parseInt(limit)
          const skipBase = (parseInt(page) - 1) * totalLimit
          const skip = Math.max(skipBase - (excludeIds ? excludeIds.length : 0), 0)

          const hotMemes = await Meme.find(filter)
            .setOptions({ sanitizeFilter: false })
            .sort({ hot_score: -1 })
            .skip(skip)
            .limit(totalLimit)
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
        const similarUsers = await findSimilarUsers(
          targetUserIdObj.toString(),
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

          // 新增：類型篩選功能
          if (types && types.length > 0) {
            if (types.length === 1) {
              filter.type = types[0] // 單一類型直接設置
            } else {
              filter.type = mongoose.trusted({ $in: types }) // 多個類型使用$in查詢
            }
          } else if (type && type !== 'all') {
            filter.type = type
          }

          // 如果有排除ID，加入查詢條件
          if (excludeIds && excludeIds.length > 0) {
            const validExcludeIds = excludeIds.map((id) => safeToObjectId(id)).filter(Boolean)
            if (validExcludeIds.length > 0) {
              filter._id = mongoose.trusted({ $nin: validExcludeIds })
            }
          }

          // 計算分頁，排除已載入的ID
          const totalLimit = parseInt(limit)
          const skipBase = (parseInt(page) - 1) * totalLimit
          const skip = Math.max(skipBase - (excludeIds ? excludeIds.length : 0), 0)

          const hotMemes = await Meme.find(filter)
            .setOptions({ sanitizeFilter: false })
            .sort({ hot_score: -1 })
            .skip(skip)
            .limit(totalLimit)
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
        const targetUserInteractions = new Set(
          Object.keys(interactionMatrix[targetUserIdObj.toString()]),
        )

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

        // 確保所有推薦的 memeId 都是有效的 ObjectId
        const validRecommendations = recommendations.filter((r) => {
          const validMemeId = safeToObjectId(r.memeId)
          if (!validMemeId) {
            console.warn(`跳過無效的推薦迷因ID: ${r.memeId}`)
            return false
          }
          r.memeId = validMemeId.toString() // 統一轉換為字符串格式
          return true
        })

        if (validRecommendations.length === 0) {
          console.log('沒有有效的推薦迷因ID')
          return []
        }

        // 排除已顯示的項目
        let filteredRecommendations = validRecommendations
        if (excludeIds && excludeIds.length > 0) {
          const excludeSet = new Set(excludeIds.map((id) => id.toString()))
          filteredRecommendations = filteredRecommendations.filter(
            (rec) => !excludeSet.has(rec.memeId),
          )
        }

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit)
        const paginatedRecommendations = filteredRecommendations.slice(skip, skip + parseInt(limit))

        if (paginatedRecommendations.length === 0) {
          console.log('分頁後沒有推薦項目')
          return []
        }

        const validMemeIds = paginatedRecommendations.map(
          (r) => new mongoose.Types.ObjectId(r.memeId),
        )

        const filter = {
          _id: { $in: validMemeIds },
          status: 'public',
        }

        // 如果有標籤篩選，加入標籤條件
        if (tags && tags.length > 0) {
          filter.tags_cache = { $in: tags }
        }

        // 新增：類型篩選功能
        if (types && types.length > 0) {
          if (types.length === 1) {
            filter.type = types[0] // 單一類型直接設置
          } else {
            filter.type = mongoose.trusted({ $in: types }) // 多個類型使用$in查詢
          }
        } else if (type && type !== 'all') {
          filter.type = type
        }

        // 取得迷因詳細資訊
        const memes = await Meme.find(filter)
          .setOptions({ sanitizeFilter: false })
          .populate('author_id', 'username display_name avatar')

        // 建立迷因ID到推薦數據的映射
        const recommendationMap = new Map()
        paginatedRecommendations.forEach((rec) => {
          recommendationMap.set(rec.memeId, rec)
        })

        // 組合最終推薦結果
        const finalRecommendations = memes.map((meme) => {
          const memeObj = meme.toObject()
          const recommendationData = recommendationMap.get(meme._id.toString())

          if (!recommendationData) {
            console.warn(`找不到迷因 ${meme._id} 的推薦數據`)
            return {
              ...memeObj,
              recommendation_score: memeObj.hot_score || 0,
              recommendation_type: 'collaborative_fallback',
              collaborative_score: 0,
              similar_users_count: 0,
              average_similarity: 0,
            }
          }

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
      },
      { ttl: COLLABORATIVE_CACHE_CONFIG.collaborativeRecommendations },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log(`從快取取得協同過濾推薦，用戶: ${targetUserId}`)
      return cacheResult.data
    }

    console.log(`協同過濾推薦計算完成並已快取，用戶: ${targetUserId}`)
    return cacheResult.data
  } catch (error) {
    console.error('協同過濾推薦生成失敗:', error)
    return []
  }
}

/**
 * 建立社交關係圖譜（帶版本控制快取）
 * @param {Array} userIds - 用戶ID列表
 * @returns {Object} 社交關係圖譜 {userId: {followers: [], following: [], mutual: []}}
 */
export const buildSocialGraph = async (userIds = []) => {
  try {
    console.log('開始建立社交關係圖譜...')

    // 生成快取鍵
    const userIdsKey = userIds.length > 0 ? userIds.sort().join('_') : 'all'
    const cacheKey = `social_graph:${userIdsKey}`

    // 嘗試從快取取得數據
    const cacheResult = await collaborativeCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log('快取未命中，重新計算社交關係圖譜...')

        // 如果沒有提供用戶ID，取得所有活躍用戶（限制數量避免性能問題）
        let targetUserIds = userIds
        if (userIds.length === 0) {
          try {
            const activeUsers = await User.find({ status: 'active' })
              .select('_id')
              .limit(500) // 減少限制數量以提高性能
              .lean()
              .exec()
            targetUserIds = activeUsers.map((user) => user._id)
            console.log(`找到 ${targetUserIds.length} 個活躍用戶`)
          } catch (error) {
            console.error('獲取活躍用戶失敗:', error)
            return {}
          }
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

        // 驗證每個 ObjectId 的有效性 - 確保格式正確
        const validatedUserIds = []
        for (const userId of targetUserIds) {
          if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            // 確保是純 ObjectId 實例
            const objectId =
              userId instanceof mongoose.Types.ObjectId
                ? userId
                : new mongoose.Types.ObjectId(userId)
            validatedUserIds.push(objectId)
          } else {
            console.warn(`跳過無效的用戶ID: ${userId}`)
          }
        }

        if (validatedUserIds.length === 0) {
          console.log('沒有有效的用戶ID通過驗證，返回空的社交圖譜')
          return {}
        }

        // 記錄查詢條件以便調試
        console.log(
          '查詢追隨關係，用戶IDs:',
          validatedUserIds.slice(0, 5).map((id) => id.toString()),
          '...',
        )

        // 取得所有追隨關係 - 使用明確的查詢方式避免類型轉換錯誤並添加超時保護
        let follows = []
        try {
          const queryTimeout = 30000 // 30秒超時

          // 直接使用已驗證的 ObjectId 實例，不需要再次驗證
          const cleanUserIds = validatedUserIds

          if (cleanUserIds.length === 0) {
            console.log('沒有有效的用戶ID，返回空的社交圖譜')
            return {}
          }

          // 構建查詢條件，使用安全的 ObjectId 處理
          const safeUserIds = cleanUserIds.map((id) =>
            id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id),
          )

          // 使用 mongoose.trusted 完全避免 CastError (參考 mixedRecommendation.js)
          console.log(`執行查詢，用戶ID數量: ${cleanUserIds.length}`)

          // 分離查詢：先查詢 follower_id - 使用 mongoose.trusted
          const followerFollows = await Follow.find(
            mongoose.trusted({
              follower_id: mongoose.trusted({ $in: safeUserIds }),
              status: 'active',
            }),
          )
            .select('follower_id following_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec()

          // 再查詢 following_id - 使用 mongoose.trusted
          const followingFollows = await Follow.find(
            mongoose.trusted({
              following_id: mongoose.trusted({ $in: safeUserIds }),
              status: 'active',
            }),
          )
            .select('follower_id following_id createdAt')
            .maxTimeMS(queryTimeout)
            .lean()
            .exec()

          // 合併結果並去重
          const followsMap = new Map()
          followerFollows.forEach((follow) => {
            const key = `${follow.follower_id}-${follow.following_id}`
            followsMap.set(key, follow)
          })
          followingFollows.forEach((follow) => {
            const key = `${follow.follower_id}-${follow.following_id}`
            followsMap.set(key, follow)
          })
          follows = Array.from(followsMap.values())

          console.log(`查詢到 ${follows.length} 個追隨關係`)
        } catch (error) {
          // 使用新的錯誤處理工具
          const errorResult = handleQueryError(error, { userIdCount: validatedUserIds.length })

          console.error('查詢追隨關係失敗:', {
            error: error.message,
            stack: error.stack,
            userIdCount: validatedUserIds.length,
            errorType: errorResult.type,
            recoverable: errorResult.recoverable,
            suggestion: errorResult.suggestion,
          })

          // 如果查詢失敗，返回空的社交圖譜而不是拋出錯誤
          follows = []
        }

        // 建立社交圖譜
        const socialGraph = {}

        // 初始化用戶節點
        validatedUserIds.forEach((userId) => {
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
      },
      { ttl: COLLABORATIVE_CACHE_CONFIG.socialGraph },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log('從快取取得社交關係圖譜數據')
      return cacheResult.data
    }

    console.log('社交關係圖譜計算完成並已快取')
    return cacheResult.data
  } catch (error) {
    console.error('建立社交關係圖譜時發生錯誤:', error)
    // 返回空的社交圖譜而不是拋出錯誤，避免整個推薦系統崩潰
    return {}
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
export const findSocialSimilarUsers = async (
  targetUserId,
  socialGraph,
  minSimilarity = 0.1,
  maxUsers = 50,
) => {
  try {
    // 生成快取鍵
    const graphHash = Object.keys(socialGraph).sort().join('_')
    const cacheKey = `social_similar_users:${targetUserId}:${graphHash}:${minSimilarity}:${maxUsers}`

    // 嘗試從快取取得數據
    const cacheResult = await collaborativeCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log(`快取未命中，重新計算用戶 ${targetUserId} 的社交相似用戶...`)
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
      },
      { ttl: COLLABORATIVE_CACHE_CONFIG.socialSimilarUsers },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log(`從快取取得用戶 ${targetUserId} 的社交相似用戶數據`)
      return cacheResult.data
    }

    console.log(`社交相似用戶計算完成並已快取，用戶: ${targetUserId}`)
    return cacheResult.data
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
    // 新增：分頁和排除功能
    page = 1,
    excludeIds = [],
    // 新增：類型篩選功能
    type = 'all',
    types = [],
  } = options || {}

  try {
    console.log(`開始為用戶 ${targetUserId} 生成社交協同過濾推薦...`)

    // 生成快取鍵
    const excludeIdsKey = excludeIds.length > 0 ? excludeIds.sort().join('_') : 'none'
    const tagsKey = tags.length > 0 ? tags.sort().join('_') : 'none'
    const typesKey = types.length > 0 ? types.sort().join('_') : 'all'
    const cacheKey = `social_collaborative_recommendations:${targetUserId}:${limit}:${minSimilarity}:${maxSimilarUsers}:${excludeInteracted}:${includeHotScore}:${hotScoreWeight}:${tagsKey}:${page}:${excludeIdsKey}:${type}:${typesKey}`

    // 嘗試從快取取得數據
    const cacheResult = await collaborativeCacheProcessor.processWithVersion(
      cacheKey,
      async () => {
        console.log(`快取未命中，重新計算社交協同過濾推薦，用戶: ${targetUserId}...`)

        // 確保 targetUserId 是 ObjectId 格式
        const targetUserIdObj = safeToObjectId(targetUserId)
        if (!targetUserIdObj) {
          console.error(`無效的目標用戶ID格式: ${targetUserId}`)
          throw new Error(`無效的用戶ID格式: ${targetUserId}`)
        }

        // 建立互動矩陣和社交圖譜
        console.log('準備建立互動矩陣和社交圖譜，目標用戶ID:', targetUserIdObj.toString())

        // 先檢查資料庫連線健康狀態
        const isHealthy = await checkDatabaseHealth()
        if (!isHealthy) {
          console.log('資料庫連線異常，嘗試重新連線...')
          const reconnected = await reconnectDatabase()
          if (!reconnected) {
            console.error('無法恢復資料庫連線，使用備用推薦')
            // 返回熱門推薦作為備用
            const filter = { status: 'public' }
            if (tags && tags.length > 0) {
              filter.tags_cache = { $in: tags }
            }
            const hotMemes = await Meme.find(filter)
              .sort({ hot_score: -1 })
              .limit(parseInt(limit))
              .populate('author_id', 'username display_name avatar')
            return hotMemes.map((meme) => ({
              ...meme.toObject(),
              recommendation_score: meme.hot_score,
              recommendation_type: 'social_collaborative_fallback_db_error',
              social_collaborative_score: 0,
              similar_users_count: 0,
              social_influence_score: 0,
            }))
          }
        }

        const [interactionMatrix, socialGraph] = await Promise.all([
          buildInteractionMatrix([targetUserIdObj]).catch(async (error) => {
            console.error('建立互動矩陣時發生錯誤:', error)
            // 如果是連線超時錯誤，嘗試重連後重試一次
            if (error.message && error.message.includes('buffering timed out')) {
              console.log('檢測到資料庫連線超時，嘗試重新連線...')
              const reconnected = await reconnectDatabase()
              if (reconnected) {
                console.log('重新連線成功，重試建立互動矩陣...')
                try {
                  return await buildInteractionMatrix([targetUserIdObj])
                } catch (retryError) {
                  console.error('重試建立互動矩陣失敗:', retryError)
                }
              }
            }
            return {} // 返回空的互動矩陣而不是拋出錯誤
          }),
          buildSocialGraph([targetUserIdObj]).catch(async (error) => {
            console.error('建立社交圖譜時發生錯誤:', error)
            // 如果是連線超時錯誤，嘗試重連後重試一次
            if (error.message && error.message.includes('buffering timed out')) {
              console.log('檢測到資料庫連線超時，嘗試重新連線...')
              const reconnected = await reconnectDatabase()
              if (reconnected) {
                console.log('重新連線成功，重試建立社交圖譜...')
                try {
                  return await buildSocialGraph([targetUserIdObj])
                } catch (retryError) {
                  console.error('重試建立社交圖譜失敗:', retryError)
                }
              }
            }
            return {} // 返回空的社交圖譜而不是拋出錯誤
          }),
        ])

        // 如果目標用戶沒有互動歷史，返回熱門推薦
        if (
          !interactionMatrix[targetUserIdObj.toString()] ||
          Object.keys(interactionMatrix[targetUserIdObj.toString()]).length === 0
        ) {
          console.log('用戶沒有互動歷史，使用熱門推薦作為備選')
          const filter = { status: 'public' }

          // 如果有標籤篩選，加入標籤條件
          if (tags && tags.length > 0) {
            filter.tags_cache = { $in: tags }
          }

          // 新增：類型篩選功能
          if (types && types.length > 0) {
            if (types.length === 1) {
              filter.type = types[0] // 單一類型直接設置
            } else {
              filter.type = { $in: types } // 多個類型使用$in查詢
            }
          } else if (type && type !== 'all') {
            filter.type = type
          }

          // 如果有排除ID，加入查詢條件
          if (excludeIds && excludeIds.length > 0) {
            const validExcludeIds = excludeIds.map((id) => safeToObjectId(id)).filter(Boolean)
            if (validExcludeIds.length > 0) {
              filter._id = mongoose.trusted({ $nin: validExcludeIds })
            }
          }

          // 計算分頁，排除已載入的ID
          const totalLimit = parseInt(limit)
          const skipBase = (parseInt(page) - 1) * totalLimit
          const skip = Math.max(skipBase - (excludeIds ? excludeIds.length : 0), 0)

          const hotMemes = await Meme.find(filter)
            .setOptions({ sanitizeFilter: false })
            .sort({ hot_score: -1 })
            .skip(skip)
            .limit(totalLimit)
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
        const socialSimilarUsers = await findSocialSimilarUsers(
          targetUserIdObj.toString(),
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

          // 新增：類型篩選功能
          if (types && types.length > 0) {
            if (types.length === 1) {
              filter.type = types[0] // 單一類型直接設置
            } else {
              filter.type = mongoose.trusted({ $in: types }) // 多個類型使用$in查詢
            }
          } else if (type && type !== 'all') {
            filter.type = type
          }

          // 如果有排除ID，加入查詢條件
          if (excludeIds && excludeIds.length > 0) {
            const validExcludeIds = excludeIds.map((id) => safeToObjectId(id)).filter(Boolean)
            if (validExcludeIds.length > 0) {
              filter._id = mongoose.trusted({ $nin: validExcludeIds })
            }
          }

          // 計算分頁，排除已載入的ID
          const totalLimit = parseInt(limit)
          const skipBase = (parseInt(page) - 1) * totalLimit
          const skip = Math.max(skipBase - (excludeIds ? excludeIds.length : 0), 0)

          const hotMemes = await Meme.find(filter)
            .setOptions({ sanitizeFilter: false })
            .sort({ hot_score: -1 })
            .skip(skip)
            .limit(totalLimit)
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
        const targetUserInteractions = new Set(
          Object.keys(interactionMatrix[targetUserIdObj.toString()]),
        )

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

        // 確保所有推薦的 memeId 都是有效的 ObjectId
        const validRecommendations = recommendations.filter((r) => {
          const validMemeId = safeToObjectId(r.memeId)
          if (!validMemeId) {
            console.warn(`跳過無效的推薦迷因ID: ${r.memeId}`)
            return false
          }
          r.memeId = validMemeId.toString() // 統一轉換為字符串格式
          return true
        })

        if (validRecommendations.length === 0) {
          console.log('沒有有效的推薦迷因ID')
          return []
        }

        // 排除已顯示的項目
        let filteredRecommendations = validRecommendations
        if (excludeIds && excludeIds.length > 0) {
          const excludeSet = new Set(excludeIds.map((id) => id.toString()))
          filteredRecommendations = filteredRecommendations.filter(
            (rec) => !excludeSet.has(rec.memeId),
          )
        }

        // 計算分頁
        const skip = (parseInt(page) - 1) * parseInt(limit)
        const paginatedRecommendations = filteredRecommendations.slice(skip, skip + parseInt(limit))

        if (paginatedRecommendations.length === 0) {
          console.log('分頁後沒有推薦項目')
          return []
        }

        const validMemeIds = paginatedRecommendations.map(
          (r) => new mongoose.Types.ObjectId(r.memeId),
        )

        const filter = {
          _id: {
            $in: validMemeIds,
          },
          status: 'public',
        }

        // 如果有標籤篩選，加入標籤條件
        if (tags && tags.length > 0) {
          filter.tags_cache = { $in: tags }
        }

        // 新增：類型篩選功能
        if (types && types.length > 0) {
          if (types.length === 1) {
            filter.type = types[0] // 單一類型直接設置
          } else {
            filter.type = mongoose.trusted({ $in: types }) // 多個類型使用$in查詢
          }
        } else if (type && type !== 'all') {
          filter.type = type
        }

        // 取得迷因詳細資訊
        const memes = await Meme.find(filter)
          .setOptions({ sanitizeFilter: false })
          .populate('author_id', 'username display_name avatar')

        // 建立迷因ID到推薦數據的映射
        const recommendationMap = new Map()
        paginatedRecommendations.forEach((rec) => {
          recommendationMap.set(rec.memeId, rec)
        })

        // 組合最終推薦結果
        const finalRecommendations = memes.map((meme) => {
          const memeObj = meme.toObject()
          const memeIdStr = meme._id.toString()
          const recommendationData = recommendationMap.get(memeIdStr)

          if (!recommendationData) {
            console.warn(`找不到迷因 ${memeIdStr} 的推薦數據`)
            return {
              ...memeObj,
              recommendation_score: memeObj.hot_score || 0,
              recommendation_type: 'social_collaborative_fallback',
              social_collaborative_score: 0,
              similar_users_count: 0,
              average_similarity: 0,
              average_influence_score: 0,
            }
          }

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
            social_collaborative_score: recommendationData.socialCollaborativeScore || 0,
            similar_users_count: recommendationData.similarUsersCount || 0,
            average_similarity: recommendationData.averageSimilarity || 0,
            average_influence_score: recommendationData.averageInfluenceScore || 0,
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
      },
      { ttl: COLLABORATIVE_CACHE_CONFIG.socialCollaborativeRecommendations },
    )

    // 如果是從快取取得的數據，直接返回
    if (cacheResult.fromCache) {
      console.log(`從快取取得社交協同過濾推薦，用戶: ${targetUserId}`)
      return cacheResult.data
    }

    console.log(`社交協同過濾推薦計算完成並已快取，用戶: ${targetUserId}`)
    return cacheResult.data
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
    // 確保 userId 是 ObjectId 格式
    const userIdObj = safeToObjectId(userId)
    if (!userIdObj) {
      console.error(`無效的用戶ID格式: ${userId}`)
      throw new Error(`無效的用戶ID格式: ${userId}`)
    }
    const userIdStr = userIdObj.toString()

    const [interactionMatrix, socialGraph] = await Promise.all([
      buildInteractionMatrix([userIdObj]),
      buildSocialGraph([userIdObj]),
    ])

    const userInteractions = interactionMatrix[userIdStr] || {}
    const userSocialData = socialGraph[userIdStr] || {}

    const socialSimilarUsers = await findSocialSimilarUsers(userIdStr, socialGraph, 0.1, 100)

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
