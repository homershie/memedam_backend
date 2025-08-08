import express from 'express'
import VerificationController from '../controllers/verificationController.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

// 驗證 email 發送限流：每 5 分鐘最多 1 次
const verificationEmailLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  max: 1, // 最多 1 次請求
  message: {
    success: false,
    message: '發送驗證 email 過於頻繁，請稍後再試',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// 重新發送驗證 email 限流：每 60 秒最多 1 次
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 60 秒
  max: 1, // 最多 1 次請求
  message: {
    success: false,
    message: '重新發送驗證 email 過於頻繁，請稍後再試',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * @swagger
 * /api/verification/send:
 *   post:
 *     summary: 發送驗證 Email
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 收件人 email 地址
 *     responses:
 *       200:
 *         description: 驗證 email 發送成功
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
 *                     email:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 找不到用戶
 *       429:
 *         description: 發送頻率過高
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/send', verificationEmailLimiter, VerificationController.sendVerificationEmail)

/**
 * @swagger
 * /api/verification/verify:
 *   get:
 *     summary: 驗證 Email Token
 *     tags: [Verification]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: 驗證 token
 *     responses:
 *       200:
 *         description: Email 驗證成功
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
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     verifiedAt:
 *                       type: string
 *       400:
 *         description: 無效或已過期的 token
 *       404:
 *         description: 找不到用戶
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/verify', VerificationController.verifyEmail)

/**
 * @swagger
 * /api/verification/resend:
 *   post:
 *     summary: 重新發送驗證 Email
 *     tags: [Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 收件人 email 地址
 *     responses:
 *       200:
 *         description: 驗證 email 重新發送成功
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
 *                     email:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 找不到用戶
 *       429:
 *         description: 發送頻率過高
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/resend', resendVerificationLimiter, VerificationController.resendVerificationEmail)

export default router
