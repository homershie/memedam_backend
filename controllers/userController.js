import User from '../models/User.js'
import VerificationToken from '../models/VerificationToken.js'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import validator from 'validator'
import {
  manualSendDeletionReminders,
  manualDeleteUnverifiedUsers,
} from '../utils/userCleanupScheduler.js'
import { logger } from '../utils/logger.js'
import EmailService from '../utils/emailService.js'
import VerificationController from './verificationController.js'
import { deleteCloudinaryImage } from '../utils/deleteImg.js'

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
    console.error('getUser 錯誤:', error)
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
    const users = await User.find().select('-password -tokens')
    res.json({ success: true, users })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
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
        await deleteCloudinaryImage(oldAvatarUrl)
        console.log('成功刪除舊頭像:', oldAvatarUrl)
      } catch (deleteError) {
        console.error('刪除舊頭像失敗:', deleteError)
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
        await deleteCloudinaryImage(user.avatar)
        console.log('成功刪除用戶頭像:', user.avatar)
      } catch (deleteError) {
        console.error('刪除用戶頭像失敗:', deleteError)
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

    console.error('綁定社群帳號錯誤:', error)

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
        await deleteCloudinaryImage(oldAvatarUrl)
        console.log('成功刪除舊頭像:', oldAvatarUrl)
      } catch (deleteError) {
        console.error('刪除舊頭像失敗:', deleteError)
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
        await deleteCloudinaryImage(user.avatar)
        console.log('成功刪除用戶頭像:', user.avatar)
      } catch (deleteError) {
        console.error('刪除用戶頭像失敗:', deleteError)
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
    console.error('getActiveUsers 錯誤:', error)
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

    // 驗證輸入
    if (!currentPassword || !newPassword) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供目前密碼和新密碼',
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

    // 更新密碼
    user.password = newPassword
    await user.save({ session })

    // 清除所有登入 token（強制重新登入）
    user.tokens = []
    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.json({
      success: true,
      message: '密碼已成功變更，請重新登入',
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    console.error('changePassword 錯誤:', error)
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

    res.json({
      success: true,
      message: '電子信箱已成功變更，請重新驗證',
    })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    console.error('changeEmail 錯誤:', error)
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

    console.error('unbindSocialAccount 錯誤:', error)
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
    console.error('searchUsers 錯誤:', error)
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
    console.error('sendDeletionReminders 錯誤:', error)
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
    console.error('deleteUnverifiedUsers 錯誤:', error)
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
    console.error('getUnverifiedUsersStats 錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '獲取未驗證用戶統計資訊失敗',
    })
  }
}

// 忘記密碼 API
export const forgotPassword = async (req, res) => {
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

    // 檢查是否有未過期的密碼重設 token - 使用 mongoose.trusted 避免日期 CastError
    const existingToken = await VerificationToken.findOne({
      userId: user._id,
      type: 'password_reset',
      used: false,
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    }).session(session)

    if (existingToken) {
      await session.abortTransaction()
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: '密碼重設 email 已發送，請檢查您的信箱或稍後再試',
      })
    }

    // 產生密碼重設 token（1 小時過期）
    const resetToken = await VerificationController.generateVerificationToken(
      user._id,
      'password_reset',
      1, // 1 小時過期
    )

    // 發送密碼重設 email
    await EmailService.sendPasswordResetEmail(email, resetToken, user.username)

    // 提交事務
    await session.commitTransaction()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '密碼重設 email 已發送',
      data: {
        email,
        sentAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    await session.abortTransaction()
    logger.error('忘記密碼處理失敗:', error)

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '處理忘記密碼請求時發生錯誤',
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

// 重設密碼 API
export const resetPassword = async (req, res) => {
  const session = await User.startSession()
  session.startTransaction()

  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '請提供 token 和新密碼',
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

    // 查找並驗證 token - 使用 mongoose.trusted 避免日期 CastError
    const verificationToken = await VerificationToken.findOne({
      token,
      type: 'password_reset',
      used: false,
      expiresAt: mongoose.trusted({ $gt: new Date() }),
    }).session(session)

    if (!verificationToken) {
      await session.abortTransaction()
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '無效或已過期的重設連結',
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

    // 更新密碼
    user.password = newPassword
    await user.save({ session })

    // 標記 token 為已使用
    verificationToken.used = true
    await verificationToken.save({ session })

    // 清除所有登入 token（強制重新登入）
    user.tokens = []
    await user.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(StatusCodes.OK).json({
      success: true,
      message: '密碼重設成功，請使用新密碼登入',
    })
  } catch (error) {
    await session.abortTransaction()
    logger.error('重設密碼失敗:', error)

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '重設密碼時發生錯誤',
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

// OAuth 綁定相關函數
import crypto from 'crypto'
import passport from 'passport'

// 生成 state 參數用於防止 CSRF 攻擊
const generateState = () => {
  return crypto.randomBytes(32).toString('hex')
}

// 驗證 state 參數
const validateState = (state, session) => {
  return session && session.oauthState === state
}

// 初始化 OAuth 綁定流程
export const initBindAuth = async (req, res) => {
  try {
    const { provider } = req.params
    const userId = req.user._id

    // 支援的 provider
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ success: false, message: '不支援的社群平台' })
    }

    // 檢查用戶是否已經綁定了該平台
    const user = await User.findById(userId)
    if (user[`${provider}_id`]) {
      return res.status(409).json({
        success: false,
        message: `您已經綁定了 ${provider} 帳號`,
      })
    }

    // 生成 state 參數
    const state = generateState()

    // 將 state 和用戶 ID 存儲到 session 中
    if (!req.session) {
      req.session = {}
    }
    req.session.oauthState = state
    req.session.bindUserId = userId.toString()
    req.session.bindProvider = provider

    // 根據不同的 provider 設定不同的 scope
    let scope = []
    switch (provider) {
      case 'google':
        scope = ['profile', 'email']
        break
      case 'facebook':
        scope = ['email']
        break
      case 'discord':
        scope = ['identify', 'email']
        break
      case 'twitter':
        scope = ['tweet.read', 'users.read']
        break
    }

    // 重定向到 OAuth 授權頁面
    const authUrl = `/api/users/bind-auth/${provider}/init?state=${state}`
    res.json({
      success: true,
      authUrl,
      state,
      message: `正在初始化 ${provider} 綁定流程`,
    })
  } catch (error) {
    console.error('初始化 OAuth 綁定錯誤:', error)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}

// 處理 OAuth 綁定回調
export const handleBindAuthCallback = async (req, res) => {
  try {
    const { provider } = req.params
    const { state } = req.query

    // 驗證 state 參數
    if (!validateState(state, req.session)) {
      return res.status(400).json({
        success: false,
        message: '無效的 state 參數',
      })
    }

    // 從 session 中獲取綁定資訊
    const bindUserId = req.session.bindUserId
    const bindProvider = req.session.bindProvider

    if (!bindUserId || bindProvider !== provider) {
      return res.status(400).json({
        success: false,
        message: '綁定資訊無效',
      })
    }

    // 使用 session 來確保原子性操作
    const session = await User.startSession()
    session.startTransaction()

    try {
      // 獲取用戶資訊
      const user = await User.findById(bindUserId).session(session)
      if (!user) {
        await session.abortTransaction()
        return res.status(404).json({ success: false, message: '找不到使用者' })
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
        return res.status(400).json({
          success: false,
          message: '無法獲取社群帳號資訊',
        })
      }

      // 檢查該社群 ID 是否已被其他帳號綁定
      const query = {}
      query[`${provider}_id`] = socialId
      const existing = await User.findOne(query).session(session)
      if (existing && existing._id.toString() !== bindUserId) {
        await session.abortTransaction()
        return res.status(409).json({
          success: false,
          message: '此社群帳號已被其他用戶綁定',
        })
      }

      // 綁定社群帳號
      user[`${provider}_id`] = socialId
      await user.save({ session })

      // 清理 session
      delete req.session.oauthState
      delete req.session.bindUserId
      delete req.session.bindProvider

      // 提交事務
      await session.commitTransaction()

      res.json({
        success: true,
        message: `成功綁定 ${provider} 帳號`,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          [`${provider}_id`]: socialId,
        },
      })
    } catch (error) {
      // 回滾事務
      await session.abortTransaction()
      throw error
    } finally {
      // 結束 session
      session.endSession()
    }
  } catch (error) {
    console.error('OAuth 綁定回調錯誤:', error)

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
    console.error('獲取綁定狀態錯誤:', error)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
}
