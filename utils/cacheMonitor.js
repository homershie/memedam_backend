import { logger } from './logger.js'

/**
 * 快取監控器 - 追蹤快取命中率和效能指標
 */
class CacheMonitor {
  constructor() {
    this.metrics = new Map()
    this.startTime = Date.now()
    this.isEnabled = process.env.NODE_ENV !== 'test' // 測試環境下預設停用
  }

  /**
   * 記錄快取命中
   * @param {string} cacheKey - 快取鍵
   */
  recordHit(cacheKey) {
    if (!this.isEnabled) return

    this.updateMetrics(cacheKey, 'hit')
  }

  /**
   * 記錄快取未命中
   * @param {string} cacheKey - 快取鍵
   */
  recordMiss(cacheKey) {
    if (!this.isEnabled) return

    this.updateMetrics(cacheKey, 'miss')
  }

  /**
   * 更新快取指標
   * @param {string} cacheKey - 快取鍵
   * @param {string} type - 指標類型 ('hit' 或 'miss')
   */
  updateMetrics(cacheKey, type) {
    if (!this.metrics.has(cacheKey)) {
      this.metrics.set(cacheKey, {
        hits: 0,
        misses: 0,
        lastAccess: Date.now(),
        firstAccess: Date.now(),
      })
    }

    const metric = this.metrics.get(cacheKey)
    metric[type + 's']++
    metric.lastAccess = Date.now()

    // 定期清理舊的指標（超過 24 小時未訪問）
    this.cleanupOldMetrics()
  }

  /**
   * 取得快取命中率
   * @param {string} cacheKey - 快取鍵，如果為空則返回整體命中率
   * @returns {number} 命中率 (0-100)
   */
  getHitRate(cacheKey = null) {
    if (cacheKey) {
      const metric = this.metrics.get(cacheKey)
      if (!metric) return 0

      const total = metric.hits + metric.misses
      return total > 0 ? (metric.hits / total) * 100 : 0
    } else {
      // 計算整體命中率
      let totalHits = 0
      let totalRequests = 0

      for (const metric of this.metrics.values()) {
        totalHits += metric.hits
        totalRequests += metric.hits + metric.misses
      }

      return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    }
  }

  /**
   * 取得快取統計資訊
   * @returns {object} 統計資訊
   */
  getStats() {
    const stats = {
      overall: {
        hitRate: this.getHitRate(),
        totalKeys: this.metrics.size,
        uptime: Date.now() - this.startTime,
      },
      topKeys: [],
      summary: {
        totalHits: 0,
        totalMisses: 0,
        totalRequests: 0,
      },
    }

    // 計算總計並找出最活躍的鍵
    const keyStats = []
    for (const [key, metric] of this.metrics.entries()) {
      const total = metric.hits + metric.misses
      stats.summary.totalHits += metric.hits
      stats.summary.totalMisses += metric.misses
      stats.summary.totalRequests += total

      keyStats.push({
        key,
        hitRate: total > 0 ? (metric.hits / total) * 100 : 0,
        hits: metric.hits,
        misses: metric.misses,
        total,
        lastAccess: metric.lastAccess,
      })
    }

    // 排序並取前 10 個最活躍的鍵
    stats.topKeys = keyStats.sort((a, b) => b.total - a.total).slice(0, 10)

    return stats
  }

  /**
   * 取得特定快取鍵的詳細資訊
   * @param {string} cacheKey - 快取鍵
   * @returns {object|null} 鍵的詳細資訊
   */
  getKeyStats(cacheKey) {
    const metric = this.metrics.get(cacheKey)
    if (!metric) return null

    const total = metric.hits + metric.misses
    return {
      key: cacheKey,
      hitRate: total > 0 ? (metric.hits / total) * 100 : 0,
      hits: metric.hits,
      misses: metric.misses,
      total,
      lastAccess: metric.lastAccess,
      firstAccess: metric.firstAccess,
      age: Date.now() - metric.firstAccess,
    }
  }

  /**
   * 清理舊的指標資料
   * @param {number} maxAge - 最大年齡（毫秒），預設 24 小時
   */
  cleanupOldMetrics(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now()
    const keysToDelete = []

    for (const [key, metric] of this.metrics.entries()) {
      if (now - metric.lastAccess > maxAge) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => {
      this.metrics.delete(key)
    })

    if (keysToDelete.length > 0) {
      logger.debug(`清理了 ${keysToDelete.length} 個過期的快取指標`)
    }
  }

  /**
   * 重置所有指標
   */
  reset() {
    this.metrics.clear()
    this.startTime = Date.now()
    logger.info('快取監控指標已重置')
  }

  /**
   * 啟用/停用監控
   * @param {boolean} enabled - 是否啟用監控
   */
  setEnabled(enabled) {
    this.isEnabled = enabled
    logger.info(`快取監控已${enabled ? '啟用' : '停用'}`)
  }

  /**
   * 記錄快取操作錯誤
   * @param {string} operation - 操作類型
   * @param {string} cacheKey - 快取鍵
   * @param {Error} error - 錯誤物件
   */
  recordError(operation, cacheKey, error) {
    if (!this.isEnabled) return

    logger.warn(`快取操作錯誤: ${operation} - ${cacheKey}`, {
      operation,
      cacheKey,
      error: error.message,
      stack: error.stack,
    })
  }

  /**
   * 取得效能報告
   * @returns {string} 格式化的效能報告
   */
  getPerformanceReport() {
    const stats = this.getStats()
    const uptimeHours = Math.round((stats.overall.uptime / (1000 * 60 * 60)) * 10) / 10

    let report = `=== 快取效能報告 ===\n`
    report += `運行時間: ${uptimeHours} 小時\n`
    report += `整體命中率: ${stats.overall.hitRate.toFixed(2)}%\n`
    report += `監控鍵數量: ${stats.overall.totalKeys}\n`
    report += `總請求數: ${stats.summary.totalRequests}\n`
    report += `總命中數: ${stats.summary.totalHits}\n`
    report += `總未命中數: ${stats.summary.totalMisses}\n\n`

    if (stats.topKeys.length > 0) {
      report += `最活躍的快取鍵:\n`
      stats.topKeys.slice(0, 5).forEach((key, index) => {
        report += `${index + 1}. ${key.key}\n`
        report += `   命中率: ${key.hitRate.toFixed(2)}% (${key.hits}/${key.total})\n`
      })
    }

    return report
  }
}

// 創建單例實例
const cacheMonitor = new CacheMonitor()

export default cacheMonitor
