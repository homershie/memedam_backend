import express from 'express'
import EmailController from '../controllers/emailController.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

// 限制 email 發送頻率
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 最多 5 次請求
  message: {
    success: false,
    message: '發送 email 過於頻繁，請稍後再試',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * @swagger
 * /api/email/status:
 *   get:
 *     summary: 檢查 Email 服務狀態
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Email 服務狀態正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 status:
 *                   type: object
 *                   properties:
 *                     sendgridConfigured:
 *                       type: boolean
 *                     fromEmailConfigured:
 *                       type: boolean
 *                     frontendUrlConfigured:
 *                       type: boolean
 *                     timestamp:
 *                       type: string
 *       503:
 *         description: SendGrid 未設定
 */
router.get('/status', EmailController.checkEmailStatus)

/**
 * @swagger
 * /api/email/test:
 *   post:
 *     summary: 發送測試 Email
 *     tags: [Email]
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
 *         description: 測試 email 發送成功
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
 *       429:
 *         description: 發送頻率過高
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/test', emailRateLimit, EmailController.sendTestEmail)

/**
 * @swagger
 * /api/email/verification:
 *   post:
 *     summary: 發送驗證 Email
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - verificationToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 收件人 email 地址
 *               username:
 *                 type: string
 *                 description: 使用者名稱
 *               verificationToken:
 *                 type: string
 *                 description: 驗證 token
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
 *                     username:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       429:
 *         description: 發送頻率過高
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/verification', emailRateLimit, EmailController.sendVerificationEmail)

/**
 * @swagger
 * /api/email/password-reset:
 *   post:
 *     summary: 發送密碼重設 Email
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - resetToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 收件人 email 地址
 *               username:
 *                 type: string
 *                 description: 使用者名稱
 *               resetToken:
 *                 type: string
 *                 description: 密碼重設 token
 *     responses:
 *       200:
 *         description: 密碼重設 email 發送成功
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
 *                     username:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       429:
 *         description: 發送頻率過高
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/password-reset', emailRateLimit, EmailController.sendPasswordResetEmail)

/**
 * @swagger
 * /api/email/contact:
 *   post:
 *     summary: 發送聯絡表單 Email
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - topic
 *               - userType
 *               - message
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: 聯絡人姓名
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 聯絡人 email 地址
 *               topic:
 *                 type: string
 *                 description: 聯絡主題
 *                 enum: [general, technical, report, partnership, other]
 *               userType:
 *                 type: string
 *                 description: 用戶類型
 *                 enum: [general, creator, business, student, media, other]
 *               message:
 *                 type: string
 *                 description: 訊息內容
 *                 minLength: 10
 *     responses:
 *       200:
 *         description: 聯絡表單發送成功
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
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     topic:
 *                       type: string
 *                     userType:
 *                       type: string
 *                     submittedAt:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       429:
 *         description: 發送頻率過高
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/contact', emailRateLimit, EmailController.sendContactForm)

export default router
