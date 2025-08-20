import EmailService from '../utils/emailService.js'
import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'
import axios from 'axios'

// reCAPTCHA 驗證函數
const verifyRecaptcha = async (recaptchaToken) => {
  try {
    console.log('🔍 reCAPTCHA 驗證開始...')
    console.log('📝 收到的 token:', recaptchaToken ? '已提供' : '未提供')
    console.log('🔑 是否有 SECRET_KEY:', !!process.env.RECAPTCHA_SECRET_KEY)

    // 檢查是否有設定 reCAPTCHA 密鑰
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.error('❌ reCAPTCHA 密鑰未設定，無法進行驗證')
      return true // 開發環境允許通過
    }

    if (!recaptchaToken) {
      console.error('❌ 未提供 reCAPTCHA token')
      return false
    }

    console.log('🌐 開始向 Google reCAPTCHA API 發送驗證請求...')
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: recaptchaToken,
      },
    })

    const isValid = response.data.success && response.data.score >= 0.5
    console.log('✅ reCAPTCHA 驗證結果:', isValid)
    return isValid
  } catch (error) {
    console.error('❌ reCAPTCHA 驗證錯誤:', error)
    return false
  }
}

/**
 * Email Controller
 */
class EmailController {
  /**
   * 發送測試 email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendTestEmail(req, res) {
    try {
      const { email } = req.body

      if (!email) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供 email 地址',
        })
      }

      // 驗證 email 格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供有效的 email 地址',
        })
      }

      // 發送測試 email
      await EmailService.sendTestEmail(email)

      res.status(StatusCodes.OK).json({
        success: true,
        message: '測試 email 已發送',
        data: {
          email,
          sentAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('發送測試 email 失敗:', error)

      // 處理 SendGrid 錯誤
      if (error.response) {
        const { body } = error.response
        logger.error('SendGrid 錯誤:', body)

        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '發送 email 失敗',
          error: {
            code: body?.errors?.[0]?.message || 'SENDGRID_ERROR',
            details: body?.errors || [],
          },
        })
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '發送 email 時發生錯誤',
        error: error.message,
      })
    }
  }

  /**
   * 發送驗證 email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendVerificationEmail(req, res) {
    try {
      const { email, username, verificationToken } = req.body

      if (!email || !username || !verificationToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供 email、username 和 verificationToken',
        })
      }

      // 驗證 email 格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供有效的 email 地址',
        })
      }

      // 發送驗證 email
      await EmailService.sendVerificationEmail(email, verificationToken, username)

      res.status(StatusCodes.OK).json({
        success: true,
        message: '驗證 email 已發送',
        data: {
          email,
          username,
          sentAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('發送驗證 email 失敗:', error)

      if (error.response) {
        const { body } = error.response
        logger.error('SendGrid 錯誤:', body)

        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '發送驗證 email 失敗',
          error: {
            code: body?.errors?.[0]?.message || 'SENDGRID_ERROR',
            details: body?.errors || [],
          },
        })
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '發送驗證 email 時發生錯誤',
        error: error.message,
      })
    }
  }

  /**
   * 發送密碼重設 email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendPasswordResetEmail(req, res) {
    try {
      const { email, username, resetToken } = req.body

      if (!email || !username || !resetToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供 email、username 和 resetToken',
        })
      }

      // 驗證 email 格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供有效的 email 地址',
        })
      }

      // 發送密碼重設 email
      await EmailService.sendPasswordResetEmail(email, resetToken, username)

      res.status(StatusCodes.OK).json({
        success: true,
        message: '密碼重設 email 已發送',
        data: {
          email,
          username,
          sentAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('發送密碼重設 email 失敗:', error)

      if (error.response) {
        const { body } = error.response
        logger.error('SendGrid 錯誤:', body)

        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '發送密碼重設 email 失敗',
          error: {
            code: body?.errors?.[0]?.message || 'SENDGRID_ERROR',
            details: body?.errors || [],
          },
        })
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '發送密碼重設 email 時發生錯誤',
        error: error.message,
      })
    }
  }

  /**
   * 檢查 SendGrid 設定狀態
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkEmailStatus(req, res) {
    try {
      const hasApiKey = !!process.env.SENDGRID_API_KEY
      const hasFromEmail = !!process.env.SENDGRID_FROM_EMAIL
      const hasFrontendUrl = !!process.env.FRONTEND_URL

      const status = {
        sendgridConfigured: hasApiKey,
        fromEmailConfigured: hasFromEmail,
        frontendUrlConfigured: hasFrontendUrl,
        timestamp: new Date().toISOString(),
      }

      if (!hasApiKey) {
        return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
          success: false,
          message: 'SendGrid API Key 未設定',
          status,
        })
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Email 服務狀態檢查完成',
        status,
      })
    } catch (error) {
      logger.error('檢查 email 狀態失敗:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '檢查 email 狀態時發生錯誤',
        error: error.message,
      })
    }
  }

  /**
   * 發送聯絡表單 email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendContactForm(req, res) {
    try {
      const { fullName, email, topic, userType, message, recaptchaToken } = req.body

      // 驗證必填欄位
      if (!fullName || !email || !topic || !userType || !message || !recaptchaToken) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請填寫所有必填欄位，包括 reCAPTCHA 驗證',
        })
      }

      // 驗證 reCAPTCHA
      const isRecaptchaValid = await verifyRecaptcha(recaptchaToken)
      if (!isRecaptchaValid) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'reCAPTCHA 驗證失敗，請重新驗證',
        })
      }

      // 驗證 email 格式（先 trim）
      const trimmedEmail = email.trim()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供有效的 email 地址',
        })
      }

      // 驗證訊息長度
      if (message.trim().length < 10) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '訊息內容至少需要10個字元',
        })
      }

      // 發送聯絡表單 email
      await EmailService.sendContactFormEmail({
        fullName: fullName.trim(),
        email: trimmedEmail,
        topic,
        userType,
        message: message.trim(),
      })

      logger.info(`聯絡表單已發送: ${trimmedEmail} - ${topic}`)

      res.status(StatusCodes.OK).json({
        success: true,
        message: '聯絡表單已成功送出，我們會盡快回覆您',
        data: {
          fullName: fullName.trim(),
          email: trimmedEmail,
          topic,
          userType,
          submittedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error('發送聯絡表單失敗:', error)

      // 處理 SendGrid 錯誤
      if (error.response) {
        const { body } = error.response
        logger.error('SendGrid 錯誤:', body)

        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '發送聯絡表單失敗',
          error: {
            code: body?.errors?.[0]?.message || 'SENDGRID_ERROR',
            details: body?.errors || [],
          },
        })
      }

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '發送聯絡表單時發生錯誤',
        error: error.message,
      })
    }
  }
}

export default EmailController
