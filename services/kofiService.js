import { logger } from '../utils/logger.js'
import integratedCache from '../config/cache.js'
import notificationQueue from './notificationQueue.js'
import currency from 'currency.js'
import exchangeRateService from './exchangeRateService.js'

/**
 * Ko-fi 服務類
 * 處理 Ko-fi Webhook 相關的業務邏輯
 */
class KofiService {
  constructor() {
    this.SPONSOR_LEVELS = {
      soy: { amount: 1, name: '豆漿贊助', badge: '🥛' }, // 1 USD
      chicken: { amount: 2, name: '雞肉贊助', badge: '🐔' }, // 2 USD
      coffee: { amount: 5, name: '咖啡贊助', badge: '☕' }, // 5 USD
    }
  }

  /**
   * 根據商品代碼取得贊助等級資訊
   * @param {string} directLinkCode - 商品代碼
   * @returns {Object|null} 贊助等級資訊或 null
   */
  getSponsorLevelInfo(directLinkCode) {
    // 直接使用已建立的商品代碼
    switch (directLinkCode) {
      case 'c4043b71a4':
        return this.SPONSOR_LEVELS.soy
      case 'b7e4575bf6':
        return this.SPONSOR_LEVELS.chicken
      case '25678099a7':
        return this.SPONSOR_LEVELS.coffee
      default:
        return null
    }
  }

  /**
   * 更新用戶個人資料
   * @param {string} userId - 用戶 ID
   * @param {Object} kofiData - Ko-fi Webhook 資料
   * @param {Object} session - MongoDB session
   */
  async updateUserProfile(userId, kofiData, session = null) {
    try {
      const User = (await import('../models/User.js')).default

      // 準備要更新的數據
      const updateData = {}

      // 如果 Ko-fi 提供了 display_name，且用戶當前的 display_name 為空或不同，則更新
      if (kofiData.display_name && kofiData.display_name.trim()) {
        const currentUser = await User.findById(userId).select('display_name').session(session)
        if (!currentUser.display_name || currentUser.display_name.trim() === '') {
          updateData.display_name = kofiData.display_name.trim()
        }
      }

      // 如果 Ko-fi 提供了 from_name 作為備選，且 display_name 為空
      if (!updateData.display_name && kofiData.from_name && kofiData.from_name.trim()) {
        const currentUser = await User.findById(userId).select('display_name').session(session)
        if (!currentUser.display_name || currentUser.display_name.trim() === '') {
          updateData.display_name = kofiData.from_name.trim()
        }
      }

      // 如果有數據要更新
      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(userId, updateData, { session })

        logger.info('用戶個人資料已更新', {
          userId,
          updatedFields: Object.keys(updateData),
          newDisplayName: updateData.display_name || '未更新',
        })
      } else {
        logger.debug('用戶個人資料無需更新', { userId })
      }
    } catch (error) {
      logger.error('更新用戶個人資料失敗:', error)
      // 不拋出錯誤，因為這不應該影響主要的贊助處理流程
    }
  }

  /**
   * 更新用戶贊助統計
   * @param {string} userId - 用戶 ID
   * @param {Object} sponsorData - 贊助資料
   * @param {Object} session - MongoDB session
   */
  async updateUserSponsorStats(userId, sponsorData, session = null) {
    try {
      let User, Sponsor
      try {
        User = (await import('../models/User.js')).default
        Sponsor = (await import('../models/Sponsor.js')).default
      } catch (importError) {
        logger.warn('模型導入失敗，跳過用戶統計更新', { userId, error: importError.message })
        return // 在測試環境中，跳過這個操作
      }

      // 計算用戶總贊助金額
      const totalAmount = await Sponsor.aggregate(
        [
          { $match: { user_id: userId, status: 'success' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ],
        { session },
      )

      const totalSponsorAmount = totalAmount[0]?.total || 0

      // 計算獲得的徽章
      const earnedBadges = await Sponsor.distinct(
        'sponsor_level',
        {
          user_id: userId,
          status: 'success',
          badge_earned: true,
        },
        { session },
      )

      // 更新用戶統計
      await User.findByIdAndUpdate(
        userId,
        {
          total_sponsor_amount: totalSponsorAmount,
          earned_sponsor_badges: earnedBadges,
          last_sponsor_at: new Date(),
          sponsor_count: await Sponsor.countDocuments(
            {
              user_id: userId,
              status: 'success',
            },
            { session },
          ),
        },
        { session },
      )

      logger.info('用戶贊助統計已更新', {
        userId,
        totalAmount: totalSponsorAmount,
        badges: earnedBadges,
      })
    } catch (error) {
      logger.error('更新用戶贊助統計失敗:', error)
      throw error
    }
  }

  /**
   * 發送贊助通知
   * @param {Object} sponsor - 贊助記錄
   * @param {Object} user - 用戶記錄（可選）
   */
  async sendSponsorNotification(sponsor, user = null) {
    try {
      const levelInfo = this.getSponsorLevelInfo(sponsor.direct_link_code)

      // 準備通知資料
      const notificationData = {
        type: 'sponsor_received',
        title: `收到新的 ${levelInfo.name} 贊助！`,
        message: `${sponsor.from_name || '匿名贊助者'} 透過 Ko-fi 購買了 ${levelInfo.name} 商品`,
        data: {
          sponsor_id: sponsor._id,
          kofi_transaction_id: sponsor.kofi_transaction_id,
          sponsor_level: sponsor.sponsor_level,
          amount: sponsor.amount,
          from_name: sponsor.from_name,
          message: sponsor.message,
        },
        priority: 'normal',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 天後過期
      }

      // 如果有關聯用戶，發送個人通知
      if (user) {
        await notificationQueue.addNotification(user._id, notificationData)
      }

      // 發送管理員通知（可以通知所有管理員）
      await this.sendAdminNotification(sponsor, levelInfo)

      logger.info('贊助通知已發送', {
        sponsor_id: sponsor._id,
        has_user: !!user,
      })
    } catch (error) {
      logger.error('發送贊助通知失敗:', error)
      // 不拋出錯誤，因為通知失敗不應該影響主要業務流程
    }
  }

  /**
   * 發送管理員通知
   * @param {Object} sponsor - 贊助記錄
   * @param {Object} levelInfo - 贊助等級資訊
   */
  async sendAdminNotification(sponsor, levelInfo) {
    try {
      const User = (await import('../models/User.js')).default

      // 找到所有管理員
      const admins = await User.find({
        role: { $in: ['admin', 'manager'] },
        is_active: true,
      }).select('_id nickname')

      if (admins.length === 0) {
        logger.warn('沒有找到管理員用戶，跳過管理員通知')
        return
      }

      const adminNotification = {
        type: 'admin_sponsor_alert',
        title: `🔔 新贊助通知: ${levelInfo.badge} ${levelInfo.name}`,
        message: `${sponsor.from_name || '匿名'} 購買了 ${levelInfo.name} ($${sponsor.amount})`,
        data: {
          sponsor_id: sponsor._id,
          kofi_transaction_id: sponsor.kofi_transaction_id,
          sponsor_level: sponsor.sponsor_level,
          amount: sponsor.amount,
          email: sponsor.email,
          from_name: sponsor.from_name,
          display_name: sponsor.display_name,
          message: sponsor.message,
          discord_username: sponsor.discord_username,
        },
        priority: 'high',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天後過期
      }

      // 發送給所有管理員
      for (const admin of admins) {
        await notificationQueue.addNotification(admin._id, adminNotification)
      }

      logger.info('管理員贊助通知已發送', {
        admin_count: admins.length,
        sponsor_level: sponsor.sponsor_level,
      })
    } catch (error) {
      logger.error('發送管理員通知失敗:', error)
    }
  }

  /**
   * 更新快取中的贊助統計
   * @param {Object} sponsor - 贊助記錄
   */
  async updateSponsorStatsCache(sponsor) {
    try {
      const cacheKey = 'sponsor:stats:global'

      // 取得當前統計
      let stats = await integratedCache.get(cacheKey)
      if (!stats) {
        stats = {
          total_amount: 0,
          total_count: 0,
          level_counts: {
            soy: 0,
            chicken: 0,
            coffee: 0,
          },
          last_updated: new Date().toISOString(),
        }
      } else {
        try {
          stats = JSON.parse(stats)
        } catch (parseError) {
          logger.warn('快取數據解析失敗，重置統計', { cacheKey, error: parseError.message })
          stats = {
            total_amount: 0,
            total_count: 0,
            level_counts: {
              soy: 0,
              chicken: 0,
              coffee: 0,
            },
            last_updated: new Date().toISOString(),
          }
        }
      }

      // 更新統計
      stats.total_amount += sponsor.amount
      stats.total_count += 1
      stats.level_counts[sponsor.sponsor_level] =
        (stats.level_counts[sponsor.sponsor_level] || 0) + 1
      stats.last_updated = new Date().toISOString()

      // 儲存到快取（7 天過期）
      await integratedCache.set(cacheKey, JSON.stringify(stats), 604800)

      logger.info('全域贊助統計快取已更新', {
        total_amount: stats.total_amount,
        total_count: stats.total_count,
        level: sponsor.sponsor_level,
      })
    } catch (error) {
      logger.error('更新贊助統計快取失敗:', error)
    }
  }

  /**
   * 處理退款邏輯
   * @param {string} kofiTransactionId - Ko-fi 交易 ID
   * @param {string} reason - 退款原因
   * @param {number} refundAmount - 退款金額
   */
  async processRefund(kofiTransactionId, reason, refundAmount = null) {
    const session = await (await import('../models/Sponsor.js')).default.startSession()
    session.startTransaction()

    try {
      const Sponsor = (await import('../models/Sponsor.js')).default

      // 找到贊助記錄
      const sponsor = await Sponsor.findOne({ kofi_transaction_id: kofiTransactionId }).session(
        session,
      )
      if (!sponsor) {
        throw new Error(`找不到交易記錄: ${kofiTransactionId}`)
      }

      if (sponsor.status === 'refunded') {
        throw new Error(`交易已退款: ${kofiTransactionId}`)
      }

      // 更新贊助記錄
      sponsor.status = 'refunded'
      sponsor.refunded_at = new Date()
      sponsor.refund_reason = reason
      sponsor.refund_amount = refundAmount || sponsor.amount

      await sponsor.save({ session })

      // 如果有關聯用戶，更新用戶統計
      if (sponsor.user_id) {
        await this.updateUserSponsorStats(sponsor.user_id, sponsor, session)
      }

      await session.commitTransaction()

      logger.info('退款處理完成', {
        kofi_transaction_id: kofiTransactionId,
        refund_amount: sponsor.refund_amount,
        reason,
      })

      return sponsor
    } catch (error) {
      await session.abortTransaction()
      logger.error('退款處理失敗:', error)
      throw error
    } finally {
      session.endSession()
    }
  }

  /**
   * 解析 Shop Items 數據並應用合併規則
   * @param {Array} shopItems - Ko-fi 的 shop_items 數組
   * @param {String} defaultDirectLinkCode - 默認的商品代碼
   * @returns {Object} 解析後的商品資訊
   */
  async parseShopItems(shopItems, defaultDirectLinkCode = null) {
    try {
      // 如果沒有 shop_items 或為空數組，使用默認商品代碼
      if (!shopItems || !Array.isArray(shopItems) || shopItems.length === 0) {
        const levelInfo = this.getSponsorLevelInfo(defaultDirectLinkCode)
        return {
          direct_link_code: defaultDirectLinkCode,
          sponsor_level: levelInfo?.name || '未知',
          level_key: this.getLevelKey(defaultDirectLinkCode),
          quantity: 1,
          total_amount: levelInfo?.amount || 0,
          items: [],
          merged: false,
        }
      }

      // 處理多項目訂單
      const parsedItems = []
      let highestLevel = { key: 'soy', amount: 1, directLinkCode: null } // 默認最低等級
      let totalQuantity = 0
      let combineRule = 'highest' // 默認合併規則

      for (const item of shopItems) {
        if (!item.direct_link_code) continue

        const levelInfo = this.getSponsorLevelInfo(item.direct_link_code)
        if (!levelInfo) continue

        const quantity = parseInt(item.quantity) || 1
        const itemLevel = this.getLevelKey(item.direct_link_code)

        parsedItems.push({
          direct_link_code: item.direct_link_code,
          variation_name: item.variation_name || '',
          quantity: quantity,
          level: levelInfo.name,
          level_key: itemLevel,
          amount: levelInfo.amount * quantity,
        })

        totalQuantity += quantity

        // 比較等級決定最高等級
        if (this.compareLevels(itemLevel, highestLevel.key) > 0) {
          highestLevel = {
            key: itemLevel,
            amount: levelInfo.amount,
            directLinkCode: item.direct_link_code,
          }
        }
      }

      // 如果只有一個項目，返回該項目資訊
      if (parsedItems.length === 1) {
        const item = parsedItems[0]
        return {
          direct_link_code: item.direct_link_code,
          sponsor_level: item.level,
          level_key: item.level_key,
          quantity: item.quantity,
          total_amount: item.amount,
          items: parsedItems,
          merged: false,
        }
      }

      // 多項目時，嘗試從最高等級商品讀取合併規則
      if (highestLevel.directLinkCode) {
        try {
          const SponsorshipProducts = (await import('../models/SponsorshipProducts.js')).default
          const product = await SponsorshipProducts.findOne({
            direct_link_code: highestLevel.directLinkCode.toUpperCase(),
          })

          if (product && product.combine_rule) {
            combineRule = product.combine_rule
            logger.info('使用商品合併規則', {
              direct_link_code: highestLevel.directLinkCode,
              combine_rule: combineRule,
            })
          }
        } catch (error) {
          logger.warn('讀取商品合併規則失敗，使用默認規則', {
            direct_link_code: highestLevel.directLinkCode,
            error: error.message,
          })
        }
      }

      // 根據合併規則計算最終金額
      let finalAmount = 0
      const totalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0)
      const averageAmount = totalAmount / totalQuantity

      switch (combineRule) {
        case 'highest':
          // 使用最高等級的商品金額（不考慮數量）
          finalAmount = highestLevel.amount
          break
        case 'sum':
          // 總金額
          finalAmount = totalAmount
          break
        case 'average':
          // 平均金額
          finalAmount = averageAmount
          break
        default:
          // 默認使用最高等級
          finalAmount = highestLevel.amount
          combineRule = 'highest'
      }

      return {
        direct_link_code:
          highestLevel.directLinkCode || this.getDirectLinkCodeFromLevel(highestLevel.key),
        sponsor_level: this.getLevelName(highestLevel.key),
        level_key: highestLevel.key,
        quantity: totalQuantity,
        total_amount: finalAmount,
        raw_total_amount: totalAmount, // 保存原始總金額供參考
        average_amount: averageAmount,
        items: parsedItems,
        merged: true,
        merge_rule: combineRule,
      }
    } catch (error) {
      logger.error('解析 Shop Items 失敗:', error)
      // 返回默認值
      const levelInfo = this.getSponsorLevelInfo(defaultDirectLinkCode)
      return {
        direct_link_code: defaultDirectLinkCode,
        sponsor_level: levelInfo?.name || '未知',
        level_key: this.getLevelKey(defaultDirectLinkCode),
        quantity: 1,
        total_amount: levelInfo?.amount || 0,
        items: [],
        merged: false,
        error: error.message,
      }
    }
  }

  /**
   * 根據等級鍵獲取商品代碼
   * @param {String} levelKey - 等級鍵 (soy, chicken, coffee)
   * @returns {String} 商品代碼
   */
  getDirectLinkCodeFromLevel(levelKey) {
    const levelMap = {
      soy: 'c4043b71a4',
      chicken: 'b7e4575bf6',
      coffee: '25678099a7',
    }
    return levelMap[levelKey] || 'c4043b71a4'
  }

  /**
   * 根據等級鍵獲取等級名稱
   * @param {String} levelKey - 等級鍵
   * @returns {String} 等級名稱
   */
  getLevelName(levelKey) {
    const nameMap = {
      soy: '豆漿贊助',
      chicken: '雞肉贊助',
      coffee: '咖啡贊助',
    }
    return nameMap[levelKey] || '未知贊助'
  }

  /**
   * 比較兩個贊助等級的高低
   * @param {String} levelA - 等級鍵A
   * @param {String} levelB - 等級鍵B
   * @returns {Number} 比較結果 (-1: A低於B, 0: A等於B, 1: A高於B)
   */
  compareLevels(levelA, levelB) {
    const levelOrder = { soy: 1, chicken: 2, coffee: 3 }
    const orderA = levelOrder[levelA] || 0
    const orderB = levelOrder[levelB] || 0
    return orderA - orderB
  }

  /**
   * 從商品代碼獲取等級鍵
   * @param {String} directLinkCode - 商品代碼
   * @returns {String} 等級鍵
   */
  getLevelKey(directLinkCode) {
    const levelMap = {
      c4043b71a4: 'soy',
      b7e4575bf6: 'chicken',
      '25678099a7': 'coffee',
    }
    return levelMap[directLinkCode] || 'soy'
  }

  /**
   * 自動審核和過濾訊息內容
   * @param {String} message - 訊息內容
   * @param {Object} sponsorData - 贊助者資料
   * @returns {Object} 審核結果
   */
  reviewAndFilterMessage(message, sponsorData = {}) {
    try {
      const reviewResult = {
        reviewed: true,
        filtered: false,
        original_message: message,
        filtered_message: message,
        filter_reason: null,
        severity: 'low', // low, medium, high
        requires_manual_review: false,
      }

      if (!message || typeof message !== 'string') {
        return reviewResult
      }

      const trimmedMessage = message.trim()
      if (!trimmedMessage) {
        return reviewResult
      }

      // 1. 檢查訊息長度
      if (trimmedMessage.length > 500) {
        reviewResult.filtered = true
        reviewResult.filtered_message = trimmedMessage.substring(0, 500) + '...'
        reviewResult.filter_reason = 'message_too_long'
        reviewResult.severity = 'medium'
        reviewResult.requires_manual_review = true
        logger.warn('訊息過長，已自動截斷', {
          original_length: trimmedMessage.length,
          sponsor_level: sponsorData.sponsor_level,
        })
        return reviewResult
      }

      // 2. 檢查是否有不適當的語言
      const inappropriateWords = this.getInappropriateWords()
      for (const word of inappropriateWords) {
        if (trimmedMessage.toLowerCase().includes(word.toLowerCase())) {
          reviewResult.filtered = true
          reviewResult.filtered_message = '[訊息包含不適當內容，已隱藏]'
          reviewResult.filter_reason = 'inappropriate_content'
          reviewResult.severity = 'high'
          reviewResult.requires_manual_review = true
          logger.warn('檢測到不適當內容，已隱藏訊息', {
            detected_word: word,
            sponsor_level: sponsorData.sponsor_level,
          })
          return reviewResult
        }
      }

      // 3. 檢查是否有廣告或推銷內容
      const advertisementPatterns = this.getAdvertisementPatterns()
      for (const pattern of advertisementPatterns) {
        if (pattern.test(trimmedMessage)) {
          reviewResult.filtered = true
          reviewResult.filtered_message = '[訊息包含推銷內容，已隱藏]'
          reviewResult.filter_reason = 'advertisement_content'
          reviewResult.severity = 'high'
          reviewResult.requires_manual_review = true
          logger.warn('檢測到推銷內容，已隱藏訊息', {
            pattern: pattern.toString(),
            sponsor_level: sponsorData.sponsor_level,
          })
          return reviewResult
        }
      }

      // 4. 檢查是否有重複內容（簡單的重複字檢查）
      if (this.hasRepeatedContent(trimmedMessage)) {
        reviewResult.filtered = true
        reviewResult.filtered_message = '[訊息包含重複內容，已隱藏]'
        reviewResult.filter_reason = 'repeated_content'
        reviewResult.severity = 'medium'
        reviewResult.requires_manual_review = false
        logger.info('檢測到重複內容，已隱藏訊息', {
          sponsor_level: sponsorData.sponsor_level,
        })
        return reviewResult
      }

      // 5. 檢查是否有過多的特殊字符
      const specialCharRatio = this.getSpecialCharacterRatio(trimmedMessage)
      if (specialCharRatio > 0.3) {
        // 30%的字符是特殊字符
        reviewResult.filtered = true
        reviewResult.filtered_message = '[訊息包含過多特殊字符，已隱藏]'
        reviewResult.filter_reason = 'too_many_special_chars'
        reviewResult.severity = 'medium'
        reviewResult.requires_manual_review = true
        logger.warn('檢測到過多特殊字符，已隱藏訊息', {
          special_char_ratio: specialCharRatio.toFixed(2),
          sponsor_level: sponsorData.sponsor_level,
        })
        return reviewResult
      }

      return reviewResult
    } catch (error) {
      logger.error('訊息審核失敗:', error)
      return {
        reviewed: false,
        filtered: false,
        original_message: message,
        filtered_message: message,
        filter_reason: 'review_error',
        severity: 'low',
        requires_manual_review: true,
        error: error.message,
      }
    }
  }

  /**
   * 獲取不適當詞彙列表
   * @returns {Array} 不適當詞彙
   */
  getInappropriateWords() {
    return [
      'fuck',
      'shit',
      'damn',
      'bitch',
      'asshole',
      '操',
      '幹',
      '靠',
      '媽的',
      '王八蛋',
      '垃圾',
      '白癡',
      '智障',
      '弱智',
      // 可以根據需要擴展
    ]
  }

  /**
   * 獲取廣告模式列表
   * @returns {Array} 正則表達式模式
   */
  getAdvertisementPatterns() {
    return [
      /\b(?:http|https|www\.)\S+/i, // URL
      /(?:微信|QQ|電話|手機|聯繫方式|聯系方式|聯絡方式|連絡方式|WeChat|WhatsApp|Telegram|Line)/i,
      /(?:買|賣|售|購|價|價格|優惠|折扣|購買|銷售|販賣|販售)/i,
      /\b(?:招聘|求職|兼職|工作)\b/i,
      /(?:廣告|推銷|推薦|介紹|宣傳|促銷)/i,
      // 可以根據需要擴展
    ]
  }

  /**
   * 檢查是否有重複內容
   * @param {String} message - 訊息內容
   * @returns {Boolean} 是否有重複內容
   */
  hasRepeatedContent(message) {
    // 檢查連續重複的字符
    const repeatedChars = /(.)\1{4,}/
    if (repeatedChars.test(message)) {
      return true
    }

    // 如果訊息太短，跳過詞彙重複檢查
    if (message.length < 10) return false

    // 檢查重複的詞彙
    const words = message.split(/\s+/)
    const wordCount = {}
    for (const word of words) {
      if (word.length >= 2) {
        // 只檢查長度大於等於2的詞
        wordCount[word] = (wordCount[word] || 0) + 1
        if (wordCount[word] > 3) {
          // 同一個詞重複超過3次
          return true
        }
      }
    }

    return false
  }

  /**
   * 計算特殊字符比例
   * @param {String} message - 訊息內容
   * @returns {Number} 特殊字符比例 (0-1)
   */
  getSpecialCharacterRatio(message) {
    if (!message || message.length === 0) return 0

    const specialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/g
    const matches = message.match(specialChars)
    return matches ? matches.length / message.length : 0
  }

  /**
   * 幣別換匯服務
   * 支援東亞、中文圈國家與美加幣別轉換
   * @param {Number} amount - 原始金額
   * @param {String} fromCurrency - 來源幣別
   * @param {String} toCurrency - 目標幣別 (預設為 USD)
   * @returns {Object} 換匯結果
   */
  async convertCurrency(amount, fromCurrency, toCurrency = 'USD') {
    try {
      if (!amount || amount <= 0) {
        return {
          success: false,
          error: '無效的金額',
          original_amount: amount,
          converted_amount: null,
          from_currency: fromCurrency,
          to_currency: toCurrency,
        }
      }

      if (fromCurrency === toCurrency) {
        return {
          success: true,
          original_amount: amount,
          converted_amount: amount,
          exchange_rate: 1,
          from_currency: fromCurrency,
          to_currency: toCurrency,
        }
      }

      // 使用currency.js進行轉換
      const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency)
      if (!exchangeRate) {
        return {
          success: false,
          error: `不支援的幣別轉換: ${fromCurrency} -> ${toCurrency}`,
          original_amount: amount,
          converted_amount: null,
          from_currency: fromCurrency,
          to_currency: toCurrency,
        }
      }

      // 使用 currency.js 進行精確的貨幣計算
      // currency.js 提供更好的浮點數處理，避免 JavaScript 浮點誤差
      const sourceCurrency = currency(amount, {
        fromCents: false,
        precision: 2, // 設定小數點精度
      })
      const convertedAmount = sourceCurrency.multiply(exchangeRate).value

      return {
        success: true,
        original_amount: amount,
        converted_amount: convertedAmount,
        exchange_rate: exchangeRate,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      }
    } catch (error) {
      logger.error('幣別換匯失敗:', error)
      return {
        success: false,
        error: error.message,
        original_amount: amount,
        converted_amount: null,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      }
    }
  }

  /**
   * 獲取匯率（使用快取服務）
   * 支援的幣別：USD, TWD, HKD, MOP, JPY, CNY, SGD, KRW, THB, IDR, PHP, VND, MYR, CAD, AUD, EUR, GBP
   * @param {String} fromCurrency - 來源幣別
   * @param {String} toCurrency - 目標幣別
   * @returns {Number|null} 匯率或null
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    return await exchangeRateService.getExchangeRate(fromCurrency, toCurrency)
  }

  /**
   * 批量幣別轉換
   * @param {Array} currencyConversions - 轉換請求數組
   * @returns {Array} 轉換結果數組
   */
  async batchConvertCurrency(currencyConversions) {
    if (!Array.isArray(currencyConversions)) {
      return []
    }

    const results = []
    for (const conversion of currencyConversions) {
      const { amount, fromCurrency, toCurrency } = conversion
      const result = await this.convertCurrency(amount, fromCurrency, toCurrency)
      results.push(result)
    }

    return results
  }

  /**
   * 獲取支援的幣別列表
   * @returns {Array} 支援的幣別代碼
   */
  getSupportedCurrencies() {
    return [
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
   * 格式化金額顯示
   * @param {Number} amount - 金額
   * @param {String} currencyCode - 幣別代碼
   * @returns {String} 格式化的金額字串
   */
  formatCurrency(amount, currencyCode) {
    if (!amount || !currencyCode) return '0'

    try {
      // 使用currency.js進行格式化
      const currencyObj = currency(amount, {
        fromCents: false,
        symbol: this.getCurrencySymbol(currencyCode),
        precision: 2,
      })

      return currencyObj.format()
    } catch (error) {
      logger.warn('貨幣格式化失敗，使用備用方法:', error.message)

      // 備用格式化方法
      const symbol = this.getCurrencySymbol(currencyCode)
      return `${symbol}${amount.toFixed(2)}`
    }
  }

  /**
   * 獲取幣別符號
   * @param {String} currencyCode - 幣別代碼
   * @returns {String} 幣別符號
   */
  getCurrencySymbol(currencyCode) {
    const currencySymbols = {
      // 東亞、中文圈國家
      USD: '$',
      TWD: 'NT$',
      HKD: 'HK$',
      MOP: 'MOP$',
      JPY: '¥',
      CNY: '¥',
      SGD: 'S$',
      KRW: '₩',

      // 東南亞國家
      THB: '฿',
      IDR: 'Rp',
      PHP: '₱',
      VND: '₫',
      MYR: 'RM',

      // 美加等國
      CAD: 'C$',
      AUD: 'A$',

      // 歐洲主要貨幣
      EUR: '€',
      GBP: '£',
    }

    return currencySymbols[currencyCode] || currencyCode
  }

  /**
   * 取得贊助統計資料
   * @returns {Object} 統計資料
   */
  async getSponsorStats() {
    try {
      const cacheKey = 'sponsor:stats:global'
      let stats = await integratedCache.get(cacheKey)

      if (stats) {
        return JSON.parse(stats)
      }

      // 如果快取中沒有，從資料庫計算
      const Sponsor = (await import('../models/Sponsor.js')).default

      const pipeline = [
        { $match: { status: 'success' } },
        {
          $group: {
            _id: null,
            total_amount: { $sum: '$amount' },
            total_count: { $sum: 1 },
            soy_count: {
              $sum: { $cond: [{ $eq: ['$sponsor_level', 'soy'] }, 1, 0] },
            },
            chicken_count: {
              $sum: { $cond: [{ $eq: ['$sponsor_level', 'chicken'] }, 1, 0] },
            },
            coffee_count: {
              $sum: { $cond: [{ $eq: ['$sponsor_level', 'coffee'] }, 1, 0] },
            },
          },
        },
      ]

      const result = await Sponsor.aggregate(pipeline)
      const dbStats = result[0] || {
        total_amount: 0,
        total_count: 0,
        soy_count: 0,
        chicken_count: 0,
        coffee_count: 0,
      }

      const statsData = {
        total_amount: dbStats.total_amount,
        total_count: dbStats.total_count,
        level_counts: {
          soy: dbStats.soy_count,
          chicken: dbStats.chicken_count,
          coffee: dbStats.coffee_count,
        },
        last_updated: new Date().toISOString(),
      }

      // 儲存到快取
      await integratedCache.set(cacheKey, JSON.stringify(statsData), 604800)

      return statsData
    } catch (error) {
      logger.error('取得贊助統計失敗:', error)
      throw error
    }
  }
}

// 導出單例實例
export default new KofiService()
