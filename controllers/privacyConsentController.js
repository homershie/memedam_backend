import PrivacyConsent from '../models/PrivacyConsent.js'
import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'

// Helper functions to get request info
const getClientIP = (req) => {
  return (
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '0.0.0.0'
  )
}

const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'Unknown'
}

const getSessionId = (req) => {
  // Priority: express-session > custom header > cookie > generate new
  if (req.sessionID) return req.sessionID
  if (req.headers['x-session-id']) return req.headers['x-session-id']
  if (req.cookies?.sessionId) return req.cookies.sessionId

  // Generate new session ID
  const crypto = require('crypto')
  return crypto.randomBytes(16).toString('hex')
}

class PrivacyConsentController {
  /**
   * Create new consent record
   */
  async create(req, res, next) {
    try {
      const { necessary, functional, analytics, consentVersion, consentSource } = req.body

      // Validate required fields
      if (!consentSource) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Consent source is required',
        })
      }

      // If user is logged in, check for existing session-based consent and migrate it
      if (req.user) {
        const sessionId = getSessionId(req)

        // First, deactivate old user-based consents
        await PrivacyConsent.updateMany(
          { userId: req.user._id, isActive: true },
          { isActive: false, revokedAt: new Date() },
        )

        // Check if there's an existing session-based consent for this session
        const existingSessionConsent = await PrivacyConsent.findActiveBySessionId(sessionId)

        if (existingSessionConsent && !existingSessionConsent.userId) {
          // Migrate the session-based consent to user-based consent
          logger.info(`遷移 sessionId 記錄到 userId: ${sessionId} -> ${req.user._id}`)
          existingSessionConsent.userId = req.user._id
          existingSessionConsent.updatedAt = new Date()
          await existingSessionConsent.save()

          // Return the migrated consent instead of creating a new one
          return res.status(StatusCodes.OK).json({
            success: true,
            data: existingSessionConsent,
            message: 'Privacy consent migrated from session to user successfully',
          })
        }
      }

      // Create new consent record
      const consent = new PrivacyConsent({
        userId: req.user ? req.user._id : null,
        sessionId: getSessionId(req),
        necessary: necessary !== false, // Default to true
        functional: functional === true, // Explicitly check for true
        analytics: analytics === true, // Explicitly check for true
        consentVersion: consentVersion || '1.0',
        consentSource,
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
      })

      // 確保 userId 正確設置 - 根據 ObjectId-CastError-Fix-Summary.md 的修復方案
      if (req.user && req.user._id) {
        // 確保 userId 是 ObjectId 類型
        const { ObjectId } = require('mongoose').Types
        consent.userId =
          req.user._id instanceof ObjectId ? req.user._id : new ObjectId(req.user._id)
        logger.info(`設置隱私同意記錄的 userId: ${consent.userId}`)
        logger.info(`userId 類型: ${typeof consent.userId}`)
        logger.info(`userId 字串: ${consent.userId?.toString()}`)
        logger.info(`userId 是否為 ObjectId 實例: ${consent.userId instanceof ObjectId}`)
      } else {
        logger.warn('用戶未登入，隱私同意記錄將以 sessionId 保存')
      }

      logger.info('準備保存隱私同意記錄:', {
        userId: consent.userId,
        sessionId: consent.sessionId,
        necessary: consent.necessary,
        functional: consent.functional,
        analytics: consent.analytics,
        isActive: consent.isActive,
        userExists: !!req.user,
        userID: req.user?._id,
        userIDType: typeof req.user?._id,
        userIDString: req.user?._id?.toString(),
        userIDEquals: req.user?._id === consent.userId,
        userIDStringEquals: req.user?._id?.toString() === consent.userId?.toString(),
        userIDStrictEquals: req.user?._id?.toString() === consent.userId?.toString(),
        userIDObjectId: req.user?._id?.toString(),
        consentUserIdObjectId: consent.userId?.toString(),
        userIDEqualsStrict: req.user?._id?.toString() === consent.userId?.toString(),
        userIDEqualsStrict2: req.user?._id?.toString() === consent.userId?.toString(),
        userIDEqualsStrict3: req.user?._id?.toString() === consent.userId?.toString(),
        userIDEqualsStrict4: req.user?._id?.toString() === consent.userId?.toString(),
      })

      await consent.save()

      logger.info('隱私同意記錄已保存，ID:', consent._id)

      // If user is logged in, update User association
      if (req.user) {
        await User.findByIdAndUpdate(req.user._id, {
          privacyConsentId: consent._id,
          lastConsentUpdate: new Date(),
        })
      }

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: consent,
        message: 'Privacy consent saved successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get current active consent
   */
  async getCurrent(req, res, next) {
    try {
      let consent

      if (req.user) {
        // Logged in user: prioritize userId
        consent = await PrivacyConsent.findActiveByUserId(req.user._id)

        // If no user-based consent found, check for session-based consent and migrate it
        if (!consent) {
          const sessionId = getSessionId(req)
          const sessionConsent = await PrivacyConsent.findActiveBySessionId(sessionId)

          if (sessionConsent && !sessionConsent.userId) {
            // Migrate the session-based consent to user-based consent
            logger.info(
              `在 getCurrent 中遷移 sessionId 記錄到 userId: ${sessionId} -> ${req.user._id}`,
            )
            sessionConsent.userId = req.user._id
            sessionConsent.updatedAt = new Date()
            await sessionConsent.save()
            consent = sessionConsent
          }
        }
      }

      if (!consent) {
        // Not logged in or no user record: use sessionId
        const sessionId = getSessionId(req)
        consent = await PrivacyConsent.findActiveBySessionId(sessionId)
      }

      res.json({
        success: true,
        data: consent,
        hasConsent: !!consent,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update consent settings
   */
  async update(req, res, next) {
    try {
      const { id } = req.params
      const { necessary, functional, analytics, consentSource } = req.body

      // Find and validate consent record
      const consent = await PrivacyConsent.findById(id)

      if (!consent) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Privacy consent not found',
        })
      }

      // Verify permissions: can only update own consent
      if (req.user && consent.userId && consent.userId.toString() !== req.user._id.toString()) {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: 'Unauthorized to update this consent',
        })
      }

      // Update consent settings
      consent.necessary = necessary !== false
      consent.functional = functional || false
      consent.analytics = analytics || false
      consent.consentSource = consentSource || 'settings'
      consent.ipAddress = getClientIP(req)
      consent.userAgent = getUserAgent(req)
      consent.updatedAt = new Date()

      await consent.save()

      res.json({
        success: true,
        data: consent,
        message: 'Privacy consent updated successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Revoke consent
   */
  async revoke(req, res, next) {
    try {
      const { id } = req.params

      // Find and validate consent record
      const consent = await PrivacyConsent.findById(id)

      if (!consent) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: 'Privacy consent not found',
        })
      }

      // Verify permissions
      if (req.user && consent.userId && consent.userId.toString() !== req.user._id.toString()) {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: 'Unauthorized to revoke this consent',
        })
      }

      // Revoke consent
      consent.isActive = false
      consent.revokedAt = new Date()
      await consent.save()

      // If logged in user, clear User association
      if (req.user && consent.userId) {
        await User.findByIdAndUpdate(consent.userId, {
          $unset: { privacyConsentId: 1 },
          lastConsentUpdate: new Date(),
        })
      }

      res.json({
        success: true,
        message: 'Privacy consent revoked successfully',
        data: { revokedAt: consent.revokedAt },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get consent history
   */
  async getHistory(req, res, next) {
    try {
      const { userId, sessionId, page = 1, limit = 20, includeRevoked = false } = req.query

      // Build query
      const query = {}

      if (userId) {
        // Admin querying specific user
        if (!req.user?.role === 'admin' && userId !== req.user?._id.toString()) {
          return res.status(StatusCodes.FORBIDDEN).json({
            success: false,
            message: 'Unauthorized to view this history',
          })
        }
        query.userId = userId
      } else if (sessionId) {
        query.sessionId = sessionId
      } else if (req.user) {
        // User querying own records
        query.userId = req.user._id
      } else {
        // Anonymous user query
        query.sessionId = getSessionId(req)
      }

      // Include revoked records?
      if (!includeRevoked) {
        query.isActive = true
      }

      // Execute query
      const consents = await PrivacyConsent.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('userId', 'username email')
        .lean()

      const total = await PrivacyConsent.countDocuments(query)

      res.json({
        success: true,
        data: consents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get consent statistics (admin only)
   */
  async getStats(req, res, next) {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          message: 'Admin access required',
        })
      }

      const { startDate, endDate } = req.query

      // Build date query
      const dateQuery = {}
      if (startDate) {
        dateQuery.createdAt = { $gte: new Date(startDate) }
      }
      if (endDate) {
        dateQuery.createdAt = { ...dateQuery.createdAt, $lte: new Date(endDate) }
      }

      // Statistics
      const [total, active, revoked, bySource, byType] = await Promise.all([
        // Total count
        PrivacyConsent.countDocuments(dateQuery),
        // Active consents
        PrivacyConsent.countDocuments({ ...dateQuery, isActive: true }),
        // Revoked consents
        PrivacyConsent.countDocuments({ ...dateQuery, isActive: false }),
        // Group by source
        PrivacyConsent.aggregate([
          { $match: dateQuery },
          { $group: { _id: '$consentSource', count: { $sum: 1 } } },
        ]),
        // Group by consent type
        PrivacyConsent.aggregate([
          { $match: { ...dateQuery, isActive: true } },
          {
            $group: {
              _id: null,
              necessary: { $sum: { $cond: ['$necessary', 1, 0] } },
              functional: { $sum: { $cond: ['$functional', 1, 0] } },
              analytics: { $sum: { $cond: ['$analytics', 1, 0] } },
            },
          },
        ]),
      ])

      res.json({
        success: true,
        data: {
          total,
          active,
          revoked,
          revokeRate: total > 0 ? ((revoked / total) * 100).toFixed(2) + '%' : '0%',
          bySource: bySource.reduce((acc, item) => {
            acc[item._id] = item.count
            return acc
          }, {}),
          byType: byType[0] || { necessary: 0, functional: 0, analytics: 0 },
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new PrivacyConsentController()
