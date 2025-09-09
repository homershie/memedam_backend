import integratedCache from '../config/cache.js'
import { logger } from '../utils/logger.js'

/**
 * 匯率快取服務
 * 負責管理匯率的快取、更新和獲取
 */
class ExchangeRateService {
  constructor() {
    this.cachePrefix = 'exchange_rate'
    this.defaultCacheTime = 86400 // 24小時
    this.fallbackRates = this.getFallbackRates()

    // 支援的幣別清單
    this.supportedCurrencies = [
      'USD',
      'TWD',
      'HKD',
      'MOP',
      'JPY',
      'CNY',
      'SGD',
      'KRW',
      'THB',
      'IDR',
      'PHP',
      'VND',
      'MYR',
      'CAD',
      'AUD',
      'EUR',
      'GBP',
    ]
  }

  /**
   * 獲取靜態備用匯率（當外部API不可用時使用）
   */
  getFallbackRates() {
    return {
      // 東亞、中文圈國家
      TWD: 1 / 32.5, // 新台幣 (1 TWD ≈ 0.0308 USD)
      HKD: 1 / 7.8, // 港幣 (1 HKD ≈ 0.1282 USD)
      MOP: 1 / 8.0, // 澳門幣 (1 MOP ≈ 0.125 USD)
      JPY: 1 / 150, // 日幣 (1 JPY ≈ 0.0067 USD)
      CNY: 1 / 7.2, // 人民幣 (1 CNY ≈ 0.1389 USD)
      SGD: 1 / 1.35, // 新加坡幣 (1 SGD ≈ 0.7407 USD)
      KRW: 1 / 1350, // 韓幣 (1 KRW ≈ 0.00074 USD)

      // 東南亞國家
      THB: 1 / 36.5, // 泰銖 (1 THB ≈ 0.0274 USD)
      IDR: 1 / 15500, // 印尼盾 (1 IDR ≈ 0.0000645 USD)
      PHP: 1 / 56.0, // 菲律賓比索 (1 PHP ≈ 0.01786 USD)
      VND: 1 / 23000, // 越南盾 (1 VND ≈ 0.0000435 USD)
      MYR: 1 / 4.5, // 馬來西亞令吉 (1 MYR ≈ 0.2222 USD)

      // 美加等國
      USD: 1, // 美元 (基準幣別)
      CAD: 0.73, // 加幣 (1 CAD ≈ 0.73 USD)
      AUD: 0.65, // 澳幣 (1 AUD ≈ 0.65 USD)

      // 歐洲主要貨幣
      EUR: 1.08, // 歐元 (1 EUR ≈ 1.08 USD)
      GBP: 1.27, // 英鎊 (1 GBP ≈ 1.27 USD)
    }
  }

  /**
   * 獲取快取鍵名
   */
  getCacheKey(fromCurrency, toCurrency) {
    return `${this.cachePrefix}:${fromCurrency}:${toCurrency}`
  }

  /**
   * 從快取獲取匯率
   */
  async getCachedRate(fromCurrency, toCurrency) {
    try {
      const cacheKey = this.getCacheKey(fromCurrency, toCurrency)
      const cachedValue = await integratedCache.get(cacheKey)

      if (cachedValue && new Date(cachedValue.expires_at) > new Date()) {
        logger.debug(`從快取取得匯率: ${fromCurrency} -> ${toCurrency} = ${cachedValue.rate}`)
        return cachedValue.rate
      } else if (cachedValue) {
        logger.debug(`快取匯率已過期: ${cacheKey}`)
        // 清除過期的快取
        await integratedCache.del(cacheKey)
      }

      return null
    } catch (error) {
      logger.warn('從快取獲取匯率失敗:', error)
      return null
    }
  }

  /**
   * 將匯率存入快取
   */
  async setCachedRate(fromCurrency, toCurrency, rate, ttl = this.defaultCacheTime) {
    try {
      const cacheKey = this.getCacheKey(fromCurrency, toCurrency)
      const cacheValue = {
        rate: rate,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
      }

      // 直接傳遞物件給 CacheManager，讓它處理序列化
      const success = await integratedCache.set(cacheKey, cacheValue, { ttl })
      if (success) {
        logger.debug(`匯率已快取: ${fromCurrency} -> ${toCurrency} = ${rate} (TTL: ${ttl}s)`)
        return true
      } else {
        logger.error('快取匯率失敗: set 方法返回 false')
        return false
      }
    } catch (error) {
      logger.error('快取匯率失敗:', error)
      return false
    }
  }

  /**
   * 從外部API獲取匯率（模擬）
   * 實際應用中應該調用真實的匯率API，如：
   * - Fixer API
   * - ExchangeRate-API
   * - CurrencyAPI
   * - 中央銀行API
   */
  async fetchFromExternalAPI(fromCurrency, toCurrency) {
    try {
      // 模擬API調用延遲
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 在實際應用中，這裡會調用真實的API
      // 例如：
      // const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`)
      // const data = await response.json()
      // return data.rates[toCurrency]

      // 目前使用備用匯率模擬API回應
      if (fromCurrency === 'USD') {
        return this.fallbackRates[toCurrency] || null
      } else if (toCurrency === 'USD') {
        return this.fallbackRates[fromCurrency] || null
      } else {
        // 跨幣別轉換：X -> USD -> Y
        const toUSD = this.fallbackRates[fromCurrency]
        const fromUSD = this.fallbackRates[toCurrency]
        return toUSD / fromUSD
      }
    } catch (error) {
      logger.error('從外部API獲取匯率失敗:', error)
      return null
    }
  }

  /**
   * 獲取匯率（主要入口點）
   * 實現快取優先策略：
   * 1. 先檢查快取
   * 2. 快取失效時從外部API獲取
   * 3. API失敗時使用備用匯率
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // 驗證幣別支援
      if (
        !this.supportedCurrencies.includes(fromCurrency) ||
        !this.supportedCurrencies.includes(toCurrency)
      ) {
        logger.warn(`不支援的幣別: ${fromCurrency} 或 ${toCurrency}`)
        return null
      }

      // 如果是相同幣別，直接返回1
      if (fromCurrency === toCurrency) {
        return 1
      }

      // 1. 嘗試從快取獲取
      let rate = await this.getCachedRate(fromCurrency, toCurrency)
      if (rate !== null) {
        logger.debug(`快取命中: ${fromCurrency} -> ${toCurrency} = ${rate}`)
        return rate
      }

      // 2. 快取失效，從外部API獲取
      logger.info(`從API獲取匯率: ${fromCurrency} -> ${toCurrency}`)
      rate = await this.fetchFromExternalAPI(fromCurrency, toCurrency)

      if (rate !== null) {
        // 快取成功獲取的匯率
        const cached = await this.setCachedRate(fromCurrency, toCurrency, rate)
        if (!cached) {
          logger.warn(`快取匯率失敗，但仍返回結果: ${fromCurrency} -> ${toCurrency} = ${rate}`)
        }
        return rate
      }

      // 3. API失敗，使用備用匯率
      logger.warn(`使用備用匯率: ${fromCurrency} -> ${toCurrency}`)
      if (fromCurrency === 'USD') {
        rate = this.fallbackRates[toCurrency]
      } else if (toCurrency === 'USD') {
        rate = this.fallbackRates[fromCurrency]
      } else {
        // 跨幣別轉換
        const toUSD = this.fallbackRates[fromCurrency]
        const fromUSD = this.fallbackRates[toCurrency]
        rate = toUSD / fromUSD
      }

      if (rate) {
        // 即使使用備用匯率也要快取（短時間）
        const cached = await this.setCachedRate(fromCurrency, toCurrency, rate, 3600) // 1小時
        if (!cached) {
          logger.warn(`快取備用匯率失敗: ${fromCurrency} -> ${toCurrency} = ${rate}`)
        }
        return rate
      }

      logger.error(`無法獲取匯率: ${fromCurrency} -> ${toCurrency}`)
      return null
    } catch (error) {
      logger.error('獲取匯率時發生錯誤:', error)
      return null
    }
  }

  /**
   * 批量獲取匯率
   */
  async getExchangeRates(pairs) {
    const results = {}

    for (const pair of pairs) {
      const { from, to } = pair
      const rate = await this.getExchangeRate(from, to)
      results[`${from}_${to}`] = rate
    }

    return results
  }

  /**
   * 清除特定幣別對的快取
   */
  async clearCache(fromCurrency, toCurrency) {
    try {
      const cacheKey = this.getCacheKey(fromCurrency, toCurrency)
      const success = await integratedCache.del(cacheKey)
      if (success) {
        logger.info(`已清除匯率快取: ${fromCurrency} -> ${toCurrency}`)
      } else {
        logger.warn(`清除匯率快取失敗或快取不存在: ${fromCurrency} -> ${toCurrency}`)
      }
      return success
    } catch (error) {
      logger.error('清除匯率快取失敗:', error)
      return false
    }
  }

  /**
   * 清除所有匯率快取
   */
  async clearAllCache() {
    try {
      // 注意：Redis 不支援原生 pattern 刪除，需要手動獲取所有鍵然後刪除
      // 在實際應用中，可能需要使用 Redis SCAN 或 KEYS 命令
      // 這裡先實作簡單版本，未來可以優化
      logger.warn('clearAllCache 方法尚未完整實作，建議手動清除或使用特定鍵清除')
      return false
    } catch (error) {
      logger.error('清除所有匯率快取失敗:', error)
      return false
    }
  }

  /**
   * 手動更新匯率
   */
  async updateExchangeRate(fromCurrency, toCurrency, newRate, ttl = this.defaultCacheTime) {
    try {
      const success = await this.setCachedRate(fromCurrency, toCurrency, newRate, ttl)
      if (success) {
        logger.info(`手動更新匯率: ${fromCurrency} -> ${toCurrency} = ${newRate}`)
      } else {
        logger.error('手動更新匯率失敗: setCachedRate 返回 false')
      }
      return success
    } catch (error) {
      logger.error('手動更新匯率失敗:', error)
      return false
    }
  }

  /**
   * 獲取快取統計資訊
   */
  async getCacheStats() {
    try {
      // 這裡可以實作快取統計收集邏輯
      // 例如：快取命中率、快取項目數量等
      return {
        supported_currencies: this.supportedCurrencies.length,
        cache_prefix: this.cachePrefix,
        default_ttl: this.defaultCacheTime,
      }
    } catch (error) {
      logger.error('獲取快取統計失敗:', error)
      return null
    }
  }

  /**
   * 重新載入備用匯率
   */
  reloadFallbackRates() {
    this.fallbackRates = this.getFallbackRates()
    logger.info('已重新載入備用匯率')
  }

  /**
   * 檢查幣別是否支援
   */
  isCurrencySupported(currency) {
    return this.supportedCurrencies.includes(currency)
  }
}

// 導出單例實例
export default new ExchangeRateService()
