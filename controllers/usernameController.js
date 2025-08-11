import { StatusCodes } from 'http-status-codes'
import { generateUsernameSuggestions } from '../utils/usernameGenerator.js'
import User from '../models/User.js'
import bcrypt from 'bcrypt'
import { logger } from '../utils/logger.js'

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
        message: '缺少必要參數：provider 和 profile',
      })
    }

    // 驗證provider類型
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不支援的社群平台類型',
      })
    }

    // 生成username建議
    const suggestions = await generateUsernameSuggestions(profile, provider, 5)

    res.json({
      success: true,
      data: {
        provider,
        suggestions,
        message: `為 ${provider} 帳號生成了 ${suggestions.length} 個username建議`,
      },
    })
  } catch (error) {
    console.error('Username預覽錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '生成username建議時發生錯誤',
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
        message: 'Username格式不正確',
      })
    }

    // 檢查username長度和格式
    if (username.length < 8 || username.length > 20) {
      return res.json({
        success: true,
        available: false,
        reason: 'username長度必須在8-20個字元之間',
      })
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      return res.json({
        success: true,
        available: false,
        reason: 'username只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)',
      })
    }

    // 檢查是否已被使用（動態導入避免循環依賴）
    const existingUser = await User.findOne({ username: username.toLowerCase() })

    res.json({
      success: true,
      available: !existingUser,
      username: username.toLowerCase(),
      reason: existingUser ? 'Username已被使用' : null,
    })
  } catch (error) {
    console.error('檢查username可用性錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '檢查username可用性時發生錯誤',
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
        message: '需要登入才能使用此功能',
      })
    }

    // 動態導入避免循環依賴
    const user = await User.findById(userId)

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶資料',
      })
    }

    // 基於現有username生成變體建議
    const baseProfile = {
      username: user.username,
      id: user._id.toString(),
      emails: user.email ? [{ value: user.email }] : [],
    }

    const suggestions = await generateUsernameSuggestions(baseProfile, 'custom', 8)

    res.json({
      success: true,
      data: {
        currentUsername: user.username,
        canChangeUsername:
          !user.username_changed_at ||
          Date.now() - new Date(user.username_changed_at).getTime() > 30 * 24 * 60 * 60 * 1000,
        suggestions: suggestions.filter((s) => s !== user.username), // 排除當前username
        nextChangeAvailable: user.username_changed_at
          ? new Date(new Date(user.username_changed_at).getTime() + 30 * 24 * 60 * 60 * 1000)
          : null,
      },
    })
  } catch (error) {
    console.error('獲取username建議錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '獲取username建議時發生錯誤',
    })
  }
}

/**
 * 驗證 username 格式和可用性
 * GET /api/username/validate/:username
 */
export const validateUsername = async (req, res) => {
  try {
    const { username } = req.params

    // 驗證 username 格式
    if (!username || username.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供 username',
      })
    }

    // 檢查長度
    if (username.length < 8 || username.length > 20) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        available: false,
        message: 'username 長度必須在 8 到 20 個字元之間',
      })
    }

    // 檢查格式
    const usernameRegex = /^[a-zA-Z0-9._-]+$/
    if (!usernameRegex.test(username)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        available: false,
        message: 'username 只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)',
      })
    }

    // 檢查是否已被使用
    const existingUser = await User.findOne({ username: username })
    if (existingUser) {
      return res.status(StatusCodes.OK).json({
        success: true,
        available: false,
        message: '此 username 已被使用',
      })
    }

    // 檢查是否在禁用列表中（可以添加一些保留的 username）
    const reservedUsernames = [
      'admin',
      'administrator',
      'root',
      'system',
      'support',
      'help',
      'info',
      'test',
      'guest',
      'anonymous',
    ]

    if (reservedUsernames.includes(username.toLowerCase())) {
      return res.status(StatusCodes.OK).json({
        success: true,
        available: false,
        message: '此 username 為系統保留，無法使用',
      })
    }

    res.status(StatusCodes.OK).json({
      success: true,
      available: true,
      message: '此 username 可以使用',
    })
  } catch (error) {
    logger.error('validateUsername 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

/**
 * 變更 username
 * POST /api/username/change
 */
export const changeUsername = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { username, currentPassword } = req.body
    const userId = req.user._id

    // 驗證輸入
    if (!username || !currentPassword) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供新的 username 和目前密碼',
      })
    }

    // 驗證 username 格式
    if (username.length < 8 || username.length > 20) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'username 長度必須在 8 到 20 個字元之間',
      })
    }

    const usernameRegex = /^[a-zA-Z0-9._-]+$/
    if (!usernameRegex.test(username)) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'username 只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)',
      })
    }

    // 檢查是否為系統保留的 username
    const reservedUsernames = [
      'admin',
      'administrator',
      'root',
      'system',
      'support',
      'help',
      'info',
      'test',
      'guest',
      'anonymous',
    ]

    if (reservedUsernames.includes(username.toLowerCase())) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '此 username 為系統保留，無法使用',
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

    // 檢查新 username 是否與目前相同
    if (user.username === username) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '新 username 不能與目前 username 相同',
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

    // 檢查新 username 是否已被其他用戶使用
    const existingUser = await User.findOne({ username: username }).session(session)
    if (existingUser) {
      await session.abortTransaction()
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: '此 username 已被其他使用者使用',
      })
    }

    // 檢查是否可以變更 username（一個月只能變更一次）
    if (user.username_changed_at) {
      const lastChangeTime = new Date(user.username_changed_at)
      const currentTime = new Date()
      const timeDiff = currentTime - lastChangeTime
      const oneMonthInMs = 30 * 24 * 60 * 60 * 1000 // 30天的毫秒數

      if (timeDiff < oneMonthInMs) {
        const remainingDays = Math.ceil((oneMonthInMs - timeDiff) / (24 * 60 * 60 * 1000))
        await session.abortTransaction()
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: `username 一個月只能變更一次，還需要等待 ${remainingDays} 天才能再次變更`,
        })
      }
    }

    // 記錄舊的 username
    const oldUsername = user.username
    if (!user.previous_usernames) {
      user.previous_usernames = []
    }

    user.previous_usernames.push({
      username: oldUsername,
      changed_at: new Date(),
    })

    // 只保留最近10次的變更記錄
    if (user.previous_usernames.length > 10) {
      user.previous_usernames = user.previous_usernames.slice(-10)
    }

    // 更新 username 和變更時間
    user.username = username
    user.username_changed_at = new Date()

    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

    logger.info(`用戶 ${userId} 成功變更 username 從 ${oldUsername} 到 ${username}`)

    res.json({
      success: true,
      message: 'username 已成功變更',
      user: {
        _id: user._id,
        username: user.username,
        username_changed_at: user.username_changed_at,
      },
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    logger.error('changeUsername 錯誤:', error)

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
          message = '此 username 已被其他使用者使用，請選擇其他 username'
          break
        default:
          message = `${field} 已被其他使用者使用，請更換`
      }

      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message,
      })
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  } finally {
    // 結束 session
    session.endSession()
  }
}
