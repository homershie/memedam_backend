import PrivacyConsent from '../models/PrivacyConsent.js'
import { logger } from '../utils/logger.js'
import mongoose from 'mongoose'
import crypto from 'crypto'

/**
 * 隱私同意檢查 Middleware
 * 根據使用者的隱私設定來控制功能存取
 */

// Helper functions
const getSessionId = (req) => {
  if (req.sessionID) return req.sessionID

  // 支援從 express-session cookie 解析（格式: s:<sid>.<sig>）
  const sidCookie = req.cookies?.['memedam.sid']
  if (sidCookie) {
    try {
      const decoded = decodeURIComponent(sidCookie)
      const raw = decoded.startsWith('s:') ? decoded.slice(2) : decoded
      const sid = raw.split('.')[0]
      if (sid && sid.length > 0) return sid
    } catch {
      // 忽略解析錯誤，繼續使用其他方式
    }
  }

  if (req.headers['x-session-id']) return req.headers['x-session-id']
  if (req.cookies?.sessionId) return req.cookies.sessionId

  return crypto.randomBytes(32).toString('hex')
}

/**
 * 檢查隱私同意狀態
 */
const checkPrivacyConsent = async (req) => {
  try {
    let consent = null

    // 優先檢查登入使用者的同意
    if (req.user && req.user._id) {
      try {
        // 確保 userId 是 ObjectId 類型
        const { ObjectId } = mongoose.Types
        let userId = req.user._id

        // 檢查 userId 是否已經是 ObjectId
        if (!(userId instanceof ObjectId)) {
          try {
            userId = new ObjectId(String(userId))
          } catch {
            logger.warn(`無效的用戶ID格式，跳過用戶隱私同意檢查: ${req.user._id}`)
            userId = null
          }
        }

        if (userId) {
          consent = await PrivacyConsent.findActiveByUserId(userId)
          logger.debug(`用戶隱私同意檢查: userId=${userId}, found=${!!consent}`)
        }
      } catch (userError) {
        logger.error('檢查用戶隱私同意失敗:', {
          userId: req.user?._id,
          message: userError?.message,
          stack: userError?.stack,
        })
      }
    }

    // 如果沒有登入使用者或沒有同意記錄，檢查 session
    if (!consent) {
      try {
        const sessionId = getSessionId(req)
        consent = await PrivacyConsent.findActiveBySessionId(sessionId)
        logger.debug(`Session 隱私同意檢查: sessionId=${sessionId}, found=${!!consent}`)

        // 如果已登入且找到的同意記錄是基於 session、且尚未綁定 userId，則進行遷移
        if (req.user && req.user._id && consent && !consent.userId) {
          try {
            const { ObjectId } = mongoose.Types
            let migratedUserId = req.user._id

            // 檢查 userId 是否已經是 ObjectId
            if (!(migratedUserId instanceof ObjectId)) {
              try {
                migratedUserId = new ObjectId(String(migratedUserId))
              } catch {
                logger.warn(`遷移時無效的用戶ID格式: ${req.user._id}`)
                migratedUserId = null
              }
            }

            if (migratedUserId) {
              logger.info(`遷移 session 同意記錄到 userId: ${consent.sessionId} -> ${migratedUserId}`)
              consent.userId = migratedUserId
              consent.updatedAt = new Date()
              await consent.save()
            }
          } catch (migrateError) {
            logger.error('遷移 session 同意記錄失敗:', {
              sessionId: consent.sessionId,
              userId: req.user?._id,
              message: migrateError?.message,
              stack: migrateError?.stack,
            })
          }
        }
      } catch (sessionError) {
        logger.error('檢查 session 隱私同意失敗:', {
          sessionId: getSessionId(req),
          message: sessionError?.message,
          stack: sessionError?.stack,
        })
      }
    }

    return consent
  } catch (error) {
    logger.error('檢查隱私同意失敗:', {
      hasUser: !!req.user,
      userId: req.user?._id,
      sessionId: getSessionId(req),
      message: error?.message,
      stack: error?.stack,
    })
    return null
  }
}

/**
 * Analytics 追蹤檢查 Middleware
 * 只有當使用者同意 analytics 時才允許追蹤
 */
export const checkAnalyticsConsent = async (req, res, next) => {
  try {
    const consent = await checkPrivacyConsent(req)

    // 如果沒有同意記錄或不同意 analytics，跳過追蹤
    if (!consent || !consent.analytics) {
      req.skipAnalytics = true
      logger.debug('跳過 analytics 追蹤：使用者未同意或不同意 analytics')
    } else {
      req.skipAnalytics = false
      req.privacyConsent = consent
    }

    next()
  } catch (error) {
    logger.error('Analytics 同意檢查失敗:', { message: error?.message, stack: error?.stack })
    req.skipAnalytics = true
    next()
  }
}

/**
 * 功能 Cookie 檢查 Middleware
 * 只有當使用者同意 functional cookies 時才設定功能 Cookie
 */
export const checkFunctionalConsent = async (req, res, next) => {
  try {
    const consent = await checkPrivacyConsent(req)

    // 如果沒有同意記錄或不同意 functional cookies
    if (!consent || !consent.functional) {
      req.skipFunctionalCookies = true
      logger.debug('跳過功能 Cookie：使用者未同意或不同意 functional cookies')
    } else {
      req.skipFunctionalCookies = false
      req.privacyConsent = consent
    }

    next()
  } catch (error) {
    logger.error('Functional cookies 同意檢查失敗:', {
      message: error?.message,
      stack: error?.stack,
    })
    req.skipFunctionalCookies = true
    next()
  }
}

/**
 * 通用隱私同意檢查 Middleware
 * 將隱私同意資訊附加到請求物件
 */
export const attachPrivacyConsent = async (req, res, next) => {
  try {
    const consent = await checkPrivacyConsent(req)

    if (consent) {
      req.privacyConsent = consent
      req.hasPrivacyConsent = true
      req.canTrackAnalytics = consent.analytics
      req.canUseFunctionalCookies = consent.functional
      req.canUseNecessaryCookies = consent.necessary
    } else {
      req.hasPrivacyConsent = false
      req.canTrackAnalytics = false
      req.canUseFunctionalCookies = false
      req.canUseNecessaryCookies = true // 必要 Cookie 預設允許
    }

    next()
  } catch (error) {
    logger.error('附加隱私同意資訊失敗:', { message: error?.message, stack: error?.stack })
    req.hasPrivacyConsent = false
    req.canTrackAnalytics = false
    req.canUseFunctionalCookies = false
    req.canUseNecessaryCookies = true
    next()
  }
}

/**
 * 條件式 Analytics 追蹤
 * 根據隱私設定決定是否執行追蹤
 */
export const conditionalAnalytics = (trackingFunction) => {
  return async (req, res, next) => {
    try {
      const consent = await checkPrivacyConsent(req)

      if (consent && consent.analytics) {
        // 使用者同意 analytics，執行追蹤
        await trackingFunction(req, res, next)
      } else {
        // 使用者不同意 analytics，跳過追蹤
        logger.debug('跳過 analytics 追蹤：使用者未同意 analytics')
        next()
      }
    } catch (error) {
      logger.error('條件式 analytics 執行失敗:', error)
      next()
    }
  }
}

/**
 * 條件式功能 Cookie 設定
 * 根據隱私設定決定是否設定功能 Cookie
 */
export const conditionalFunctionalCookies = (cookieFunction) => {
  return async (req, res, next) => {
    try {
      const consent = await checkPrivacyConsent(req)

      if (consent && consent.functional) {
        // 使用者同意 functional cookies，設定 Cookie
        await cookieFunction(req, res, next)
      } else {
        // 使用者不同意 functional cookies，跳過設定
        logger.debug('跳過功能 Cookie 設定：使用者未同意 functional cookies')
        next()
      }
    } catch (error) {
      logger.error('條件式功能 Cookie 設定失敗:', error)
      next()
    }
  }
}
