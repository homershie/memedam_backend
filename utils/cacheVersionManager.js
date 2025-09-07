import { logger } from './logger.js'

/**
 * 快取版本管理器 - 管理快取版本號以實現條件請求
 *
 * 結合了豐富功能和簡潔API設計的完整版本：
 * - 支援語義化版本控制 (Semantic Versioning)
 * - 記憶體快取優化提升效能
 * - 環境感知功能自動適應不同環境
 * - 豐富的高級功能（清除、重置、統計等）
 * - 統一的錯誤處理策略
 */
class CacheVersionManager {
  constructor(redisClient) {
    this.redis = redisClient
    this.versions = new Map() // 記憶體中的版本快取
    this.isEnabled = process.env.NODE_ENV !== 'test'
    this.cachePrefix = 'cache_version:'
    this.versionRegex = /^(\d+)\.(\d+)\.(\d+)$/
    this.defaultVersion = '1.0.0'
  }

  /**
   * 取得快取版本號
   * @param {string} cacheKey - 快取鍵
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 false
   * @param {boolean} setDefaultOnMissing - 是否在版本不存在時設定預設版本，預設為 true
   * @returns {Promise<string>} 版本號，格式為 semver (x.y.z)
   */
  async getVersion(cacheKey, throwOnError = false, setDefaultOnMissing = true) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return this.defaultVersion
    }

    // 先檢查記憶體快取（效能優化）
    if (this.versions.has(cacheKey)) {
      return this.versions.get(cacheKey)
    }

    try {
      const versionKey = `${this.cachePrefix}${cacheKey}`
      const version = await this.redis.get(versionKey)

      if (version && this.isValidVersion(version)) {
        // 快取到記憶體中以提升效能
        this.versions.set(cacheKey, version)
        return version
      }

      // 如果沒有版本號，且允許設定預設版本
      if (setDefaultOnMissing) {
        await this.redis.set(versionKey, this.defaultVersion)
        this.versions.set(cacheKey, this.defaultVersion)
        return this.defaultVersion
      }

      return this.defaultVersion
    } catch (error) {
      logger.error('取得快取版本失敗:', error)
      if (throwOnError) {
        throw error
      }
      return this.defaultVersion
    }
  }

  /**
   * 更新快取版本號（簡潔API版本）
   * @param {string} cacheKey - 快取鍵
   * @param {string} bumpType - 版本遞增類型 ('patch', 'minor', 'major')
   * @returns {Promise<string>} 新版本號
   */
  async updateVersion(cacheKey, bumpType = 'patch') {
    return await this.updateVersionAdvanced(cacheKey, null, bumpType, false)
  }

  /**
   * 更新快取版本號（高級API版本）
   * @param {string} cacheKey - 快取鍵
   * @param {string} newVersion - 新版本號（可選）
   * @param {string} bumpType - 版本遞增類型 (patch|minor|major)
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 true
   * @returns {Promise<string>} 更新後的版本號
   */
  async updateVersionAdvanced(
    cacheKey,
    newVersion = null,
    bumpType = 'patch',
    throwOnError = true,
  ) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return this.defaultVersion
    }

    try {
      const versionKey = `${this.cachePrefix}${cacheKey}`
      const currentVersion = await this.getVersion(cacheKey, throwOnError, false)

      let updatedVersion
      if (newVersion && this.isValidVersion(newVersion)) {
        updatedVersion = newVersion
      } else {
        updatedVersion = this.incrementVersion(currentVersion, bumpType)
      }

      await this.redis.set(versionKey, updatedVersion)

      // 更新記憶體快取
      this.versions.set(cacheKey, updatedVersion)

      logger.debug(`快取版本更新: ${cacheKey} ${currentVersion} -> ${updatedVersion}`)
      return updatedVersion
    } catch (error) {
      logger.error('更新快取版本失敗:', error)
      if (throwOnError) {
        throw error
      }
      return this.defaultVersion
    }
  }

  /**
   * 比較版本號
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
   * 檢查版本是否過期（簡潔API版本）
   * @param {string} cacheKey - 快取鍵
   * @param {string} clientVersion - 用戶端版本號
   * @returns {Promise<boolean>} true 如果版本過期
   */
  async isVersionStale(cacheKey, clientVersion) {
    return await this.isCacheStale(cacheKey, clientVersion, false)
  }

  /**
   * 檢查快取是否過時（高級API版本）
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
   * 批量更新多個快取鍵的版本（簡潔API版本）
   * @param {string[]} cacheKeys - 快取鍵陣列
   * @param {string} bumpType - 版本遞增類型
   * @returns {Promise<object>} 更新結果
   */
  async batchUpdateVersions(cacheKeys, bumpType = 'patch') {
    return await this.batchUpdateVersionsAdvanced(cacheKeys, bumpType, false)
  }

  /**
   * 批量更新多個快取鍵的版本（高級API版本）
   * @param {string[]} cacheKeys - 快取鍵列表
   * @param {string} level - 版本遞增層級
   * @param {boolean} throwOnError - 是否在遇到錯誤時拋出異常，預設為 true
   * @returns {Object} 更新結果
   */
  async batchUpdateVersionsAdvanced(cacheKeys, level = 'patch', throwOnError = true) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return { updated: 0, errors: [] }
    }

    try {
      const results = {}

      for (const cacheKey of cacheKeys) {
        const oldVersion = await this.getVersion(cacheKey, throwOnError, false)
        const newVersion = this.incrementVersion(oldVersion, level)
        await this.updateVersionAdvanced(cacheKey, newVersion, level, throwOnError)

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
   * 根據模式批量更新版本
   * @param {string} pattern - 快取鍵模式 (支援萬用字元)
   * @param {string} bumpType - 版本遞增類型
   * @returns {Promise<object>} 更新結果
   */
  async batchUpdateVersionsByPattern(pattern, bumpType = 'patch') {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return { updated: 0, errors: [] }
    }

    try {
      const keys = await this.redis.client.keys(pattern)
      const versionKeys = keys.filter((key) => !key.endsWith(':version'))

      return await this.batchUpdateVersions(versionKeys, bumpType)
    } catch (error) {
      logger.error('根據模式批量更新版本失敗:', error)
      return { updated: 0, errors: [{ pattern, error: error.message }] }
    }
  }

  /**
   * 清除記憶體中的版本快取
   * @param {string} cacheKey - 快取鍵，如果為空則清除所有
   */
  clearMemoryCache(cacheKey = null) {
    if (cacheKey) {
      this.versions.delete(cacheKey)
    } else {
      this.versions.clear()
    }
  }

  /**
   * 取得版本統計資訊
   * @returns {Promise<object>} 版本統計
   */
  async getVersionStats() {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return {
        total_cache_keys: 0,
        version_distribution: {},
        memory_cache_size: this.versions.size,
      }
    }

    try {
      const allVersions = await this.getAllVersions()
      const stats = {
        total_cache_keys: Object.keys(allVersions).length,
        version_distribution: {},
        newest_versions: [],
        oldest_versions: [],
        memory_cache_size: this.versions.size,
        memory_cache_keys: Array.from(this.versions.keys()),
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
      return {
        total_cache_keys: 0,
        version_distribution: {},
        memory_cache_size: this.versions.size,
        error: error.message,
      }
    }
  }

  /**
   * 清除特定快取的版本資訊
   * @param {string} cacheKey - 快取鍵
   */
  async clearVersion(cacheKey) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return
    }

    try {
      const versionKey = `${this.cachePrefix}${cacheKey}`
      await this.redis.del(versionKey)

      // 清除記憶體快取
      this.versions.delete(cacheKey)

      logger.debug(`清除快取版本: ${cacheKey}`)
    } catch (error) {
      logger.error('清除快取版本失敗:', error)
    }
  }

  /**
   * 取得所有快取版本資訊
   * @returns {Promise<object>} 所有快取版本
   */
  async getAllVersions() {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return {}
    }

    try {
      const pattern = `${this.cachePrefix}*`
      const keys = await this.redis.keys(pattern)
      const versions = {}

      for (const key of keys) {
        const cacheKey = key.replace(this.cachePrefix, '')
        const version = await this.redis.get(key)
        if (version) {
          versions[cacheKey] = version
        }
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
    if (!this.isEnabled || !this.redis?.isConnected) {
      return
    }

    try {
      const versions = await this.getAllVersions()

      for (const cacheKey of Object.keys(versions)) {
        await this.updateVersionAdvanced(cacheKey, this.defaultVersion, 'patch', false)

        // 更新記憶體快取
        this.versions.set(cacheKey, this.defaultVersion)
      }

      logger.info(`重置所有快取版本為 ${this.defaultVersion}`)
    } catch (error) {
      logger.error('重置所有快取版本失敗:', error)
    }
  }

  /**
   * 遞增版本號
   * @param {string} currentVersion - 當前版本號
   * @param {string} bumpType - 遞增類型 ('patch', 'minor', 'major')
   * @returns {string} 新版本號
   */
  incrementVersion(currentVersion, bumpType = 'patch') {
    const parts = currentVersion.split('.').map(Number)

    // 確保有三個部分
    while (parts.length < 3) {
      parts.push(0)
    }

    switch (bumpType) {
      case 'major':
        parts[0]++
        parts[1] = 0
        parts[2] = 0
        break
      case 'minor':
        parts[1]++
        parts[2] = 0
        break
      case 'patch':
      default:
        parts[2]++
        break
    }

    return parts.join('.')
  }

  /**
   * 清理過期的版本資料
   * @param {number} maxAge - 最大年齡（毫秒），預設 7 天
   */
  async cleanupExpiredVersions(maxAge = 7 * 24 * 60 * 60 * 1000) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return
    }

    try {
      // 這個功能需要額外的元資料來追蹤創建時間
      // 目前先記錄為未實作
      logger.debug(`版本清理功能待實作 (maxAge: ${maxAge}ms)`)
    } catch (error) {
      logger.error('清理過期版本失敗:', error)
    }
  }

  /**
   * 設定版本過期時間
   * @param {string} cacheKey - 快取鍵
   * @param {number} ttl - 版本過期時間（秒）
   */
  async setVersionTTL(cacheKey, ttl = 86400) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return
    }

    try {
      const versionKey = `${cacheKey}:version`
      await this.redis.client.expire(versionKey, ttl)
    } catch (error) {
      logger.error('設定版本 TTL 失敗:', error)
    }
  }

  /**
   * 檢查版本是否存在
   * @param {string} cacheKey - 快取鍵
   * @returns {Promise<boolean>} true 如果版本存在
   */
  async versionExists(cacheKey) {
    if (!this.isEnabled || !this.redis?.isConnected) {
      return false
    }

    try {
      const versionKey = `${cacheKey}:version`
      const exists = await this.redis.client.exists(versionKey)
      return exists === 1
    } catch (error) {
      logger.error('檢查版本存在失敗:', error)
      return false
    }
  }
}

// 創建單例實例
const cacheVersionManager = new CacheVersionManager()

export default cacheVersionManager
