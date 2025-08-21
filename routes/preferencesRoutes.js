import express from 'express'
import preferencesController from '../controllers/preferencesController.js'
import { optionalToken } from '../middleware/auth.js'
import { checkFunctionalConsent } from '../middleware/privacyConsent.js'
import { apiLimiter } from '../middleware/rateLimit.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     ThemePreference:
 *       type: object
 *       required:
 *         - theme
 *       properties:
 *         theme:
 *           type: string
 *           enum: [light, dark, auto]
 *           description: 主題選項
 *     LanguagePreference:
 *       type: object
 *       required:
 *         - language
 *       properties:
 *         language:
 *           type: string
 *           enum: [zh-TW, en-US, ja-JP]
 *           description: 語言選項
 *     PersonalizationPreference:
 *       type: object
 *       properties:
 *         autoPlay:
 *           type: boolean
 *           description: 自動播放
 *         showNSFW:
 *           type: boolean
 *           description: 顯示 NSFW 內容
 *         compactMode:
 *           type: boolean
 *           description: 緊湊模式
 *         infiniteScroll:
 *           type: boolean
 *           description: 無限滾動
 *         notificationPreferences:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             push:
 *               type: boolean
 *             mentions:
 *               type: boolean
 *             likes:
 *               type: boolean
 *             comments:
 *               type: boolean
 *     SearchPreference:
 *       type: object
 *       properties:
 *         searchHistory:
 *           type: boolean
 *           description: 搜尋歷史
 *         searchSuggestions:
 *           type: boolean
 *           description: 搜尋建議
 *         defaultSort:
 *           type: string
 *           enum: [hot, new, top, rising]
 *           description: 預設排序
 *         defaultFilter:
 *           type: string
 *           enum: [all, sfw, nsfw]
 *           description: 預設篩選
 */

/**
 * @swagger
 * /api/preferences/theme:
 *   post:
 *     summary: 設定主題偏好
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ThemePreference'
 *     responses:
 *       200:
 *         description: 主題偏好設定成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     theme:
 *                       type: string
 *                 skipped:
 *                   type: boolean
 *                 reason:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */
router.post(
  '/theme',
  optionalToken,
  checkFunctionalConsent,
  apiLimiter,
  preferencesController.setTheme,
)

/**
 * @swagger
 * /api/preferences/language:
 *   post:
 *     summary: 設定語言偏好
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LanguagePreference'
 *     responses:
 *       200:
 *         description: 語言偏好設定成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */
router.post(
  '/language',
  optionalToken,
  checkFunctionalConsent,
  apiLimiter,
  preferencesController.setLanguage,
)

/**
 * @swagger
 * /api/preferences/personalization:
 *   post:
 *     summary: 設定個人化偏好
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonalizationPreference'
 *     responses:
 *       200:
 *         description: 個人化偏好設定成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */
router.post(
  '/personalization',
  optionalToken,
  checkFunctionalConsent,
  apiLimiter,
  preferencesController.setPersonalization,
)

/**
 * @swagger
 * /api/preferences/search:
 *   post:
 *     summary: 設定搜尋偏好
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchPreference'
 *     responses:
 *       200:
 *         description: 搜尋偏好設定成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */
router.post(
  '/search',
  optionalToken,
  checkFunctionalConsent,
  apiLimiter,
  preferencesController.setSearchPreferences,
)

/**
 * @swagger
 * /api/preferences:
 *   get:
 *     summary: 取得當前偏好設定
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得偏好設定
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     theme:
 *                       type: string
 *                     language:
 *                       type: string
 *                     personalization:
 *                       $ref: '#/components/schemas/PersonalizationPreference'
 *                     searchPreferences:
 *                       $ref: '#/components/schemas/SearchPreference'
 *                 functionalCookiesEnabled:
 *                   type: boolean
 *       401:
 *         description: 未授權
 */
router.get('/', optionalToken, preferencesController.getPreferences)

/**
 * @swagger
 * /api/preferences:
 *   delete:
 *     summary: 清除所有偏好設定
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 偏好設定清除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 clearedCookies:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: 未授權
 */
router.delete('/', optionalToken, preferencesController.clearPreferences)

/**
 * @swagger
 * /api/preferences/privacy-status:
 *   get:
 *     summary: 取得隱私設定狀態
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得隱私設定狀態
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasPrivacyConsent:
 *                       type: boolean
 *                     canUseFunctionalCookies:
 *                       type: boolean
 *                     canTrackAnalytics:
 *                       type: boolean
 *                     canUseNecessaryCookies:
 *                       type: boolean
 *                     currentConsent:
 *                       type: object
 *                       nullable: true
 *       401:
 *         description: 未授權
 */
router.get('/privacy-status', optionalToken, preferencesController.getPrivacyStatus)

export default router
