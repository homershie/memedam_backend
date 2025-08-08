import User from '../models/User.js'
import VerificationToken from '../models/VerificationToken.js'
import { StatusCodes } from 'http-status-codes'
import crypto from 'crypto'
import { logger } from '../utils/logger.js'
import EmailService from '../utils/emailService.js'
import mongoose from 'mongoose'

/**
 * 驗證控制器
 */
class VerificationController {
  /**
   * 產生驗證 token
   * @param {string} userId - 用戶 ID
   * @param {string} type - token 類型
   * @param {number} expiresInHours - 過期時間（小時）
   * @returns {Promise<string>} 驗證 token
   */
  static async generateVerificationToken(userId, type, expiresInHours = 24) {
    const session = await User.startSession()
    session.startTransaction()

    try {
      // 產生隨機 token
      const token = crypto.randomBytes(32).toString('hex')

      // 設定過期時間
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expiresInHours)

      // 儲存 token
      await VerificationToken.create(
        [
          {
            token,
            userId,
            type,
            expiresAt,
          },
        ],
        { session },
      )

      // 提交事務
      await session.commitTransaction()

      return token
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  /**
   * 發送驗證 email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendVerificationEmail(req, res) {
    const session = await User.startSession()
    session.startTransaction()

    try {
      const { email } = req.body

      if (!email) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供 email 地址',
        })
      }

      // 驗證 email 格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供有效的 email 地址',
        })
      }

      // 查找用戶
      const user = await User.findOne({ email: email.toLowerCase() }).session(session)
      if (!user) {
        await session.abortTransaction()
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: '找不到此 email 對應的用戶',
        })
      }

      // 檢查是否已經驗證
      if (user.email_verified) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '此 email 已經驗證過了',
        })
      }

      // 檢查是否有未過期的驗證 token - 使用 mongoose.trusted 避免日期 CastError
      const existingToken = await VerificationToken.findOne({
        userId: user._id,
        type: 'email_verification',
        used: false,
        expiresAt: mongoose.trusted({ $gt: new Date() }),
      }).session(session)

      if (existingToken) {
        await session.abortTransaction()
        return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          success: false,
          message: '驗證 email 已發送，請檢查您的信箱或稍後再試',
        })
      }

      // 產生新的驗證 token
      const verificationToken = await VerificationController.generateVerificationToken(
        user._id,
        'email_verification',
        24, // 24 小時過期
      )

      // 發送驗證 email
      await EmailService.sendVerificationEmail(email, verificationToken, user.username)

      // 提交事務
      await session.commitTransaction()

      res.status(StatusCodes.OK).json({
        success: true,
        message: '驗證 email 已發送',
        data: {
          email,
          sentAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      await session.abortTransaction()
      logger.error('發送驗證 email 失敗:', error)

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '發送驗證 email 時發生錯誤',
        error: error.message,
      })
    } finally {
      session.endSession()
    }
  }

  /**
   * 驗證 email token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async verifyEmail(req, res) {
    const session = await User.startSession()
    session.startTransaction()

    try {
      const { token } = req.query

      if (!token) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供驗證 token',
        })
      }

      // 查找並驗證 token - 使用 mongoose.trusted 避免日期 CastError
      const verificationToken = await VerificationToken.findOne({
        token,
        type: 'email_verification',
        used: false,
        expiresAt: mongoose.trusted({ $gt: new Date() }),
      }).session(session)

      if (!verificationToken) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '無效或已過期的驗證 token',
        })
      }

      // 查找用戶
      const user = await User.findById(verificationToken.userId).session(session)
      if (!user) {
        await session.abortTransaction()
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: '找不到對應的用戶',
        })
      }

      // 檢查是否已經驗證
      if (user.email_verified) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '此 email 已經驗證過了',
        })
      }

      // 標記 token 為已使用
      verificationToken.used = true
      await verificationToken.save({ session })

      // 更新用戶驗證狀態
      user.email_verified = true
      user.verified_at = new Date()
      await user.save({ session })

      // 提交事務
      await session.commitTransaction()

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Email 驗證成功',
        data: {
          userId: user._id,
          email: user.email,
          verifiedAt: user.verified_at,
        },
      })
    } catch (error) {
      await session.abortTransaction()
      logger.error('驗證 email 失敗:', error)

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '驗證 email 時發生錯誤',
        error: error.message,
      })
    } finally {
      session.endSession()
    }
  }

  /**
   * 重新發送驗證 email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resendVerificationEmail(req, res) {
    const session = await User.startSession()
    session.startTransaction()

    try {
      const { email } = req.body

      if (!email) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供 email 地址',
        })
      }

      // 查找用戶
      const user = await User.findOne({ email: email.toLowerCase() }).session(session)
      if (!user) {
        await session.abortTransaction()
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          message: '找不到此 email 對應的用戶',
        })
      }

      // 檢查是否已經驗證
      if (user.email_verified) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '此 email 已經驗證過了',
        })
      }

      // 檢查是否有未過期的驗證 token - 使用 mongoose.trusted 避免日期 CastError
      const existingToken = await VerificationToken.findOne({
        userId: user._id,
        type: 'email_verification',
        used: false,
        expiresAt: mongoose.trusted({ $gt: new Date() }),
      }).session(session)

      if (existingToken) {
        await session.abortTransaction()
        return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
          success: false,
          message: '驗證 email 已發送，請檢查您的信箱或稍後再試',
        })
      }

      // 產生新的驗證 token
      const verificationToken = await VerificationController.generateVerificationToken(
        user._id,
        'email_verification',
        24, // 24 小時過期
      )

      // 發送驗證 email
      await EmailService.sendVerificationEmail(email, verificationToken, user.username)

      // 提交事務
      await session.commitTransaction()

      res.status(StatusCodes.OK).json({
        success: true,
        message: '驗證 email 已重新發送',
        data: {
          email,
          sentAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      await session.abortTransaction()
      logger.error('重新發送驗證 email 失敗:', error)

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '重新發送驗證 email 時發生錯誤',
        error: error.message,
      })
    } finally {
      session.endSession()
    }
  }
}

export default VerificationController
