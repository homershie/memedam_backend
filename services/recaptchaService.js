import axios from 'axios'
import { logger } from '../utils/logger.js'

/**
 * reCAPTCHA 驗證服務
 * 提供統一的 reCAPTCHA 驗證功能，支援 v2 和 v3 版本
 */
class RecaptchaService {
  /**
   * 驗證 reCAPTCHA token
   * @param {string} recaptchaToken - reCAPTCHA token
   * @param {Object} options - 驗證選項
   * @param {number} options.minScore - 最低分數 (v3 版本，預設 0.5)
   * @param {boolean} options.allowDevMode - 開發環境是否允許通過 (預設 true)
   * @param {boolean} options.requireToken - 是否要求必須提供 token (預設 true)
   * @returns {Promise<boolean>} 驗證結果
   */
  static async verify(recaptchaToken, options = {}) {
    const { minScore = 0.5, allowDevMode = true, requireToken = true } = options

    try {
      logger.info('🔍 reCAPTCHA 驗證開始...', {
        hasToken: !!recaptchaToken,
        hasSecretKey: !!process.env.RECAPTCHA_SECRET_KEY,
        environment: process.env.NODE_ENV || 'development',
        minScore,
        allowDevMode,
        requireToken,
      })

      // 檢查是否有設定 reCAPTCHA 密鑰
      if (!process.env.RECAPTCHA_SECRET_KEY) {
        logger.warn('❌ reCAPTCHA 密鑰未設定，無法進行驗證')

        // 開發環境允許通過
        if (
          allowDevMode &&
          (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
        ) {
          logger.info('✅ 開發環境模式：允許通過驗證')
          return true
        }

        return false
      }

      // 檢查是否有提供 token
      if (!recaptchaToken) {
        if (requireToken) {
          logger.error('❌ 未提供 reCAPTCHA token')
          return false
        } else {
          logger.warn('⚠️ 未提供 reCAPTCHA token，但設定為非必需')
          return true
        }
      }

      logger.info('🌐 開始向 Google reCAPTCHA API 發送驗證請求...')

      const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        },
        timeout: 10000, // 10 秒超時
      })

      logger.info('📊 Google API 回應:', {
        success: response.data.success,
        score: response.data.score,
        action: response.data.action,
        challengeTs: response.data.challenge_ts,
        hostname: response.data.hostname,
      })

      // 檢查基本成功狀態
      if (!response.data.success) {
        logger.warn('❌ reCAPTCHA 驗證失敗:', response.data['error-codes'])
        return false
      }

      // 檢查分數 (v3 版本)
      if (response.data.score !== undefined) {
        const isValid = response.data.score >= minScore
        logger.info(
          `✅ reCAPTCHA v3 驗證結果: ${isValid} (分數: ${response.data.score}, 最低要求: ${minScore})`,
        )
        return isValid
      }

      // v2 版本只需要 success 為 true
      logger.info('✅ reCAPTCHA v2 驗證成功')
      return true
    } catch (error) {
      logger.error('❌ reCAPTCHA 驗證錯誤:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      })

      // 網路錯誤時，開發環境允許通過
      if (
        allowDevMode &&
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
      ) {
        logger.warn('⚠️ 開發環境模式：網路錯誤時允許通過')
        return true
      }

      return false
    }
  }

  /**
   * 快速驗證 (使用預設設定)
   * @param {string} recaptchaToken - reCAPTCHA token
   * @returns {Promise<boolean>} 驗證結果
   */
  static async quickVerify(recaptchaToken) {
    return this.verify(recaptchaToken)
  }

  /**
   * 嚴格驗證 (不允許開發環境通過)
   * @param {string} recaptchaToken - reCAPTCHA token
   * @param {number} minScore - 最低分數
   * @returns {Promise<boolean>} 驗證結果
   */
  static async strictVerify(recaptchaToken, minScore = 0.7) {
    return this.verify(recaptchaToken, {
      minScore,
      allowDevMode: false,
      requireToken: true,
    })
  }

  /**
   * 寬鬆驗證 (允許開發環境通過，不要求 token)
   * @param {string} recaptchaToken - reCAPTCHA token
   * @returns {Promise<boolean>} 驗證結果
   */
  static async lenientVerify(recaptchaToken) {
    return this.verify(recaptchaToken, {
      allowDevMode: true,
      requireToken: false,
    })
  }

  /**
   * 檢查 reCAPTCHA 設定狀態
   * @returns {Object} 設定狀態
   */
  static getStatus() {
    return {
      hasSecretKey: !!process.env.RECAPTCHA_SECRET_KEY,
      hasSiteKey: !!process.env.RECAPTCHA_SITE_KEY,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    }
  }
}

export default RecaptchaService
