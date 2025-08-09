import Redis from 'ioredis'
import { logger } from '../utils/logger.js'

/**
 * Redis 快取配置
 */
class RedisCache {
  constructor() {
    this.client = null
    this.isConnected = false
    this.isEnabled = process.env.REDIS_ENABLED !== 'false' // 預設啟用，除非明確設為 false
  }

  /**
   * 初始化 Redis 連線
   */
  async connect() {
    // 如果明確停用 Redis，直接返回
    if (!this.isEnabled) {
      logger.info('Redis 已停用')
      return
    }

    try {
      // 優先使用 REDIS_URL，如果沒有則使用個別環境變數
      if (process.env.REDIS_URL) {
        this.client = new Redis(process.env.REDIS_URL, {
          lazyConnect: true,
          showFriendlyErrorStack: process.env.NODE_ENV === 'development',
          retryDelayOnFailover: 100,
          retryDelayOnClusterDown: 300,
          enableOfflineQueue: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          commandTimeout: 5000,
        })
        logger.info('使用 REDIS_URL 連線')
      } else {
        this.client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_DB || 0,
          lazyConnect: true,
          showFriendlyErrorStack: process.env.NODE_ENV === 'development',
          retryDelayOnFailover: 100,
          retryDelayOnClusterDown: 300,
          enableOfflineQueue: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          commandTimeout: 5000,
        })
        logger.info('使用個別環境變數連線')
      }

      this.client.on('connect', () => {
        this.isConnected = true
        logger.info('Redis 已連線')
      })

      this.client.on('error', (err) => {
        this.isConnected = false
        logger.error('Redis 連線錯誤:', err.message)
      })

      this.client.on('close', () => {
        this.isConnected = false
        logger.warn('Redis 連線已關閉')
      })

      // 使用超時機制避免掛起
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis連接超時')), 5000)),
      ])
    } catch (error) {
      logger.error('Redis 連線失敗:', error.message)
      this.isConnected = false
      // 不阻塞應用程式啟動
    }
  }

  /**
   * 設定快取
   * @param {string} key - 快取鍵
   * @param {any} value - 快取值
   * @param {number} ttl - 過期時間（秒）
   */
  async set(key, value, ttl = 3600) {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return false
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)
      await this.client.setex(key, ttl, serializedValue)
      return true
    } catch (error) {
      logger.error('Redis 設定快取失敗:', error)
      return false
    }
  }

  /**
   * 取得快取
   * @param {string} key - 快取鍵
   * @returns {any} 快取值
   */
  async get(key) {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return null
    }

    try {
      const value = await this.client.get(key)
      if (!value) return null

      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    } catch (error) {
      logger.error('Redis 取得快取失敗:', error)
      return null
    }
  }

  /**
   * 刪除快取
   * @param {string} key - 快取鍵
   */
  async del(key) {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return false
    }

    try {
      await this.client.del(key)
      return true
    } catch (error) {
      logger.error('Redis 刪除快取失敗:', error)
      return false
    }
  }

  /**
   * 批量刪除快取
   * @param {string} pattern - 快取鍵模式
   */
  async delPattern(pattern) {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return false
    }

    try {
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
      return true
    } catch (error) {
      logger.error('Redis 批量刪除快取失敗:', error)
      return false
    }
  }

  /**
   * 檢查快取是否存在
   * @param {string} key - 快取鍵
   */
  async exists(key) {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      logger.error('Redis 檢查快取失敗:', error)
      return false
    }
  }

  /**
   * 設定快取並返回 Promise
   * @param {string} key - 快取鍵
   * @param {Function} fetchFunction - 獲取數據的函數
   * @param {number} ttl - 過期時間（秒）
   */
  async getOrSet(key, fetchFunction, ttl = 3600) {
    try {
      // 嘗試從快取取得
      const cached = await this.get(key)
      if (cached !== null) {
        return cached
      }

      // 如果快取沒有，執行獲取函數
      const data = await fetchFunction()

      // 設定快取
      await this.set(key, data, ttl)

      return data
    } catch (error) {
      logger.error('Redis getOrSet 失敗:', error)
      // 如果快取出錯，直接執行獲取函數
      return await fetchFunction()
    }
  }

  /**
   * 關閉 Redis 連線
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit()
      this.isConnected = false
    }
  }

  /**
   * 取得快取統計
   */
  async getStats() {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return {
        connected: false,
        enabled: this.isEnabled,
        keys: 0,
        info: {},
      }
    }

    try {
      const info = await this.client.info()
      const keys = await this.client.dbsize()

      return {
        connected: this.isConnected,
        enabled: this.isEnabled,
        keys,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':')
          if (key && value) {
            acc[key] = value
          }
          return acc
        }, {}),
      }
    } catch (error) {
      logger.error('Redis 取得統計失敗:', error)
      return {
        connected: false,
        enabled: this.isEnabled,
        keys: 0,
        info: {},
      }
    }
  }

  /**
   * Redis ping 檢查
   * @returns {string|false} 如果成功返回 'PONG'，失敗返回 false
   */
  async ping() {
    if (!this.isEnabled || !this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.ping()
      return result
    } catch (error) {
      logger.error('Redis ping 失敗:', error)
      return false
    }
  }
}

// 創建單例實例
const redisCache = new RedisCache()

export default redisCache
