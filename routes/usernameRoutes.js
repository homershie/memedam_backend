import express from 'express'
import { previewUsername, checkUsernameAvailability, getUsernameSuggestions } from '../controllers/usernameController.js'
import auth from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * /api/username/preview:
 *   post:
 *     summary: 為OAuth登入提供username建議預覽
 *     tags: [Username]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - profile
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, facebook, discord, twitter]
 *                 description: 社群平台類型
 *               profile:
 *                 type: object
 *                 description: 社群平台用戶資料
 *             example:
 *               provider: "google"
 *               profile:
 *                 id: "123456789"
 *                 emails: [{"value": "user@example.com"}]
 *     responses:
 *       200:
 *         description: 成功生成username建議
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
 *                     provider:
 *                       type: string
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     message:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/preview', previewUsername)

/**
 * @swagger
 * /api/username/check/{username}:
 *   get:
 *     summary: 檢查username是否可用
 *     tags: [Username]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 8
 *           maxLength: 20
 *         description: 要檢查的username
 *     responses:
 *       200:
 *         description: 檢查結果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 available:
 *                   type: boolean
 *                 username:
 *                   type: string
 *                 reason:
 *                   type: string
 *                   nullable: true
 *             examples:
 *               available:
 *                 value:
 *                   success: true
 *                   available: true
 *                   username: "testuser123"
 *                   reason: null
 *               unavailable:
 *                 value:
 *                   success: true
 *                   available: false
 *                   username: "testuser123"
 *                   reason: "Username已被使用"
 *       400:
 *         description: Username格式不正確
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/check/:username', checkUsernameAvailability)

/**
 * @swagger
 * /api/username/suggestions:
 *   get:
 *     summary: 為已登入用戶提供username變更建議
 *     tags: [Username]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 成功獲取username建議
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
 *                     currentUsername:
 *                       type: string
 *                     canChangeUsername:
 *                       type: boolean
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     nextChangeAvailable:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       401:
 *         description: 需要登入
 *       404:
 *         description: 找不到用戶資料
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/suggestions', auth, getUsernameSuggestions)

export default router