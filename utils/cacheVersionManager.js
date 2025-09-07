/**
 * 快取版本管理器
 * 負責管理快取版本號，提供版本控制和快取失效功能
 * 支援語義化版本控制 (Semantic Versioning)
 */

import { logger } from './logger.js'
import redisCache from '../config/redis.js'

class CacheVersionManager {
  constructor(redisClient) {
    this.redis = redisClient
    this.versions = new Map()
    this.cachePrefix = 'cache_version:'
    this.versionRegex = /^(\d+)\.(\d+)\.(\d+)$/
  }

  /**
   * 取得快取版本號
   * @param {string} cacheKey - 快取鍵
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 false
   * @param {boolean} setDefaultOnMissing - 是否在版本不存在時設定預設版本，預設為 true
   * @returns {string} 版本號，預設為 '1.0.0'
   */
  async getVersion(cacheKey, throwOnError = false, setDefaultOnMissing = true) {
    try {
      const versionKey = `${this.cachePrefix}${cacheKey}`
      const version = await this.redis.get(versionKey)

      if (version && this.isValidVersion(version)) {
        return version
      }

      // 如果沒有版本號，且允許設定預設版本
      if (setDefaultOnMissing) {
        const defaultVersion = '1.0.0'
        await this.redis.set(versionKey, defaultVersion)
        return defaultVersion
      }

      return '1.0.0'
    } catch (error) {
      logger.error('取得快取版本失敗:', error)
      if (throwOnError) {
        throw error
      }
      return '1.0.0'
    }
  }

  /**
   * 更新快取版本號
   * @param {string} cacheKey - 快取鍵
   * @param {string} newVersion - 新版本號（可選）
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 true
   * @returns {string} 更新後的版本號
   */
  async updateVersion(cacheKey, newVersion = null, throwOnError = true) {
    try {
      const versionKey = `${this.cachePrefix}${cacheKey}`
      const currentVersion = await this.getVersion(cacheKey, throwOnError, false)

      let updatedVersion
      if (newVersion && this.isValidVersion(newVersion)) {
        updatedVersion = newVersion
      } else {
        updatedVersion = this.incrementVersion(currentVersion)
      }

      await this.redis.set(versionKey, updatedVersion)

      logger.debug(`快取版本更新: ${cacheKey} -> ${updatedVersion}`)
      return updatedVersion
    } catch (error) {
      logger.error('更新快取版本失敗:', error)
      if (throwOnError) {
        throw error
      }
      // 發生錯誤時，直接返回預設版本
      return '1.0.0'
    }
  }

  /**
   * 遞增版本號
   * @param {string} currentVersion - 當前版本號
   * @param {string} level - 遞增層級 (patch|minor|major)
   * @returns {string} 新的版本號
   */
  incrementVersion(currentVersion, level = 'patch') {
    try {
      const match = currentVersion.match(this.versionRegex)
      if (!match) {
        return '1.0.0'
      }

      let [major, minor, patch] = match.slice(1).map(Number)

      switch (level) {
        case 'major':
          major += 1
          minor = 0
          patch = 0
          break
        case 'minor':
          minor += 1
          patch = 0
          break
        case 'patch':
        default:
          patch += 1
          break
      }

      return `${major}.${minor}.${patch}`
    } catch (error) {
      logger.error('遞增版本號失敗:', error)
      return '1.0.0'
    }
  }

  /**
   * 比較兩個版本號
   * @param {string} version1 - 第一個版本號
   * @param {string} version2 - 第二個版本號
   * @returns {number} -1: version1 < version2, 0: version1 == version2, 1: version1 > version2
   */
  compareVersions(version1, version2) {
    try {
      const v1 = version1.match(this.versionRegex)
      const v2 = version2.match(this.versionRegex)

      if (!v1 || !v2) {
        return 0
      }

      const [major1, minor1, patch1] = v1.slice(1).map(Number)
      const [major2, minor2, patch2] = v2.slice(1).map(Number)

      if (major1 !== major2) return major1 > major2 ? 1 : -1
      if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1
      if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1

      return 0
    } catch (error) {
      logger.error('比較版本號失敗:', error)
      return 0
    }
  }

  /**
   * 驗證版本號格式
   * @param {string} version - 版本號
   * @returns {boolean} 是否為有效版本號
   */
  isValidVersion(version) {
    return this.versionRegex.test(version)
  }

  /**
   * 批量更新多個快取版本
   * @param {string[]} cacheKeys - 快取鍵列表
   * @param {string} level - 版本遞增層級
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 true
   * @returns {Object} 更新結果
   */
  async batchUpdateVersions(cacheKeys, level = 'patch', throwOnError = true) {
    try {
      const results = {}

      for (const cacheKey of cacheKeys) {
        const oldVersion = await this.getVersion(cacheKey, throwOnError, false)
        const newVersion = this.incrementVersion(oldVersion, level)
        await this.updateVersion(cacheKey, newVersion, throwOnError)

        results[cacheKey] = {
          old_version: oldVersion,
          new_version: newVersion,
        }
      }

      logger.info(`批量更新快取版本完成: ${cacheKeys.length} 個鍵`)
      return results
    } catch (error) {
      logger.error('批量更新快取版本失敗:', error)
      if (throwOnError) {
        throw error
      }
      return {}
    }
  }

  /**
   * 清除特定快取的版本資訊
   * @param {string} cacheKey - 快取鍵
   */
  async clearVersion(cacheKey) {
    try {
      const versionKey = `${this.cachePrefix}${cacheKey}`
      await this.redis.del(versionKey)
      logger.debug(`清除快取版本: ${cacheKey}`)
    } catch (error) {
      logger.error('清除快取版本失敗:', error)
    }
  }

  /**
   * 取得所有快取版本資訊
   * @returns {Object} 所有快取版本
   */
  async getAllVersions() {
    try {
      const pattern = `${this.cachePrefix}*`
      const keys = await this.redis.keys(pattern)
      const versions = {}

      for (const key of keys) {
        const cacheKey = key.replace(this.cachePrefix, '')
        versions[cacheKey] = await this.redis.get(key)
      }

      return versions
    } catch (error) {
      logger.error('取得所有快取版本失敗:', error)
      return {}
    }
  }

  /**
   * 重置所有快取版本為預設值
   */
  async resetAllVersions() {
    try {
      const versions = await this.getAllVersions()
      const defaultVersion = '1.0.0'

      for (const cacheKey of Object.keys(versions)) {
        await this.updateVersion(cacheKey, defaultVersion)
      }

      logger.info(`重置所有快取版本為 ${defaultVersion}`)
    } catch (error) {
      logger.error('重置所有快取版本失敗:', error)
    }
  }

  /**
   * 檢查快取是否過時
   * @param {string} cacheKey - 快取鍵
   * @param {string} clientVersion - 客戶端版本
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 false
   * @returns {boolean} 是否過時
   */
  async isCacheStale(cacheKey, clientVersion, throwOnError = false) {
    try {
      const serverVersion = await this.getVersion(cacheKey, true, false) // 總是拋出錯誤以便處理
      return this.compareVersions(serverVersion, clientVersion) > 0
    } catch (error) {
      logger.error('檢查快取是否過時失敗:', error)
      if (throwOnError) {
        throw error
      }
      // 如果無法獲取服務器版本，假設快取過時
      return true
    }
  }

  /**
   * 取得版本統計資訊
   * @returns {Object} 版本統計
   */
  async getVersionStats() {
    try {
      const allVersions = await this.getAllVersions()
      const stats = {
        total_cache_keys: Object.keys(allVersions).length,
        version_distribution: {},
        newest_versions: [],
        oldest_versions: [],
      }

      // 統計版本分佈
      Object.entries(allVersions).forEach(([cacheKey, version]) => {
        if (!stats.version_distribution[version]) {
          stats.version_distribution[version] = []
        }
        stats.version_distribution[version].push(cacheKey)
      })

      // 找出最新和最舊的版本
      const versionList = Object.keys(stats.version_distribution).sort((a, b) =>
        this.compareVersions(b, a),
      )

      if (versionList.length > 0) {
        stats.newest_versions = stats.version_distribution[versionList[0]] || []
        stats.oldest_versions =
          stats.version_distribution[versionList[versionList.length - 1]] || []
      }

      return stats
    } catch (error) {
      logger.error('取得版本統計失敗:', error)
      return { total_cache_keys: 0, version_distribution: {} }
    }
  }
}

// 建立單例實例
const cacheVersionManager = new CacheVersionManager(redisCache)

export default cacheVersionManager
export { CacheVersionManager }
