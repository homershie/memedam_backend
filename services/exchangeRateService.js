import integratedCache from '../config/cache.js'
import { logger } from '../utils/logger.js'
import fetch from 'node-fetch'

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
   * 從台灣央行API獲取匯率
   */
  async fetchFromExternalAPI(fromCurrency, toCurrency) {
    try {
      // 台灣央行API基礎資訊

      // 根據幣別對選擇適當的項目代號
      let fileName = null
      let rateField = null

      // 處理不同幣別對的映射
      if (
        (fromCurrency === 'USD' && toCurrency === 'TWD') ||
        (fromCurrency === 'TWD' && toCurrency === 'USD')
      ) {
        // 美元對新台幣
        fileName = 'EG51D01' // 美元即期匯率日資料
        rateField = '即期匯率'
      } else if (fromCurrency === 'USD' || toCurrency === 'USD') {
        // 其他幣別對美元
        fileName = 'BP01D01' // 我國與主要貿易對手通貨對美元之匯率日資料
        rateField = '匯率'
      } else {
        // 跨幣別轉換：先轉換為美元，再轉換到目標幣別
        const toUSDRate = await this.fetchRateFromCB(fromCurrency, 'USD')
        if (!toUSDRate) return null

        const fromUSDRate = await this.fetchRateFromCB('USD', toCurrency)
        if (!fromUSDRate) return null

        return toUSDRate / fromUSDRate
      }

      return await this.fetchRateFromCB(fromCurrency, toCurrency, fileName, rateField)
    } catch (error) {
      logger.error('從台灣央行API獲取匯率失敗:', error)
      return null
    }
  }

  /**
   * 從台灣央行API獲取特定匯率
   */
  async fetchRateFromCB(fromCurrency, toCurrency, fileName = null) {
    try {
      const baseURL = 'https://cpx.cbc.gov.tw/API/DataAPI/Get'

      // 如果沒有指定項目代號，自動選擇
      if (!fileName) {
        if (
          (fromCurrency === 'USD' && toCurrency === 'TWD') ||
          (fromCurrency === 'TWD' && toCurrency === 'USD')
        ) {
          fileName = 'EG51D01'
        } else {
          fileName = 'BP01D01'
        }
      }

      const apiURL = `${baseURL}?FileName=${fileName}`
      logger.info(`調用台灣央行API: ${apiURL}`)

      const response = await fetch(apiURL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Memedam-Backend/1.0',
        },
        timeout: 10000, // 10秒超時
      })

      if (!response.ok) {
        throw new Error(`央行API回應錯誤: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // 解析央行API的實際資料格式
      if (!data.data || !data.data.length) {
        logger.warn('央行API返回空資料')
        return null
      }

      // 央行API的資料結構：
      // data[0] 是匯率資料陣列
      // data[1] 是資料結構定義
      const exchangeData = data.data[0] // 實際的匯率資料

      if (!exchangeData || !exchangeData.length) {
        logger.warn('央行API匯率資料為空')
        return null
      }

      // 找到最新的匯率資料（通常是陣列的第一筆）
      const latestData = exchangeData[0] // 格式: [日期, 買進, 賣出, 收盤, 日平均, 遠期利率]

      logger.debug('最新央行匯率資料:', latestData)

      // 根據幣別對提取匯率
      let rate = null

      if (fileName === 'EG51D01' && fromCurrency === 'USD' && toCurrency === 'TWD') {
        // 美元對新台幣匯率
        // 使用日平均匯率 (第4個欄位，索引3)
        const avgRate = parseFloat(latestData[3]) // 日平均匯率
        if (avgRate > 0) {
          rate = avgRate
          logger.info(`從央行API獲取 USD/TWD 匯率: ${rate} (日平均)`)
        }
      } else if (fileName === 'BP01D01') {
        // 其他幣別對美元匯率
        // BP01D01 包含多種幣別對美元的匯率
        logger.warn('BP01D01 格式需要額外處理，目前使用備用匯率')
        return null // 暫時返回null，使用備用匯率
      }

      if (rate && rate > 0) {
        // 如果是反向轉換（TWD到USD），需要取倒數
        if (fromCurrency === 'TWD' && toCurrency === 'USD') {
          rate = 1 / rate
          logger.info(`從央行API獲取 TWD/USD 匯率: ${rate} (反向計算)`)
        }

        logger.info(`從央行API獲取匯率成功: ${fromCurrency}/${toCurrency} = ${rate}`)
        return rate
      }

      logger.warn(`無法從央行API提取匯率: ${fromCurrency}/${toCurrency}`)
      return null
    } catch (error) {
      logger.error('調用台灣央行API失敗:', error)
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
