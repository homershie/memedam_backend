import User from '../models/User.js'
import VerificationToken from '../models/VerificationToken.js'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import validator from 'validator'
import crypto from 'crypto'
import {
  manualSendDeletionReminders,
  manualDeleteUnverifiedUsers,
} from '../services/userCleanupScheduler.js'
import { logger } from '../utils/logger.js'
import EmailService from '../services/emailService.js'
import VerificationController from './verificationController.js'
import { deleteImageByUrl } from '../services/uploadService.js'

// 通知設定相關方法
export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id
    const settings = req.body

    // 驗證設定欄位
    const validSettings = [
      'browser',
      'newFollower',
      'newComment',
      'newLike',
      'newMention',
      'trendingContent',
      'weeklyDigest',
    ]

    // 驗證輸入資料
    if (!settings || typeof settings !== 'object') {
      logger.warn('無效的設定資料格式:', { settings, type: typeof settings })
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的設定資料',
      })
    }

    // 檢查是否有有效的設定欄位
    const hasValidSettings = Object.keys(settings).some((key) => validSettings.includes(key))

    if (!hasValidSettings) {
      logger.warn('沒有提供有效的通知設定:', { receivedKeys: Object.keys(settings), validSettings })
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '沒有提供有效的通知設定',
      })
    }

    // 準備更新資料
    const updateData = {}
    for (const key of validSettings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        // 確保布林值正確
        const value = settings[key]
        if (typeof value === 'boolean') {
          updateData[`notificationSettings.${key}`] = value
        } else {
          // 如果不是布林值，嘗試轉換
          updateData[`notificationSettings.${key}`] = Boolean(value)
        }
      }
    }

    // 先檢查用戶是否存在並獲取當前設定
    const existingUser = await User.findById(userId)
    if (!existingUser) {
      logger.warn('用戶不存在:', { userId: userId.toString() })
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    // 使用更安全的更新方式
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
        upsert: false, // 不允許創建新文檔
      },
    ).select('notificationSettings')

    if (!updatedUser) {
      logger.warn('更新後找不到用戶:', { userId: userId.toString() })
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    res.json({
      success: true,
      data: updatedUser.notificationSettings,
      message: '通知設定已更新',
    })
  } catch (error) {
    logger.error('更新通知設定失敗:', error)

    // 更詳細的錯誤處理
    if (error.name === 'ValidationError') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '設定資料驗證失敗',
        error: error.message,
      })
    }

    if (error.name === 'CastError') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的資料格式',
        error: error.message,
      })
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '更新通知設定失敗',
    })
  }
}

export const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id

    const user = await User.findById(userId).select('notificationSettings')
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    res.json({
      success: true,
      data: user.notificationSettings,
    })
  } catch (error) {
    logger.error('獲取通知設定失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '獲取通知設定失敗',
    })
  }
}

// 功能 Cookie 相關偏好設定方法

/**
 * 設定主題偏好
 * 只有當使用者同意功能 Cookie 時才設定
 */
export const setTheme = async (req, res) => {
  try {
    // 檢查功能 Cookie 同意
    if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
      logger.debug('跳過主題設定：使用者未同意功能 Cookie')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: '主題設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled',
      })
    }

    const { theme } = req.body
    const userId = req.user._id

    // 驗證主題選項
    const validThemes = ['light', 'dark', 'auto']
    if (!validThemes.includes(theme)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '無效的主題選項',
        validOptions: validThemes,
      })
    }

    // 更新用戶的主題偏好
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 'functionalPreferences.theme': theme },
      { new: true, runValidators: true },
    ).select('functionalPreferences.theme')

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    // 同時設定功能 Cookie
    res.cookie('theme', theme, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
      path: '/',
    })

    logger.info(`使用者 ${userId} 設定主題: ${theme}`)

    res.json({
      success: true,
      message: '主題偏好已儲存',
      data: { theme: updatedUser.functionalPreferences.theme },
    })
  } catch (error) {
    logger.error('設定主題偏好失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '設定主題偏好失敗',
    })
  }
}

/**
 * 設定語言偏好
 */
export const setLanguage = async (req, res) => {
  try {
    // 檢查功能 Cookie 同意
    if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
      logger.debug('跳過語言設定：使用者未同意功能 Cookie')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: '語言設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled',
      })
    }

    const { language } = req.body
    const userId = req.user._id

    // 驗證語言選項
    const validLanguages = ['zh-TW', 'en-US', 'ja-JP']
    if (!validLanguages.includes(language)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '無效的語言選項',
        validOptions: validLanguages,
      })
    }

    // 更新用戶的語言偏好
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 'functionalPreferences.language': language },
      { new: true, runValidators: true },
    ).select('functionalPreferences.language')

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    // 同時設定功能 Cookie
    res.cookie('language', language, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
      path: '/',
    })

    logger.info(`使用者 ${userId} 設定語言: ${language}`)

    res.json({
      success: true,
      message: '語言偏好已儲存',
      data: { language: updatedUser.functionalPreferences.language },
    })
  } catch (error) {
    logger.error('設定語言偏好失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '設定語言偏好失敗',
    })
  }
}

/**
 * 設定個人化偏好
 */
export const setPersonalization = async (req, res) => {
  try {
    // 檢查功能 Cookie 同意
    if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
      logger.debug('跳過個人化設定：使用者未同意功能 Cookie')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: '個人化設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled',
      })
    }

    const { autoPlay, showNSFW, compactMode, infiniteScroll, notificationPreferences } = req.body
    const userId = req.user._id

    // 建立個人化設定物件
    const personalization = {
      autoPlay: autoPlay !== undefined ? autoPlay : true,
      showNSFW: showNSFW !== undefined ? showNSFW : false,
      compactMode: compactMode !== undefined ? compactMode : false,
      infiniteScroll: infiniteScroll !== undefined ? infiniteScroll : true,
      notificationPreferences: notificationPreferences || {
        email: true,
        push: true,
        mentions: true,
        likes: true,
        comments: true,
      },
    }

    // 更新用戶的個人化偏好
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 'functionalPreferences.personalization': personalization },
      { new: true, runValidators: true },
    ).select('functionalPreferences.personalization')

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    // 同時設定功能 Cookie
    res.cookie('personalization', JSON.stringify(personalization), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
      path: '/',
    })

    logger.info(`使用者 ${userId} 更新個人化設定`)

    res.json({
      success: true,
      message: '個人化偏好已儲存',
      data: updatedUser.functionalPreferences.personalization,
    })
  } catch (error) {
    logger.error('設定個人化偏好失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '設定個人化偏好失敗',
    })
  }
}

/**
 * 設定搜尋偏好
 */
export const setSearchPreferences = async (req, res) => {
  try {
    // 檢查功能 Cookie 同意
    if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
      logger.debug('跳過搜尋偏好設定：使用者未同意功能 Cookie')
      return res.status(StatusCodes.OK).json({
        success: true,
        message: '搜尋偏好設定已跳過（隱私設定）',
        skipped: true,
        reason: 'functional_cookies_disabled',
      })
    }

    const { searchHistory, searchSuggestions, defaultSort, defaultFilter } = req.body
    const userId = req.user._id

    // 驗證排序選項
    if (defaultSort && !['hot', 'new', 'top', 'rising'].includes(defaultSort)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '無效的排序選項',
        validOptions: ['hot', 'new', 'top', 'rising'],
      })
    }

    // 驗證篩選選項
    if (defaultFilter && !['all', 'sfw', 'nsfw'].includes(defaultFilter)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: '無效的篩選選項',
        validOptions: ['all', 'sfw', 'nsfw'],
      })
    }

    // 建立搜尋偏好物件
    const searchPreferences = {
      searchHistory: searchHistory !== undefined ? searchHistory : true,
      searchSuggestions: searchSuggestions !== undefined ? searchSuggestions : true,
      defaultSort: defaultSort || 'hot',
      defaultFilter: defaultFilter || 'all',
    }

    // 更新用戶的搜尋偏好
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 'functionalPreferences.searchPreferences': searchPreferences },
      { new: true, runValidators: true },
    ).select('functionalPreferences.searchPreferences')

    if (!updatedUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    // 同時設定功能 Cookie
    res.cookie('searchPreferences', JSON.stringify(searchPreferences), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
      path: '/',
    })

    logger.info(`使用者 ${userId} 更新搜尋偏好`)

    res.json({
      success: true,
      message: '搜尋偏好已儲存',
      data: updatedUser.functionalPreferences.searchPreferences,
    })
  } catch (error) {
    logger.error('設定搜尋偏好失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '設定搜尋偏好失敗',
    })
  }
}

/**
 * 取得當前偏好設定
 */
export const getFunctionalPreferences = async (req, res) => {
  try {
    // 根據 ObjectId-CastError-Fix-Summary.md 的修復方案
    // 確保 userId 是 ObjectId 類型
    const ObjectId = (await import('mongoose')).default.Types.ObjectId
    const userId = req.user._id instanceof ObjectId ? req.user._id : new ObjectId(req.user._id)

    logger.info(`原始 req.user._id: ${req.user._id}, 類型: ${typeof req.user._id}`)
    logger.info(`轉換後的 userId: ${userId}, 類型: ${typeof userId}`)
    logger.info(`userId 是否為 ObjectId 實例: ${userId instanceof ObjectId}`)

    const user = await User.findById(userId).select('functionalPreferences')
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '用戶不存在',
      })
    }

    // 判斷功能 Cookie 是否可用：優先用全域中介層判定，否則以 session/user 同意作為後援
    let canUseFunctional = Boolean(req.canUseFunctionalCookies)
    let effectiveConsent = req.privacyConsent || null

    const getSessionIdFromRequest = () => {
      if (req.sessionID) return req.sessionID
      const sidCookie = req.cookies?.['memedam.sid']
      if (sidCookie) {
        try {
          const decoded = decodeURIComponent(sidCookie)
          const raw = decoded.startsWith('s:') ? decoded.slice(2) : decoded
          const sid = raw.split('.')[0]
          if (sid && sid.length > 0) return sid
        } catch {
          // 忽略解析錯誤
        }
      }
      if (req.headers['x-session-id']) return req.headers['x-session-id']
      if (req.cookies?.sessionId) return req.cookies.sessionId
      return null
    }

    if (!canUseFunctional) {
      try {
        const PrivacyConsent = (await import('../models/PrivacyConsent.js')).default
        // 先以 userId 查（已在上方嘗試過），再以 sessionId 查
        if (!effectiveConsent) {
          const sessionId = getSessionIdFromRequest()
          if (sessionId) {
            effectiveConsent = await PrivacyConsent.findActiveBySessionId(sessionId)
          }
        }
        if (effectiveConsent?.functional) {
          canUseFunctional = true
          // 嘗試補綁 userId（遷移）
          if (!effectiveConsent.userId && req.user?._id) {
            try {
              effectiveConsent.userId = req.user._id
              effectiveConsent.updatedAt = new Date()
              await effectiveConsent.save()
              logger.info('在 getFunctionalPreferences 中遷移 session 同意記錄到 userId 成功')
            } catch (e) {
              logger.warn('在 getFunctionalPreferences 遷移同意記錄失敗（忽略）', {
                message: e?.message,
                stack: e?.stack,
              })
            }
          }
        }
      } catch (fallbackErr) {
        logger.warn('偏好判定後援流程失敗（忽略）', {
          message: fallbackErr?.message,
          stack: fallbackErr?.stack,
        })
      }
    }

    // 如果使用者不同意功能 Cookie，返回預設值
    if (!canUseFunctional) {
      logger.info('功能 Cookie 已停用，返回預設設定')
      const defaultPreferences = {
        theme: 'auto',
        language: 'zh-TW',
        personalization: {
          autoPlay: true,
          showNSFW: false,
          compactMode: false,
          infiniteScroll: true,
          notificationPreferences: {
            email: true,
            push: true,
            mentions: true,
            likes: true,
            comments: true,
          },
        },
        searchPreferences: {
          searchHistory: true,
          searchSuggestions: true,
          defaultSort: 'hot',
          defaultFilter: 'all',
        },
      }

      res.json({
        success: true,
        message: '功能 Cookie 已停用，使用預設設定',
        data: defaultPreferences,
        functionalCookiesEnabled: false,
      })
    } else {
      // 合併資料庫中的設定和 Cookie 中的設定
      const preferences = {
        theme: req.cookies?.theme || user.functionalPreferences?.theme || 'auto',
        language: req.cookies?.language || user.functionalPreferences?.language || 'zh-TW',
        personalization: req.cookies?.personalization
          ? (() => {
              try {
                return JSON.parse(req.cookies.personalization)
              } catch (e) {
                logger.warn('解析 personalization cookie 失敗:', e)
                return (
                  user.functionalPreferences?.personalization || {
                    autoPlay: true,
                    showNSFW: false,
                    compactMode: false,
                    infiniteScroll: true,
                    notificationPreferences: {
                      email: true,
                      push: true,
                      mentions: true,
                      likes: true,
                      comments: true,
                    },
                  }
                )
              }
            })()
          : user.functionalPreferences?.personalization || {
              autoPlay: true,
              showNSFW: false,
              compactMode: false,
              infiniteScroll: true,
              notificationPreferences: {
                email: true,
                push: true,
                mentions: true,
                likes: true,
                comments: true,
              },
            },
        searchPreferences: req.cookies?.searchPreferences
          ? (() => {
              try {
                return JSON.parse(req.cookies.searchPreferences)
              } catch (e) {
                logger.warn('解析 searchPreferences cookie 失敗:', e)
                return (
                  user.functionalPreferences?.searchPreferences || {
                    searchHistory: true,
                    searchSuggestions: true,
                    defaultSort: 'hot',
                    defaultFilter: 'all',
                  }
                )
              }
            })()
          : user.functionalPreferences?.searchPreferences || {
              searchHistory: true,
              searchSuggestions: true,
              defaultSort: 'hot',
              defaultFilter: 'all',
            },
      }

      res.json({
        success: true,
        data: preferences,
        functionalCookiesEnabled: true,
      })
    }
  } catch (error) {
    logger.error('取得功能偏好設定失敗:', { message: error?.message, stack: error?.stack })
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '取得功能偏好設定失敗',
    })
  }
}

/**
 * 清除所有偏好設定
 */
export const clearFunctionalPreferences = async (req, res) => {
  try {
    const userId = req.user._id

    // 清除資料庫中的功能偏好設定
    await User.findByIdAndUpdate(userId, {
      $unset: {
        'functionalPreferences.theme': 1,
        'functionalPreferences.language': 1,
        'functionalPreferences.personalization': 1,
        'functionalPreferences.searchPreferences': 1,
      },
    })

    // 清除所有功能 Cookie
    const cookiesToClear = ['theme', 'language', 'personalization', 'searchPreferences']

    cookiesToClear.forEach((cookieName) => {
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      })
    })

    logger.info(`使用者 ${userId} 清除所有功能偏好設定`)

    res.json({
      success: true,
      message: '所有功能偏好設定已清除',
      clearedCookies: cookiesToClear,
    })
  } catch (error) {
    logger.error('清除功能偏好設定失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '清除功能偏好設定失敗',
    })
  }
}

/**
 * 取得隱私設定狀態
 */
export const getPrivacyStatus = async (req, res) => {
  try {
    const privacyStatus = {
      hasPrivacyConsent: req.hasPrivacyConsent,
      canUseFunctionalCookies: req.canUseFunctionalCookies,
      canTrackAnalytics: req.canTrackAnalytics,
      canUseNecessaryCookies: req.canUseNecessaryCookies,
      currentConsent: req.privacyConsent
        ? {
            necessary: req.privacyConsent.necessary,
            functional: req.privacyConsent.functional,
            analytics: req.privacyConsent.analytics,
            consentVersion: req.privacyConsent.consentVersion,
            consentSource: req.privacyConsent.consentSource,
            createdAt: req.privacyConsent.createdAt,
          }
        : null,
    }

    res.json({
      success: true,
      data: privacyStatus,
    })
  } catch (error) {
    logger.error('取得隱私設定狀態失敗:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '取得隱私設定狀態失敗',
    })
  }
}

// 建立新使用者
export const createUser = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const user = await User.create([req.body], { session })
    const createdUser = user[0]

    // 產生驗證 token 並發送驗證 email
    let verificationToken = null
    try {
      verificationToken = await VerificationController.generateVerificationToken(
        createdUser._id,
        'email_verification',
        24, // 24 小時過期
      )

      // 發送驗證 email
      await EmailService.sendVerificationEmail(
        createdUser.email,
        verificationToken,
        createdUser.username,
      )
    } catch (emailError) {
      logger.error('發送驗證 email 失敗:', emailError)
      // 即使 email 發送失敗，仍然創建用戶，但記錄錯誤
    }

    // 回傳完整用戶資料（包含 avatarUrl），但移除敏感資訊
    const userObj = createdUser.toJSON()
    delete userObj.password
    delete userObj.tokens

    // 提交事務
    await session.commitTransaction()

    // 回傳成功訊息，包含 email 驗證提示
    res.status(StatusCodes.CREATED).json({
      success: true,
      user: userObj,
      message: '註冊成功！請檢查您的信箱並點擊驗證連結來完成註冊。',
      emailSent: !!verificationToken,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    }

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0]
      let message = ''

      switch (field) {
        case 'username':
          message = '此帳號已被註冊，請選擇其他帳號'
          break
        case 'email':
          message = '此電子郵件已被註冊，請使用其他郵件地址'
          break
        case 'google_id':
          message = '此 Google 帳號已被綁定'
          break
        case 'facebook_id':
          message = '此 Facebook 帳號已被綁定'
          break
        case 'discord_id':
          message = '此 Discord 帳號已被綁定'
          break
        case 'twitter_id':
          message = '此 Twitter 帳號已被綁定'
          break
        default:
          message = `${field} 已被註冊，請更換`
      }

      return res.status(409).json({
        success: false,
        message,
      })
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得單一使用者
export const getUser = async (req, res) => {
  try {
    const { id } = req.params

    // 檢查 ID 是否有效
    if (!id || id === '[object Object]' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的用戶ID',
        debug: { receivedId: id, type: typeof id },
      })
    }

    const user = await User.findById(id).select('-password -tokens')
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, user })
  } catch (error) {
    logger.error('getUser 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
      debug: { error: error.message },
    })
  }
}

// 取得所有使用者（可加分頁）
export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, role, search } = req.query

    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100)

    const query = {}
    if (status) query.status = status
    if (role) query.role = role
    if (search && String(search).trim().length > 0) {
      const keyword = String(search).trim()
      const regex = new RegExp(keyword, 'i')
      query.$or = [{ username: regex }, { email: regex }, { display_name: regex }]
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -tokens')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query),
    ])

    res.json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
      },
    })
  } catch (error) {
    logger.error('getUsers 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 封禁用戶（管理員）
export const banUserById = async (req, res) => {
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    const { reason = '' } = req.body || {}

    const user = await User.findById(id).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }

    user.status = 'banned'
    user.ban_reason = String(reason).slice(0, 200)
    user.deactivate_at = new Date()
    await user.save({ session })

    await session.commitTransaction()
    const userObj = user.toJSON()
    delete userObj.tokens
    delete userObj.password
    res.json({ success: true, user: userObj, message: '用戶已封禁' })
  } catch (error) {
    await session.abortTransaction()
    logger.error('banUserById 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    session.endSession()
  }
}

// 解除封禁（管理員）
export const unbanUserById = async (req, res) => {
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    const user = await User.findById(id).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }

    user.status = 'active'
    user.ban_reason = ''
    await user.save({ session })

    await session.commitTransaction()
    const userObj = user.toJSON()
    delete userObj.tokens
    delete userObj.password
    res.json({ success: true, user: userObj, message: '用戶已解除封禁' })
  } catch (error) {
    await session.abortTransaction()
    logger.error('unbanUserById 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    session.endSession()
  }
}

// 批次軟刪除（管理員）
export const batchSoftDeleteUsers = async (req, res) => {
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { ids } = req.body || {}
    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction()
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: '請提供要刪除的用戶ID陣列' })
    }

    const result = await User.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'deleted', deactivate_at: new Date() } },
      { session },
    )

    await session.commitTransaction()
    res.json({ success: true, modifiedCount: result.modifiedCount })
  } catch (error) {
    await session.abortTransaction()
    logger.error('batchSoftDeleteUsers 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    session.endSession()
  }
}

// 匯出 CSV（管理員）
export const exportUsersCsv = async (req, res) => {
  try {
    const { status, role, search, page, limit } = req.query

    // 與列表相同的查詢條件（但匯出預設不分頁，如有 page/limit 則套用）
    const query = {}
    if (status) query.status = status
    if (role) query.role = role
    if (search && String(search).trim().length > 0) {
      const keyword = String(search).trim()
      const regex = new RegExp(keyword, 'i')
      query.$or = [{ username: regex }, { email: regex }, { display_name: regex }]
    }

    let dataQuery = User.find(query).sort({ createdAt: -1 })
    if (page || limit) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1)
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 5000)
      dataQuery = dataQuery.skip((pageNum - 1) * limitNum).limit(limitNum)
    }

    const users = await dataQuery.select(
      'username email role status createdAt last_login_at meme_count total_likes_received',
    )

    // 產生 CSV
    const header = [
      'id',
      'username',
      'email',
      'role',
      'status',
      'createdAt',
      'lastLogin',
      'memeCount',
      'totalLikesReceived',
    ]
    const rows = users.map((u) => [
      u._id,
      u.username,
      u.email || '',
      u.role,
      u.status,
      u.createdAt ? new Date(u.createdAt).toISOString() : '',
      u.last_login_at ? new Date(u.last_login_at).toISOString() : '',
      typeof u.meme_count === 'number' ? u.meme_count : 0,
      typeof u.total_likes_received === 'number' ? u.total_likes_received : 0,
    ])

    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((v) => String(v).replace(/"/g, '""'))
          .map((v) => `"${v}"`)
          .join(','),
      )
      .join('\n')

    const filename = `users-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.status(StatusCodes.OK).send(csv)
  } catch (error) {
    logger.error('exportUsersCsv 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '匯出失敗' })
  }
}

// 更新使用者
export const updateUser = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    // 檢查是否要更新頭像
    const isUpdatingAvatar = req.body.avatar !== undefined
    let oldAvatarUrl = null

    // 如果要更新頭像，先取得舊的頭像 URL
    if (isUpdatingAvatar) {
      const currentUser = await User.findById(req.params.id).session(session)
      if (currentUser && currentUser.avatar) {
        oldAvatarUrl = currentUser.avatar
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }

    // 提交事務
    await session.commitTransaction()

    // 如果更新了頭像且有舊的頭像 URL，刪除舊的 Cloudinary 圖片
    if (isUpdatingAvatar && oldAvatarUrl && oldAvatarUrl !== user.avatar) {
      try {
        await deleteImageByUrl(oldAvatarUrl)
        logger.info('成功刪除舊頭像:', oldAvatarUrl)
      } catch (deleteError) {
        logger.error('刪除舊頭像失敗:', deleteError)
        // 不影響主要操作，只記錄錯誤
      }
    }

    res.json({ success: true, user })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: error.errors[key].message,
      })
    }

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0]
      let message = ''

      switch (field) {
        case 'username':
          message = '此帳號已被其他使用者使用，請選擇其他帳號'
          break
        case 'email':
          message = '此電子郵件已被其他使用者註冊，請使用其他郵件地址'
          break
        case 'google_id':
          message = '此 Google 帳號已被其他使用者綁定'
          break
        case 'facebook_id':
          message = '此 Facebook 帳號已被其他使用者綁定'
          break
        case 'discord_id':
          message = '此 Discord 帳號已被其他使用者綁定'
          break
        case 'twitter_id':
          message = '此 Twitter 帳號已被其他使用者綁定'
          break
        default:
          message = `${field} 已被其他使用者使用，請更換`
      }

      return res.status(409).json({
        success: false,
        message,
      })
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除使用者
export const deleteUser = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const user = await User.findByIdAndDelete(req.params.id).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到使用者' })
    }

    // 提交事務
    await session.commitTransaction()

    // 如果用戶有頭像，刪除 Cloudinary 圖片
    if (user.avatar) {
      try {
        await deleteImageByUrl(user.avatar)
        logger.info('成功刪除用戶頭像:', user.avatar)
      } catch (deleteError) {
        logger.error('刪除用戶頭像失敗:', deleteError)
        // 不影響主要操作，只記錄錯誤
      }
    }

    res.json({ success: true, message: '使用者已刪除' })
  } catch {
    // 回滾事務
    await session.abortTransaction()
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 綁定社群帳號
export const bindSocialAccount = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const userId = req.user._id
    const { provider } = req.params
    const { socialId } = req.body // 前端應傳入社群平台的唯一 ID

    // 支援的 provider
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      await session.abortTransaction()
      return res.status(400).json({ success: false, message: '不支援的社群平台' })
    }

    // 檢查該社群 ID 是否已被其他帳號綁定
    const query = {}
    query[`${provider}_id`] = socialId
    const existing = await User.findOne(query).session(session)
    if (existing) {
      await session.abortTransaction()
      return res.status(409).json({ success: false, message: '此社群帳號已被其他用戶綁定' })
    }

    // 綁定到目前登入的帳號
    const user = await User.findById(userId).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }

    user[`${provider}_id`] = socialId
    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({ success: true, message: `成功綁定${provider}帳號` })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    logger.error('綁定社群帳號錯誤:', error)

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0]
      let message = ''

      switch (field) {
        case 'google_id':
          message = '此 Google 帳號已被其他使用者綁定'
          break
        case 'facebook_id':
          message = '此 Facebook 帳號已被其他使用者綁定'
          break
        case 'discord_id':
          message = '此 Discord 帳號已被其他使用者綁定'
          break
        case 'twitter_id':
          message = '此 Twitter 帳號已被其他使用者綁定'
          break
        default:
          message = '此社群帳號已被其他使用者綁定'
      }

      return res.status(409).json({
        success: false,
        message,
      })
    }

    res.status(500).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得自己的使用者資料
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -tokens')
    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }
    res.json({ success: true, user })
  } catch {
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 更新自己的資料
export const updateMe = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    // 檢查是否要更新頭像
    const isUpdatingAvatar = req.body.avatar !== undefined
    let oldAvatarUrl = null

    // 如果要更新頭像，先取得舊的頭像 URL
    if (isUpdatingAvatar) {
      const currentUser = await User.findById(req.user._id).session(session)
      if (currentUser && currentUser.avatar) {
        oldAvatarUrl = currentUser.avatar
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!user) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }

    // 提交事務
    await session.commitTransaction()

    // 如果更新了頭像且有舊的頭像 URL，刪除舊的 Cloudinary 圖片
    if (isUpdatingAvatar && oldAvatarUrl && oldAvatarUrl !== user.avatar) {
      try {
        await deleteImageByUrl(oldAvatarUrl)
        logger.info('成功刪除舊頭像:', oldAvatarUrl)
      } catch (deleteError) {
        logger.error('刪除舊頭像失敗:', deleteError)
        // 不影響主要操作，只記錄錯誤
      }
    }

    res.json({ success: true, user })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    if (error.name === 'ValidationError') {
      const key = Object.keys(error.errors)[0]
      return res.status(400).json({
        success: false,
        message: error.errors[key].message,
      })
    }

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0]
      let message = ''

      switch (field) {
        case 'username':
          message = '此帳號已被其他使用者使用，請選擇其他帳號'
          break
        case 'email':
          message = '此電子郵件已被其他使用者註冊，請使用其他郵件地址'
          break
        case 'google_id':
          message = '此 Google 帳號已被其他使用者綁定'
          break
        case 'facebook_id':
          message = '此 Facebook 帳號已被其他使用者綁定'
          break
        case 'discord_id':
          message = '此 Discord 帳號已被其他使用者綁定'
          break
        case 'twitter_id':
          message = '此 Twitter 帳號已被其他使用者綁定'
          break
        default:
          message = `${field} 已被其他使用者使用，請更換`
      }

      return res.status(409).json({
        success: false,
        message,
      })
    }

    res.status(500).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除自己的帳號
export const deleteMe = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const user = await User.findByIdAndDelete(req.user._id).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }

    // 提交事務
    await session.commitTransaction()

    // 如果用戶有頭像，刪除 Cloudinary 圖片
    if (user.avatar) {
      try {
        await deleteImageByUrl(user.avatar)
        logger.info('成功刪除用戶頭像:', user.avatar)
      } catch (deleteError) {
        logger.error('刪除用戶頭像失敗:', deleteError)
        // 不影響主要操作，只記錄錯誤
      }
    }

    res.json({ success: true, message: '使用者已刪除' })
  } catch {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 取得活躍用戶（按迷因數量排序）
export const getActiveUsers = async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const limitNum = parseInt(limit, 10)

    // 驗證 limit 參數
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'limit 參數必須是 1-50 之間的數字',
      })
    }

    // 查詢活躍用戶，按迷因數量降序排列
    const activeUsers = await User.aggregate([
      {
        $match: {
          meme_count: { $exists: true, $ne: null, $gt: 0 },
        },
      },
      {
        $project: {
          username: 1,
          display_name: 1,
          avatar: 1,
          bio: 1,
          meme_count: 1,
          total_likes_received: 1,
          follower_count: 1,
        },
      },
      {
        $sort: { meme_count: -1 },
      },
      {
        $limit: limitNum,
      },
    ])

    res.json({
      success: true,
      activeUsers,
      count: activeUsers.length,
    })
  } catch (error) {
    logger.error('getActiveUsers 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 密碼變更 API
export const changePassword = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user._id

    // 驗證新密碼
    if (!newPassword) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供新密碼',
      })
    }

    // 驗證新密碼長度
    if (newPassword.length < 8 || newPassword.length > 20) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '新密碼長度必須在8到20個字元之間',
      })
    }

    // 取得用戶資料
    const user = await User.findById(userId).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到使用者',
      })
    }

    // 檢查用戶是否已有密碼（使用 has_password 欄位判斷）
    const hasExistingPassword = user.has_password

    // 如果用戶已有密碼，則需要驗證目前密碼
    if (hasExistingPassword) {
      if (!currentPassword) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '請提供目前密碼',
        })
      }

      // 驗證目前密碼
      const isPasswordValid = bcrypt.compareSync(currentPassword, user.password)
      if (!isPasswordValid) {
        await session.abortTransaction()
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: '目前密碼不正確',
        })
      }

      // 檢查新密碼是否與目前密碼相同
      if (bcrypt.compareSync(newPassword, user.password)) {
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: '新密碼不能與目前密碼相同',
        })
      }
    }

    // 更新密碼
    user.password = newPassword

    // 如果是社群用戶設定密碼，將 has_password 設為 true
    if (!hasExistingPassword) {
      user.has_password = true
    }

    await user.save({ session })

    // 只有變更密碼時才清除 token（社群用戶第一次設定密碼不需要）
    if (hasExistingPassword) {
      // 清除所有登入 token（強制重新登入）
      user.tokens = []
      await user.save({ session })
    }

    // 提交事務
    await session.commitTransaction()

    const message = hasExistingPassword ? '密碼已成功變更，請重新登入' : '密碼已成功設定'

    res.json({
      success: true,
      message,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    logger.error('changePassword 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 電子信箱變更 API
export const changeEmail = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { newEmail, currentPassword } = req.body
    const userId = req.user._id

    // 驗證輸入
    if (!newEmail || !currentPassword) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供新電子信箱和目前密碼',
      })
    }

    // 驗證電子信箱格式
    if (!validator.isEmail(newEmail)) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請輸入有效的電子信箱地址',
      })
    }

    // 取得用戶資料
    const user = await User.findById(userId).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到使用者',
      })
    }

    // 驗證目前密碼
    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password)
    if (!isPasswordValid) {
      await session.abortTransaction()
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: '目前密碼不正確',
      })
    }

    // 檢查新電子信箱是否與目前相同
    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '新電子信箱不能與目前電子信箱相同',
      })
    }

    // 檢查新電子信箱是否已被其他用戶使用
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() }).session(session)
    if (existingUser) {
      await session.abortTransaction()
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '此電子信箱已被其他使用者註冊',
      })
    }

    // 更新電子信箱
    user.email = newEmail.toLowerCase()
    user.email_verified = false // 重置驗證狀態
    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

    // 在事務提交後發送驗證 email（避免在事務中發送 email）
    let verificationToken = null
    try {
      verificationToken = await VerificationController.generateVerificationToken(
        user._id,
        'email_verification',
        24, // 24 小時過期
      )

      // 發送驗證 email
      await EmailService.sendVerificationEmail(
        newEmail.toLowerCase(),
        verificationToken,
        user.username,
      )

      logger.info(`電子信箱變更驗證 email 已發送給用戶 ${user._id} 到 ${newEmail}`)
    } catch (emailError) {
      logger.error('發送電子信箱變更驗證 email 失敗:', emailError)
      // 即使 email 發送失敗，仍然回傳成功，但記錄錯誤
    }

    res.json({
      success: true,
      message: '電子信箱已成功變更，驗證信已發送到您的新信箱，請檢查並點擊驗證連結來完成驗證。',
      emailSent: !!verificationToken,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    logger.error('changeEmail 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 社群帳號解除綁定 API
export const unbindSocialAccount = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const userId = req.user._id
    const { provider } = req.params

    // 支援的 provider
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不支援的社群平台',
      })
    }

    // 取得用戶資料
    const user = await User.findById(userId).session(session)
    if (!user) {
      await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到使用者',
      })
    }

    // 檢查是否已綁定該社群帳號
    const socialIdField = `${provider}_id`
    if (!user[socialIdField]) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `尚未綁定${provider}帳號`,
      })
    }

    // 檢查是否為主要登入方式
    if (user.login_method === provider) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `無法解除綁定主要登入方式，請先設定其他登入方式`,
      })
    }

    // 解除綁定
    user[socialIdField] = undefined
    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({
      success: true,
      message: `成功解除綁定${provider}帳號`,
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    logger.error('unbindSocialAccount 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 用戶搜索 API
export const searchUsers = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query

    // 驗證搜索參數
    if (!q || q.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供搜索關鍵字',
      })
    }

    // 驗證 limit 參數
    const limitNum = parseInt(limit, 10)
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'limit 參數必須是 1-50 之間的數字',
      })
    }

    const searchQuery = q.trim()

    // 搜索用戶（按用戶名和顯示名稱搜索）
    const searchRegex = new RegExp(searchQuery, 'i')
    const users = await User.find({
      $or: [{ username: searchRegex }, { display_name: searchRegex }],
    })
      .select('username display_name avatar bio follower_count meme_count')
      .limit(limitNum)
      .sort({ follower_count: -1, meme_count: -1 }) // 按追蹤者數量和迷因數量排序

    res.json({
      success: true,
      data: users,
      count: users.length,
    })
  } catch (error) {
    logger.error('searchUsers 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 手動執行刪除提醒任務（管理員專用）
export const sendDeletionReminders = async (req, res) => {
  try {
    // 檢查用戶權限
    if (req.user.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '只有管理員可以執行此操作',
      })
    }

    await manualSendDeletionReminders()

    res.json({
      success: true,
      message: '刪除提醒任務已執行完成',
    })
  } catch (error) {
    logger.error('sendDeletionReminders 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '執行刪除提醒任務失敗',
    })
  }
}

// 手動執行刪除未驗證用戶任務（管理員專用）
export const deleteUnverifiedUsers = async (req, res) => {
  try {
    // 檢查用戶權限
    if (req.user.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '只有管理員可以執行此操作',
      })
    }

    await manualDeleteUnverifiedUsers()

    res.json({
      success: true,
      message: '刪除未驗證用戶任務已執行完成',
    })
  } catch (error) {
    logger.error('deleteUnverifiedUsers 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '執行刪除未驗證用戶任務失敗',
    })
  }
}

// 獲取未驗證用戶統計資訊（管理員專用）
export const getUnverifiedUsersStats = async (req, res) => {
  try {
    // 檢查用戶權限
    if (req.user.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: '只有管理員可以查看此資訊',
      })
    }

    const elevenMonthsAgo = new Date()
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    // 獲取需要提醒的用戶數量
    const usersNeedingReminder = await User.countDocuments({
      email_verified: false,
      createdAt: { $lte: elevenMonthsAgo },
      status: { $ne: 'deleted' },
    })

    // 獲取需要刪除的用戶數量
    const usersToDelete = await User.countDocuments({
      email_verified: false,
      createdAt: { $lte: oneYearAgo },
      status: { $ne: 'deleted' },
    })

    // 獲取所有未驗證用戶數量
    const totalUnverified = await User.countDocuments({
      email_verified: false,
      status: { $ne: 'deleted' },
    })

    res.json({
      success: true,
      data: {
        totalUnverified,
        usersNeedingReminder,
        usersToDelete,
        nextReminderDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明天凌晨2點
        nextDeletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明天凌晨3點
      },
    })
  } catch (error) {
    logger.error('getUnverifiedUsersStats 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '獲取未驗證用戶統計資訊失敗',
    })
  }
}

// 忘記密碼 API
export const forgotPassword = async (req, res) => {
  const enableSession = process.env.NODE_ENV !== 'test'
  let session = null
  if (enableSession) {
    session = await User.startSession()
    session.startTransaction()
  }

  try {
    const { email } = req.body

    if (!email) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供 email 地址',
      })
    }

    // 驗證 email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供有效的 email 地址',
      })
    }

    // 查找用戶
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到此 email 對應的用戶',
      })
    }

    // 檢查是否有未過期的密碼重設 token - 使用 mongoose.trusted 避免日期 CastError
    const existingToken = await VerificationToken.findOne({
      userId: user._id,
      type: 'password_reset',
      used: false,
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    })

    if (existingToken) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: '密碼重設 email 已發送，請檢查您的信箱或稍後再試',
      })
    }

    // 產生密碼重設 token（1 小時過期）
    const resetToken = await VerificationController.generateVerificationToken(
      user._id,
      'password_reset',
      1,
    )

    // 發送密碼重設 email
    await EmailService.sendPasswordResetEmail(email, resetToken, user.username)

    // 提交事務（測試環境無事務）
    if (session) await session.commitTransaction()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '密碼重設 email 已發送',
      data: { email, sentAt: new Date().toISOString() },
    })
  } catch (error) {
    if (session) await session.abortTransaction()
    logger.error('忘記密碼處理失敗:', error)

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '處理忘記密碼請求時發生錯誤',
      error: error.message,
    })
  } finally {
    if (session) session.endSession()
  }
}

export const resetPassword = async (req, res) => {
  const enableSession = process.env.NODE_ENV !== 'test'
  let session = null
  if (enableSession) {
    session = await User.startSession()
    session.startTransaction()
  }

  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供 token 和新密碼',
      })
    }

    if (newPassword.length < 8 || newPassword.length > 20) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '新密碼長度必須在8到20個字元之間',
      })
    }

    // 查找並驗證 token - 使用 mongoose.trusted 避免日期 CastError
    const verificationToken = await VerificationToken.findOne({
      token,
      type: 'password_reset',
      used: false,
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    })

    if (!verificationToken) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效或已過期的重設連結',
      })
    }

    // 查找用戶
    const user = await User.findById(verificationToken.userId)
    if (!user) {
      if (session) await session.abortTransaction()
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到對應的用戶' })
    }

    // 更新密碼
    user.password = newPassword
    await user.save()

    // 標記 token 為已使用
    verificationToken.used = true
    await verificationToken.save()

    // 清除所有登入 token（強制重新登入）
    user.tokens = []
    await user.save()

    if (session) await session.commitTransaction()

    res.status(StatusCodes.OK).json({ success: true, message: '密碼重設成功，請使用新密碼登入' })
  } catch (error) {
    if (session) await session.abortTransaction()
    logger.error('重設密碼失敗:', error)

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '重設密碼時發生錯誤',
      error: error.message,
    })
  } finally {
    if (session) session.endSession()
  }
}

// OAuth 綁定相關函數

// 獲取前端 URL 的輔助函數
const getFrontendUrl = () => {
  let frontendUrl =
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://www.memedam.com' : 'http://localhost:5173')

  // 在生產環境強制使用 HTTPS 以避免 Cloudflare 522 錯誤
  if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
    frontendUrl = frontendUrl.replace('http://', 'https://')
  }

  return frontendUrl
}

// 生成 state 參數用於防止 CSRF 攻擊
const generateState = () => {
  return crypto.randomBytes(32).toString('hex')
}

// 已不需要 validateState，移除以避免未使用變數的 linter 警告

// 初始化 OAuth 綁定流程
export const initBindAuth = async (req, res) => {
  try {
    const { provider } = req.params
    const userId = req.user._id

    logger.info('🔐 開始初始化 OAuth 綁定:', {
      provider,
      userId: userId.toString(),
      sessionExists: !!req.session,
      sessionId: req.sessionID,
      userAgent: req.get('User-Agent'),
      remoteAddress: req.ip,
    })

    // 支援的 provider
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      logger.warn('⚠️ 不支援的社群平台:', { provider, validProviders })
      return res.status(400).json({ success: false, message: '不支援的社群平台' })
    }

    // 檢查用戶是否已經綁定了該平台
    const user = await User.findById(userId)
    if (!user) {
      logger.error('❌ 找不到用戶:', { userId: userId.toString() })
      return res.status(404).json({ success: false, message: '找不到用戶' })
    }

    if (user[`${provider}_id`]) {
      logger.info('ℹ️ 用戶已綁定該平台:', {
        userId: userId.toString(),
        provider,
        existingId: user[`${provider}_id`],
      })
      return res.status(409).json({
        success: false,
        message: `您已經綁定了 ${provider} 帳號`,
      })
    }

    // 生成 state 參數
    const state = generateState()
    logger.info('✅ 生成 state 參數:', { state: state.substring(0, 10) + '...' })

    // 將 state 和用戶 ID 存儲到 session 中
    if (!req.session) {
      logger.warn('⚠️ 沒有 session，創建新的 session')
      req.session = {}
    }

    req.session.oauthState = state
    req.session.bindUserId = userId.toString()
    req.session.bindProvider = provider

    logger.info('設置 OAuth 會話狀態:', {
      state: state.substring(0, 10) + '...',
      userId: userId.toString(),
      provider,
      sessionId: req.sessionID,
      sessionKeys: Object.keys(req.session),
    })

    // 強制保存會話以確保狀態持久化
    try {
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            logger.error('❌ 會話保存失敗:', {
              error: err.message,
              stack: err.stack,
              sessionId: req.sessionID,
              provider,
              userId: userId.toString(),
            })
            reject(err)
          } else {
            logger.info('✅ 會話保存成功')
            resolve()
          }
        })
      })
    } catch (sessionError) {
      logger.error('❌ 會話保存過程中發生錯誤:', {
        error: sessionError.message,
        stack: sessionError.stack,
        sessionId: req.sessionID,
        provider,
        userId: userId.toString(),
      })
      // 即使 session 保存失敗，也繼續嘗試綁定流程
    }

    // 重定向到 OAuth 授權頁面
    const authUrl = `/api/users/bind-auth/${provider}/init?state=${state}`
    logger.info('✅ OAuth 綁定初始化成功:', {
      provider,
      userId: userId.toString(),
      authUrl,
      state: state.substring(0, 10) + '...',
    })

    res.json({
      success: true,
      authUrl,
      state,
      message: `正在初始化 ${provider} 綁定流程`,
    })
  } catch (error) {
    logger.error('❌ 初始化 OAuth 綁定錯誤:', {
      error: error.message,
      stack: error.stack,
      provider: req.params?.provider,
      userId: req.user?._id?.toString(),
      sessionExists: !!req.session,
      sessionId: req.sessionID,
    })
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 處理 OAuth 綁定回調
export const handleBindAuthCallback = async (req, res) => {
  try {
    const { provider } = req.params
    const { state } = req.query

    logger.info('=== OAuth 綁定回調處理開始 ===', {
      provider,
      state: state ? state.substring(0, 10) + '...' : null,
      sessionExists: !!req.session,
      sessionId: req.sessionID,
    })

    // 驗證 state 參數
    if (!state) {
      logger.error('❌ 缺少 state 參數')
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('無效的 state 參數')}`,
      )
    }

    // 從臨時存儲中獲取綁定資訊
    const { getBindState, removeBindState } = await import('../utils/oauthTempStore.js')
    const storedBindState = getBindState(state)

    if (!storedBindState) {
      logger.error('❌ 找不到綁定狀態或已過期:', state)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('綁定狀態無效或已過期')}`,
      )
    }

    const bindUserId = storedBindState.userId
    const bindProvider = storedBindState.provider

    logger.info('✅ 成功獲取綁定狀態:', {
      userId: bindUserId,
      provider: bindProvider,
      expectedProvider: provider,
    })

    if (!bindUserId || bindProvider !== provider) {
      logger.error('❌ 綁定資訊無效:', {
        bindUserId,
        bindProvider,
        expectedProvider: provider,
      })
      removeBindState(state)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('綁定資訊無效')}`,
      )
    }

    // 使用 session 來確保原子性操作
    const session = await User.startSession()
    session.startTransaction()

    try {
      // 獲取用戶資訊
      const user = await User.findById(bindUserId).session(session)
      if (!user) {
        await session.abortTransaction()
        const frontendUrl = getFrontendUrl()
        return res.redirect(
          `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('找不到使用者')}`,
        )
      }

      // 從 OAuth 回調中獲取社群帳號 ID
      // 綁定策略會返回 { profile, provider } 格式
      let socialId = null
      if (req.user && req.user.profile) {
        // 綁定策略的結果
        socialId = req.user.profile.id
      } else if (req.user && req.user[`${provider}_id`]) {
        // 登入策略的結果
        socialId = req.user[`${provider}_id`]
      } else {
        socialId = req.query.social_id
      }

      if (!socialId) {
        await session.abortTransaction()
        const frontendUrl = getFrontendUrl()
        return res.redirect(
          `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('無法獲取社群帳號資訊')}`,
        )
      }

      // 檢查該社群 ID 是否已被其他帳號綁定
      const query = {}
      query[`${provider}_id`] = socialId
      const existing = await User.findOne(query).session(session)
      if (existing && existing._id.toString() !== bindUserId) {
        await session.abortTransaction()
        const frontendUrl = getFrontendUrl()
        return res.redirect(
          `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('此社群帳號已被其他用戶綁定')}`,
        )
      }

      // 綁定社群帳號
      user[`${provider}_id`] = socialId
      await user.save({ session })

      // 清理臨時存儲
      removeBindState(state)

      // 提交事務
      await session.commitTransaction()

      logger.info('✅ OAuth 綁定成功:', {
        userId: bindUserId,
        provider,
        socialId,
      })

      // 重定向到前端設定頁面，帶上成功訊息
      const frontendUrl = getFrontendUrl()
      res.redirect(
        `${frontendUrl}/settings?success=true&message=${encodeURIComponent(`成功綁定 ${provider} 帳號`)}`,
      )
    } catch (error) {
      // 回滾事務
      await session.abortTransaction()
      throw error
    } finally {
      // 結束 session
      session.endSession()
    }
  } catch (error) {
    logger.error('OAuth 綁定回調錯誤:', error)

    // 清理臨時存儲（如果存在）
    if (req?.query?.state) {
      try {
        const { removeBindState } = await import('../utils/oauthTempStore.js')
        removeBindState(req.query.state)
      } catch (cleanupError) {
        logger.error('清理臨時存儲失敗:', cleanupError)
      }
    }

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0]
      let message = ''

      switch (field) {
        case 'google_id':
          message = '此 Google 帳號已被其他使用者綁定'
          break
        case 'facebook_id':
          message = '此 Facebook 帳號已被其他使用者綁定'
          break
        case 'discord_id':
          message = '此 Discord 帳號已被其他使用者綁定'
          break
        case 'twitter_id':
          message = '此 Twitter 帳號已被其他使用者綁定'
          break
        default:
          message = '此社群帳號已被其他使用者綁定'
      }

      // 重定向到前端設定頁面，帶上錯誤訊息
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent(message)}`,
      )
    }

    // 重定向到前端設定頁面，帶上錯誤訊息
    const frontendUrl = getFrontendUrl()
    res.redirect(
      `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('綁定失敗，請稍後再試')}`,
    )
  }
}

// 獲取綁定狀態
export const getBindStatus = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).select('google_id facebook_id discord_id twitter_id')

    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }

    const bindStatus = {
      google: !!user.google_id,
      facebook: !!user.facebook_id,
      discord: !!user.discord_id,
      twitter: !!user.twitter_id,
    }

    res.json({
      success: true,
      bindStatus,
      message: '成功獲取綁定狀態',
    })
  } catch (error) {
    logger.error('獲取綁定狀態錯誤:', error)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 檢查使用者是否已設定密碼
export const checkPasswordStatus = async (req, res) => {
  try {
    const userId = req.user._id
    const user = await User.findById(userId).select('has_password password')

    if (!user) {
      return res.status(404).json({ success: false, message: '找不到使用者' })
    }

    res.json({
      success: true,
      hasPassword: user.has_password,
      message: '成功獲取密碼狀態',
    })
  } catch (error) {
    logger.error('檢查密碼狀態錯誤:', error)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 獲取用戶統計資訊
export const getStats = async (req, res) => {
  try {
    const { id } = req.params

    // 檢查 ID 是否有效
    if (!id || id === '[object Object]' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效的用戶ID',
        debug: { receivedId: id, type: typeof id },
      })
    }

    const user = await User.findById(
      id,
      'follower_count following_count meme_count collection_count total_likes_received comment_count share_count',
    )

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶',
      })
    }

    res.json({
      success: true,
      data: {
        follower_count: user.follower_count || 0,
        following_count: user.following_count || 0,
        meme_count: user.meme_count || 0,
        collection_count: user.collection_count || 0,
        total_likes_received: user.total_likes_received || 0,
        comment_count: user.comment_count || 0,
        share_count: user.share_count || 0,
      },
    })
  } catch (error) {
    logger.error('獲取用戶統計錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}
