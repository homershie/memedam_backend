import redisCache from './redis.js'
import cacheManager from '../utils/cacheManager.js'
import cacheMonitor from '../utils/cacheMonitor.js'
import cacheVersionManager from '../utils/cacheVersionManager.js'
import { logger } from '../utils/logger.js'

/**
 * 整合快取系統配置
 * 橋接現有的 RedisCache 和新的統一快取管理器
 */
class IntegratedCache {
  constructor() {
    this.redis = redisCache
    this.manager = cacheManager
    this.monitor = cacheMonitor
    this.versionManager = cacheVersionManager

    // 初始化 CacheManager 的 Redis 實例
    this.manager.redis = this.redis
    this.versionManager.redis = this.redis

    logger.info('整合快取系統已初始化')
  }

  /**
   * 初始化快取系統
   */
  async initialize() {
    try {
      await this.redis.connect()

      // 設定版本管理器的 Redis 實例
      this.versionManager.redis = this.redis
      // 設定快取管理器的 Redis 實例
      this.manager.redis = this.redis

      logger.info('整合快取系統初始化成功')
      return true
    } catch (error) {
      logger.error('整合快取系統初始化失敗:', error)
      return false
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck() {
    const redisHealth = {
      enabled: this.redis.isEnabled,
      connected: this.redis.isConnected,
    }

    const managerHealth = await this.manager.healthCheck()

    return {
      integrated: true,
      redis: redisHealth,
      manager: managerHealth,
      overall:
        redisHealth.connected && managerHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
    }
  }

  /**
   * 取得統計資訊
   */
  async getStats() {
    try {
      const redisStats = await this.redis.getStats()
      const managerStats = await this.manager.getStats()

      return {
        integrated: true,
        redis: redisStats,
        manager: managerStats,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      logger.error('取得整合快取統計失敗:', error)
      return {
        integrated: true,
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * 取得效能報告
   */
  getPerformanceReport() {
    return this.manager.getPerformanceReport()
  }

  /**
   * 重新連接
   */
  async reconnect() {
    return await this.manager.reconnect()
  }

  /**
   * 關閉連線
   */
  async disconnect() {
    await this.manager.disconnect()
  }

  /**
   * 清除所有快取
   */
  async clearAll() {
    return await this.manager.clearAll()
  }

  /**
   * 設定快取
   * @param {string} cacheKey - 快取鍵
   * @param {any} value - 快取值
   * @param {object} options - 選項
   * @returns {Promise<boolean>} 是否成功
   */
  async set(cacheKey, value, options = {}) {
    const { ttl = 3600, useVersion = false } = options
    return await this.manager.set(cacheKey, value, { ttl, useVersion })
  }

  /**
   * 取得快取
   * @param {string} cacheKey - 快取鍵
   * @param {object} options - 選項
   * @returns {Promise<any>} 快取值
   */
  async get(cacheKey, options = {}) {
    const { useVersion = false, clientVersion = null } = options
    return await this.manager.get(cacheKey, { useVersion, clientVersion })
  }

  /**
   * 刪除快取鍵
   * @param {string} cacheKey - 要刪除的快取鍵
   * @param {boolean} throwOnError - 錯誤時是否拋出異常
   */
  async del(cacheKey, throwOnError = false) {
    return await this.manager.del(cacheKey, throwOnError)
  }
}

// 創建單例實例
const integratedCache = new IntegratedCache()

// 匯出整合快取系統的各個組件
export default integratedCache
export { redisCache, cacheManager, cacheMonitor, cacheVersionManager }
