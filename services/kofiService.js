import { logger } from '../utils/logger.js'
import integratedCache from '../config/cache.js'
import notificationQueue from './notificationQueue.js'

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
