import { logger } from './logger.js'
import cacheMonitor from './cacheMonitor.js'
import cacheVersionManager from './cacheVersionManager.js'

/**
 * 統一快取管理器 - 整合所有快取操作的統一介面
 */
class CacheManager {
  constructor(redisClient) {
    this.redis = redisClient
    this.monitor = cacheMonitor
    this.versionManager = cacheVersionManager
    this.isEnabled = process.env.NODE_ENV !== 'test'
    this.defaultTTL = 3600 // 預設 1 小時
  }

  /**
   * 取得或設定快取（核心方法）
   * @param {string} cacheKey - 快取鍵
   * @param {Function} fetchFunction - 獲取數據的函數
   * @param {object} options - 選項
   * @returns {Promise<any>} 快取的數據
   */
  async getOrSet(cacheKey, fetchFunction, options = {}) {
    const {
      ttl = this.defaultTTL,
      useVersion = false,
      clientVersion = null,
      skipCache = false,
      forceRefresh = false,
    } = options

    // 如果明確跳過快取，直接執行獲取函數
    if (skipCache || !this.isEnabled || !this.redis?.isConnected) {
      return await this.fetchAndCache(cacheKey, fetchFunction, ttl, false)
    }

    try {
      // 檢查版本控制
      if (useVersion && clientVersion) {
        const isStale = await this.versionManager.isVersionStale(cacheKey, clientVersion)
        if (isStale) {
          // 版本過期，記錄未命中並重新獲取
          this.monitor.recordMiss(cacheKey)
          return await this.fetchAndCache(cacheKey, fetchFunction, ttl, true)
        }
      }

      // 檢查強制重新整理
      if (forceRefresh) {
        return await this.fetchAndCache(cacheKey, fetchFunction, ttl, true)
      }

      // 嘗試從快取取得
      const cached = await this.redis.get(cacheKey)
      if (cached !== null) {
        this.monitor.recordHit(cacheKey)

        // 如果使用版本控制，附加版本資訊
        if (useVersion) {
          const version = await this.versionManager.getVersion(cacheKey)
          return {
            data: cached,
            version,
            fromCache: true,
          }
        }

        return cached
      }

      // 快取未命中
      this.monitor.recordMiss(cacheKey)
      return await this.fetchAndCache(cacheKey, fetchFunction, ttl, useVersion)
    } catch (error) {
      this.monitor.recordError('getOrSet', cacheKey, error)
      logger.error('CacheManager getOrSet 失敗:', error)

      // 快取操作失敗，直接執行獲取函數
      return await fetchFunction()
    }
  }

  /**
   * 僅從快取取得（不執行獲取函數）
   * @param {string} cacheKey - 快取鍵
   * @param {object} options - 選項
   * @returns {Promise<any>} 快取的數據或 null
   */
  async get(cacheKey, options = {}) {
    const { useVersion = false, clientVersion = null } = options

    if (!this.isEnabled || !this.redis?.isConnected) {
      return null
    }

    try {
      // 檢查版本控制
      if (useVersion && clientVersion) {
        const isStale = await this.versionManager.isVersionStale(cacheKey, clientVersion)
        if (isStale) {
          return null // 版本過期
        }
      }

      const cached = await this.redis.get(cacheKey)
      if (cached !== null) {
        this.monitor.recordHit(cacheKey)

        if (useVersion) {
          const version = await this.versionManager.getVersion(cacheKey)
          return {
            data: cached,
            version,
            fromCache: true,
          }
        }

        return cached
      }

      this.monitor.recordMiss(cacheKey)
      return null
    } catch (error) {
      this.monitor.recordError('get', cacheKey, error)
      return null
    }
  }

  /**
   * 設定快取
   * @param {string} cacheKey - 快取鍵
   * @param {any} value - 快取值
   * @param {object} options - 選項
   * @returns {Promise<boolean>} 是否成功
   */
  async set(cacheKey, value, options = {}) {
    const { ttl = this.defaultTTL, useVersion = false } = options

    if (!this.isEnabled || !this.redis?.isConnected) {
      return false
    }

    try {
      const success = await this.redis.set(cacheKey, value, ttl)

      if (success && useVersion) {
        // 更新版本號
        await this.versionManager.updateVersion(cacheKey, 'patch')
      }

      return success
    } catch (error) {
      this.monitor.recordError('set', cacheKey, error)
      return false
    }
  }

  /**
   * 刪除快取
   * @param {string} cacheKey - 快取鍵
   * @returns {Promise<boolean>} 是否成功
   */
  async del(cacheKey) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return false
    }

    try {
      // 刪除快取和版本資訊
      const result1 = await this.redis.del(cacheKey)
      const result2 = await this.redis.del(`${cacheKey}:version`)

      // 清除記憶體快取
      this.versionManager.clearMemoryCache(cacheKey)

      return result1 || result2
    } catch (error) {
      this.monitor.recordError('del', cacheKey, error)
      return false
    }
  }

  /**
   * 批量刪除快取
   * @param {string[]} cacheKeys - 快取鍵陣列
   * @returns {Promise<object>} 刪除結果
   */
  async delMulti(cacheKeys) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return { deleted: 0, errors: [] }
    }

    const results = { deleted: 0, errors: [] }

    for (const cacheKey of cacheKeys) {
      try {
        const success = await this.del(cacheKey)
        if (success) results.deleted++
      } catch (error) {
        results.errors.push({ key: cacheKey, error: error.message })
      }
    }

    return results
  }

  /**
   * 根據模式刪除快取
   * @param {string} pattern - 快取鍵模式
   * @returns {Promise<object>} 刪除結果
   */
  async delPattern(pattern) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return { deleted: 0, errors: [] }
    }

    try {
      const success = await this.redis.delPattern(pattern)
      return { deleted: success ? 1 : 0, errors: [] }
    } catch (error) {
      this.monitor.recordError('delPattern', pattern, error)
      return { deleted: 0, errors: [error.message] }
    }
  }

  /**
   * 更新快取版本
   * @param {string} cacheKey - 快取鍵
   * @param {string} bumpType - 版本遞增類型 ('patch', 'minor', 'major')
   * @returns {Promise<string>} 新版本號
   */
  async updateVersion(cacheKey, bumpType = 'patch') {
    return await this.versionManager.updateVersion(cacheKey, bumpType)
  }

  /**
   * 取得快取版本
   * @param {string} cacheKey - 快取鍵
   * @returns {Promise<string>} 版本號
   */
  async getVersion(cacheKey) {
    return await this.versionManager.getVersion(cacheKey)
  }

  /**
   * 檢查快取是否存在
   * @param {string} cacheKey - 快取鍵
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(cacheKey) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return false
    }

    try {
      return await this.redis.exists(cacheKey)
    } catch (error) {
      return false
    }
  }

  /**
   * 清除所有快取（危險操作）
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAll() {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return false
    }

    try {
      // 清除所有非版本鍵的快取
      const keys = await this.redis.client.keys('*')
      const nonVersionKeys = keys.filter((key) => !key.endsWith(':version'))

      if (nonVersionKeys.length > 0) {
        await this.redis.client.del(...nonVersionKeys)
      }

      // 清除記憶體快取
      this.versionManager.clearMemoryCache()

      logger.warn(`已清除所有快取，共 ${nonVersionKeys.length} 個鍵`)
      return true
    } catch (error) {
      logger.error('清除所有快取失敗:', error)
      return false
    }
  }

  /**
   * 取得快取統計資訊
   * @returns {Promise<object>} 統計資訊
   */
  async getStats() {
    const redisStats = await this.redis.getStats()
    const monitorStats = this.monitor.getStats()
    const versionStats = await this.versionManager.getVersionStats()

    return {
      redis: redisStats,
      monitor: monitorStats,
      version: versionStats,
      manager: {
        enabled: this.isEnabled,
        defaultTTL: this.defaultTTL,
      },
    }
  }

  /**
   * 取得效能報告
   * @returns {string} 格式化的效能報告
   */
  getPerformanceReport() {
    return this.monitor.getPerformanceReport()
  }

  /**
   * 重新連接 Redis
   * @returns {Promise<boolean>} 是否成功
   */
  async reconnect() {
    if (!this.redis) return false

    try {
      await this.redis.disconnect()
      await this.redis.connect()
      return this.redis.isConnected
    } catch (error) {
      logger.error('CacheManager 重新連接失敗:', error)
      return false
    }
  }

  /**
   * 關閉連線
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.disconnect()
    }
  }

  /**
   * 內部方法：獲取並快取數據
   * @private
   * @param {string} cacheKey - 快取鍵
   * @param {Function} fetchFunction - 獲取數據的函數
   * @param {number} ttl - 過期時間
   * @param {boolean} useVersion - 是否使用版本控制
   * @returns {Promise<any>} 獲取的數據
   */
  async fetchAndCache(cacheKey, fetchFunction, ttl, useVersion = false) {
    try {
      const data = await fetchFunction()

      if (data !== null && data !== undefined) {
        await this.redis.set(cacheKey, data, ttl)

        if (useVersion) {
          const version = await this.versionManager.updateVersion(cacheKey, 'patch')
          return {
            data,
            version,
            fromCache: false,
          }
        }
      }

      return data
    } catch (error) {
      logger.error('獲取並快取數據失敗:', error)
      throw error
    }
  }

  /**
   * 健康檢查
   * @returns {Promise<object>} 健康狀態
   */
  async healthCheck() {
    const redisPing = await this.redis.ping()

    return {
      status:
        this.isEnabled && this.redis.isConnected && redisPing === 'PONG' ? 'healthy' : 'unhealthy',
      redis: {
        enabled: this.redis.isEnabled,
        connected: this.redis.isConnected,
        ping: redisPing,
      },
      monitor: {
        enabled: this.monitor.isEnabled,
        metrics: this.monitor.metrics.size,
      },
      versionManager: {
        enabled: this.versionManager.isEnabled,
      },
    }
  }
}

// 創建單例實例
const cacheManager = new CacheManager()

export default cacheManager
