import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'
import smartCacheInvalidator, { CACHE_OPERATIONS } from '../utils/smartCacheInvalidator.js'

/**
 * 偏好設定控制器
 * 處理使用者偏好設定，根據隱私同意控制功能 Cookie
 */

class PreferencesController {
  /**
   * 設定使用者主題偏好
   * 只有當使用者同意功能 Cookie 時才設定
   */
  async setTheme(req, res, next) {
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

      // 驗證主題選項
      const validThemes = ['light', 'dark', 'auto']
      if (!validThemes.includes(theme)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: '無效的主題選項',
          validOptions: validThemes,
        })
      }

      // 設定功能 Cookie
      res.cookie('theme', theme, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
        path: '/',
      })

      logger.info(`使用者 ${req.user?._id || 'anonymous'} 設定主題: ${theme}`)

      // 智慧快取失效
      if (req.user?._id) {
        try {
          await smartCacheInvalidator.invalidateByOperation(
            CACHE_OPERATIONS.USER_THEME_UPDATE,
            {
              userId: req.user._id.toString(),
              theme,
            },
            { skipLogging: true },
          )
        } catch (cacheError) {
          logger.warn('用戶主題偏好更新快取失效失敗', {
            userId: req.user._id.toString(),
            error: cacheError.message,
          })
        }
      }

      res.json({
        success: true,
        message: '主題偏好已儲存',
        data: { theme },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * 設定語言偏好
   */
  async setLanguage(req, res, next) {
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

      // 驗證語言選項
      const validLanguages = ['zh-TW', 'en-US', 'ja-JP']
      if (!validLanguages.includes(language)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: '無效的語言選項',
          validOptions: validLanguages,
        })
      }

      // 設定功能 Cookie
      res.cookie('language', language, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
        path: '/',
      })

      logger.info(`使用者 ${req.user?._id || 'anonymous'} 設定語言: ${language}`)

      // 智慧快取失效
      if (req.user?._id) {
        try {
          await smartCacheInvalidator.invalidateByOperation(
            CACHE_OPERATIONS.USER_LANGUAGE_UPDATE,
            {
              userId: req.user._id.toString(),
              language,
            },
            { skipLogging: true },
          )
        } catch (cacheError) {
          logger.warn('用戶語言偏好更新快取失效失敗', {
            userId: req.user._id.toString(),
            error: cacheError.message,
          })
        }
      }

      res.json({
        success: true,
        message: '語言偏好已儲存',
        data: { language },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * 設定個人化偏好
   */
  async setPersonalization(req, res, next) {
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

      // 設定功能 Cookie
      res.cookie('personalization', JSON.stringify(personalization), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
        path: '/',
      })

      logger.info(`使用者 ${req.user?._id || 'anonymous'} 更新個人化設定`)

      // 智慧快取失效
      if (req.user?._id) {
        try {
          await smartCacheInvalidator.invalidateByOperation(
            CACHE_OPERATIONS.USER_PERSONALIZATION_UPDATE,
            {
              userId: req.user._id.toString(),
              personalization,
            },
            { skipLogging: true },
          )
        } catch (cacheError) {
          logger.warn('用戶個人化設定更新快取失效失敗', {
            userId: req.user._id.toString(),
            error: cacheError.message,
          })
        }
      }

      res.json({
        success: true,
        message: '個人化偏好已儲存',
        data: personalization,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * 設定搜尋偏好
   */
  async setSearchPreferences(req, res, next) {
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

      // 建立搜尋偏好物件
      const searchPreferences = {
        searchHistory: searchHistory !== undefined ? searchHistory : true,
        searchSuggestions: searchSuggestions !== undefined ? searchSuggestions : true,
        defaultSort: defaultSort || 'hot',
        defaultFilter: defaultFilter || 'all',
      }

      // 設定功能 Cookie
      res.cookie('searchPreferences', JSON.stringify(searchPreferences), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 年
        path: '/',
      })

      logger.info(`使用者 ${req.user?._id || 'anonymous'} 更新搜尋偏好`)

      // 智慧快取失效
      if (req.user?._id) {
        try {
          await smartCacheInvalidator.invalidateByOperation(
            CACHE_OPERATIONS.USER_SEARCH_PREFERENCES_UPDATE,
            {
              userId: req.user._id.toString(),
              searchPreferences,
            },
            { skipLogging: true },
          )
        } catch (cacheError) {
          logger.warn('用戶搜尋偏好更新快取失效失敗', {
            userId: req.user._id.toString(),
            error: cacheError.message,
          })
        }
      }

      res.json({
        success: true,
        message: '搜尋偏好已儲存',
        data: searchPreferences,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * 取得當前偏好設定
   */
  async getPreferences(req, res, next) {
    try {
      const preferences = {
        theme: req.cookies?.theme || 'auto',
        language: req.cookies?.language || 'zh-TW',
        personalization: req.cookies?.personalization
          ? JSON.parse(req.cookies.personalization)
          : {
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
          ? JSON.parse(req.cookies.searchPreferences)
          : {
              searchHistory: true,
              searchSuggestions: true,
              defaultSort: 'hot',
              defaultFilter: 'all',
            },
      }

      // 如果使用者不同意功能 Cookie，返回預設值
      if (req.skipFunctionalCookies || !req.canUseFunctionalCookies) {
        res.json({
          success: true,
          message: '功能 Cookie 已停用，使用預設設定',
          data: preferences,
          functionalCookiesEnabled: false,
        })
      } else {
        res.json({
          success: true,
          data: preferences,
          functionalCookiesEnabled: true,
        })
      }
    } catch (error) {
      next(error)
    }
  }

  /**
   * 清除所有偏好設定
   */
  async clearPreferences(req, res, next) {
    try {
      // 清除所有功能 Cookie
      const cookiesToClear = ['theme', 'language', 'personalization', 'searchPreferences']

      cookiesToClear.forEach((cookieName) => {
        res.clearCookie(cookieName, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        })
      })

      logger.info(`使用者 ${req.user?._id || 'anonymous'} 清除所有偏好設定`)

      // 智慧快取失效
      if (req.user?._id) {
        try {
          await smartCacheInvalidator.invalidateByOperation(
            CACHE_OPERATIONS.USER_PREFERENCES_CLEAR,
            {
              userId: req.user._id.toString(),
            },
            { skipLogging: true },
          )
        } catch (cacheError) {
          logger.warn('用戶偏好設定清除快取失效失敗', {
            userId: req.user._id.toString(),
            error: cacheError.message,
          })
        }
      }

      res.json({
        success: true,
        message: '所有偏好設定已清除',
        clearedCookies: cookiesToClear,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * 取得隱私設定狀態
   */
  async getPrivacyStatus(req, res, next) {
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
      next(error)
    }
  }
}

export default new PreferencesController()
