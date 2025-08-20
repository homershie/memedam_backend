import express from 'express'
import privacyConsentController from '../controllers/privacyConsentController.js'
import { optionalToken, token, isAdmin } from '../middleware/auth.js'
import { apiLimiter } from '../middleware/rateLimit.js'

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Privacy Consent
 *   description: Privacy consent management API
 */

/**
 * @swagger
 * /api/privacy-consent:
 *   post:
 *     summary: Create new privacy consent record
 *     tags: [Privacy Consent]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consentSource
 *             properties:
 *               necessary:
 *                 type: boolean
 *                 default: true
 *               functional:
 *                 type: boolean
 *                 default: false
 *               analytics:
 *                 type: boolean
 *                 default: false
 *               consentVersion:
 *                 type: string
 *                 default: "1.0"
 *               consentSource:
 *                 type: string
 *                 enum: [initial, settings, reconsent]
 *     responses:
 *       201:
 *         description: Consent record created successfully
 *       400:
 *         description: Invalid request parameters
 */
router.post('/', optionalToken, apiLimiter, privacyConsentController.create)

/**
 * @swagger
 * /api/privacy-consent/current:
 *   get:
 *     summary: Get current active consent settings
 *     tags: [Privacy Consent]
 *     responses:
 *       200:
 *         description: Successfully retrieved consent settings
 *       500:
 *         description: Server error
 */
router.get('/current', optionalToken, privacyConsentController.getCurrent)

/**
 * @swagger
 * /api/privacy-consent/history:
 *   get:
 *     summary: Get consent history records
 *     tags: [Privacy Consent]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Session ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: includeRevoked
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Successfully retrieved history
 *       403:
 *         description: Unauthorized to view history
 */
router.get('/history', optionalToken, privacyConsentController.getHistory)

/**
 * @swagger
 * /api/privacy-consent/{id}:
 *   put:
 *     summary: Update consent settings
 *     tags: [Privacy Consent]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consent record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               necessary:
 *                 type: boolean
 *               functional:
 *                 type: boolean
 *               analytics:
 *                 type: boolean
 *               consentSource:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully updated consent settings
 *       404:
 *         description: Consent record not found
 *       403:
 *         description: Unauthorized to update
 */
router.put('/:id', optionalToken, apiLimiter, privacyConsentController.update)

/**
 * @swagger
 * /api/privacy-consent/{id}:
 *   delete:
 *     summary: Revoke consent
 *     tags: [Privacy Consent]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Consent record ID
 *     responses:
 *       200:
 *         description: Successfully revoked consent
 *       404:
 *         description: Consent record not found
 *       403:
 *         description: Unauthorized to revoke
 */
router.delete('/:id', optionalToken, privacyConsentController.revoke)

/**
 * @swagger
 * /api/privacy-consent/admin/stats:
 *   get:
 *     summary: Get consent statistics (admin only)
 *     tags: [Privacy Consent]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Successfully retrieved statistics
 *       403:
 *         description: Admin access required
 */
router.get('/admin/stats', token, isAdmin, privacyConsentController.getStats)

export default router