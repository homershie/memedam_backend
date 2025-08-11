import { StatusCodes } from 'http-status-codes'
import { generateUsernameSuggestions } from '../utils/usernameGenerator.js'

/**
 * 為OAuth登入提供username建議預覽
 * POST /api/username/preview
 * Body: { provider: 'google|facebook|discord|twitter', profile: {...} }
 */
export const previewUsername = async (req, res) => {
  try {
    const { provider, profile } = req.body

    // 驗證必要參數
    if (!provider || !profile) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少必要參數：provider 和 profile'
      })
    }

    // 驗證provider類型
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不支援的社群平台類型'
      })
    }

    // 生成username建議
    const suggestions = await generateUsernameSuggestions(profile, provider, 5)

    res.json({
      success: true,
      data: {
        provider,
        suggestions,
        message: `為 ${provider} 帳號生成了 ${suggestions.length} 個username建議`
      }
    })

  } catch (error) {
    console.error('Username預覽錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '生成username建議時發生錯誤'
    })
  }
}

/**
 * 檢查username是否可用
 * GET /api/username/check/:username
 */
export const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params

    // 驗證username格式
    if (!username || typeof username !== 'string') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Username格式不正確'
      })
    }

    // 檢查username長度和格式
    if (username.length < 8 || username.length > 20) {
      return res.json({
        success: true,
        available: false,
        reason: 'username長度必須在8-20個字元之間'
      })
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      return res.json({
        success: true,
        available: false,
        reason: 'username只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)'
      })
    }

    // 檢查是否已被使用（動態導入避免循環依賴）
    const { default: User } = await import('../models/User.js')
    const existingUser = await User.findOne({ username: username.toLowerCase() })

    res.json({
      success: true,
      available: !existingUser,
      username: username.toLowerCase(),
      reason: existingUser ? 'Username已被使用' : null
    })

  } catch (error) {
    console.error('檢查username可用性錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '檢查username可用性時發生錯誤'
    })
  }
}

/**
 * 為已登入用戶提供username變更建議
 * GET /api/username/suggestions
 * 需要JWT認證
 */
export const getUsernameSuggestions = async (req, res) => {
  try {
    const userId = req.user?.user?._id

    if (!userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: '需要登入才能使用此功能'
      })
    }

    // 動態導入避免循環依賴
    const { default: User } = await import('../models/User.js')
    const user = await User.findById(userId)

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶資料'
      })
    }

    // 基於現有username生成變體建議
    const baseProfile = {
      username: user.username,
      id: user._id.toString(),
      emails: user.email ? [{ value: user.email }] : []
    }

    const suggestions = await generateUsernameSuggestions(baseProfile, 'custom', 8)

    res.json({
      success: true,
      data: {
        currentUsername: user.username,
        canChangeUsername: !user.username_changed_at || 
          (Date.now() - new Date(user.username_changed_at).getTime()) > (30 * 24 * 60 * 60 * 1000),
        suggestions: suggestions.filter(s => s !== user.username), // 排除當前username
        nextChangeAvailable: user.username_changed_at ? 
          new Date(new Date(user.username_changed_at).getTime() + (30 * 24 * 60 * 60 * 1000)) : null
      }
    })

  } catch (error) {
    console.error('獲取username建議錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '獲取username建議時發生錯誤'
    })
  }
}