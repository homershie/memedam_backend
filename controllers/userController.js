import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'

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
    const activeUsers = await User.find({ meme_count: { $gt: 0 } })
      .select('username display_name avatar bio meme_count total_likes_received follower_count')
      .sort({ meme_count: -1 })
      .limit(limitNum)

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
