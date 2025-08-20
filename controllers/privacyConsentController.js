import PrivacyConsent from '../models/PrivacyConsent.js'
import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'

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

      // If user is logged in and has valid consent, deactivate old ones
      if (req.user) {
        await PrivacyConsent.updateMany(
          { userId: req.user._id, isActive: true },
          { isActive: false, revokedAt: new Date() }
        )
      }

      // Create new consent record
      const consent = new PrivacyConsent({
        userId: req.user?._id || null,
        sessionId: getSessionId(req),
        necessary: necessary !== false, // Default to true
        functional: functional || false,
        analytics: analytics || false,
        consentVersion: consentVersion || '1.0',
        consentSource,
        ipAddress: getClientIP(req),
        userAgent: getUserAgent(req),
      })

      await consent.save()

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