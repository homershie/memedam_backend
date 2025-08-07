import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import validator from 'validator'

// 建立新使用者
export const createUser = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await User.startSession()
  session.startTransaction()

  try {
    const user = await User.create([req.body], { session })
    const createdUser = user[0]

    // 回傳完整用戶資料（包含 avatarUrl），但移除敏感資訊
    const userObj = createdUser.toJSON()
    delete userObj.password
    delete userObj.tokens

    // 提交事務
    await session.commitTransaction()

    res.status(StatusCodes.CREATED).json({ success: true, user: userObj })
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
