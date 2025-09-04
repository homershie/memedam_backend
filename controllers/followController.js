import { StatusCodes } from 'http-status-codes'
import mongoose from 'mongoose'
import Follow from '../models/Follow.js'
import User from '../models/User.js'
import { executeTransaction } from '../utils/transaction.js'
import { createNewFollowerNotification } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'

// 追隨用戶
export const followUser = async (req, res) => {
  let followingId
  try {
    const { user_id: following_id } = req.body
    const follower_id = req.user._id

    // 檢查必要參數
    if (!following_id || typeof following_id !== 'string') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少或無效的被追隨者參數',
      })
    }

    // 查找目標用戶（支持 ID 或 username）
    let targetUser
    if (mongoose.Types.ObjectId.isValid(following_id)) {
      // 嘗試作為 ID 查詢
      targetUser = await User.findById(following_id, '_id username')
      followingId = following_id
    }

    // 如果沒有找到用戶或參數不是 ObjectId，嘗試作為 username 查詢
    if (!targetUser) {
      targetUser = await User.findOne({ username: following_id }, '_id username')
      followingId = targetUser?._id?.toString()
    }

    if (!targetUser || !followingId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到要追隨的用戶',
      })
    }

    followingId = new mongoose.Types.ObjectId(followingId)

    // 檢查是否嘗試追隨自己
    if (follower_id.equals(followingId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不能追隨自己',
      })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查是否已經追隨 - 使用 mongoose.trusted 避免 CastError
      const existingFollow = await Follow.findOne(
        mongoose.trusted({
          follower_id,
          following_id: followingId,
        }),
      ).session(session)

      if (existingFollow) {
        throw new Error('已經追隨過這個用戶')
      }

      // 創建追隨關係
      await Follow.create(
        [
          {
            follower_id,
            following_id: followingId,
            ip: req.ip,
            user_agent: req.get('User-Agent'),
            platform_detail: req.body.platform_detail || 'web',
          },
        ],
        { session },
      )

      // 更新統計數字
      await User.findByIdAndUpdate(follower_id, { $inc: { following_count: 1 } }, { session })
      await User.findByIdAndUpdate(followingId, { $inc: { follower_count: 1 } }, { session })

      return { action: 'followed' }
    })

    // 創建新追蹤者通知（在事務外執行，避免阻塞主要流程）
    createNewFollowerNotification(followingId, follower_id).catch((error) => {
      logger.error({ error, followedId: followingId, followerId: follower_id }, '發送追蹤通知失敗')
    })

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '成功追隨用戶',
      ...result,
    })
  } catch (error) {
    logger.error({ error, followedId: followingId, followerId: req.user._id }, '追隨用戶錯誤')

    if (error.message === '已經追隨過這個用戶') {
      return res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: error.message,
      })
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 取消追隨用戶
export const unfollowUser = async (req, res) => {
  let followingId
  try {
    const { user_id: following_id } = req.body
    const follower_id = req.user._id

    // 檢查必要參數
    if (!following_id || typeof following_id !== 'string') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少或無效的被追隨者參數',
      })
    }

    // 查找目標用戶（支持 ID 或 username）
    let targetUser
    if (mongoose.Types.ObjectId.isValid(following_id)) {
      // 嘗試作為 ID 查詢
      targetUser = await User.findById(following_id, '_id username')
      followingId = following_id
    }

    // 如果沒有找到用戶或參數不是 ObjectId，嘗試作為 username 查詢
    if (!targetUser) {
      targetUser = await User.findOne({ username: following_id }, '_id username')
      followingId = targetUser?._id?.toString()
    }

    if (!targetUser || !followingId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到要取消追隨的用戶',
      })
    }

    followingId = new mongoose.Types.ObjectId(followingId)

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 查找並刪除追隨關係 - 使用 mongoose.trusted 避免 CastError
      const existingFollow = await Follow.findOneAndDelete(
        mongoose.trusted({
          follower_id,
          following_id: followingId,
        }),
        { session },
      )

      if (!existingFollow) {
        throw new Error('尚未追隨這個用戶')
      }

      // 更新統計數字
      await User.findByIdAndUpdate(follower_id, { $inc: { following_count: -1 } }, { session })
      await User.findByIdAndUpdate(followingId, { $inc: { follower_count: -1 } }, { session })

      return { action: 'unfollowed' }
    })

    res.json({
      success: true,
      message: '成功取消追隨',
      ...result,
    })
  } catch (error) {
    logger.error({ error, followedId: followingId, followerId: req.user._id }, '取消追隨錯誤')

    if (error.message === '尚未追隨這個用戶') {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: error.message,
      })
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 切換追隨狀態（追隨/取消追隨）
export const toggleFollow = async (req, res) => {
  try {
    const { user_id: following_id } = req.body
    const follower_id = req.user._id

    // 檢查必要參數與格式
    if (
      !following_id ||
      typeof following_id !== 'string' ||
      !mongoose.Types.ObjectId.isValid(following_id)
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少或無效的被追隨者ID',
      })
    }

    const followingId = new mongoose.Types.ObjectId(following_id)

    // 檢查是否嘗試追隨自己
    if (follower_id.equals(followingId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不能追隨自己',
      })
    }

    // 檢查被追隨者是否存在
    const targetUser = await User.findById(followingId)
    if (!targetUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到要追隨的用戶',
      })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const existingFollow = await Follow.findOne(
        mongoose.trusted({
          follower_id,
          following_id: followingId,
        }),
      ).session(session)

      if (existingFollow) {
        // 取消追隨
        await existingFollow.deleteOne({ session })
        await User.findByIdAndUpdate(follower_id, { $inc: { following_count: -1 } }, { session })
        await User.findByIdAndUpdate(followingId, { $inc: { follower_count: -1 } }, { session })
        return { action: 'unfollowed' }
      } else {
        // 追隨
        await Follow.create(
          [
            {
              follower_id,
              following_id: followingId,
              ip: req.ip,
              user_agent: req.get('User-Agent'),
              platform_detail: req.body.platform_detail || 'web',
            },
          ],
          { session },
        )
        await User.findByIdAndUpdate(follower_id, { $inc: { following_count: 1 } }, { session })
        await User.findByIdAndUpdate(followingId, { $inc: { follower_count: 1 } }, { session })
        return { action: 'followed' }
      }
    })

    // 如果是新追隨，創建通知（在事務外執行）
    if (result.action === 'followed') {
      createNewFollowerNotification(followingId, follower_id).catch((error) => {
        console.error('發送追蹤通知失敗:', error)
      })
    }

    res.json({
      success: true,
      message: result.action === 'followed' ? '成功追隨用戶' : '成功取消追隨',
      ...result,
    })
  } catch (error) {
    console.error('切換追隨狀態錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 獲取用戶的追隨列表
export const getFollowing = async (req, res) => {
  try {
    const { user_id } = req.params
    const { page = 1, limit = 20 } = req.query

    // 查找用戶（支持 ID 或 username）
    let user
    let userId

    if (mongoose.Types.ObjectId.isValid(user_id)) {
      // 嘗試作為 ID 查詢
      user = await User.findById(user_id, '_id username')
      userId = user_id
    }

    // 如果沒有找到用戶或參數不是 ObjectId，嘗試作為 username 查詢
    if (!user) {
      user = await User.findOne({ username: user_id }, '_id username')
      userId = user?._id?.toString()
    }

    if (!user || !userId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶',
      })
    }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    // 查詢追隨列表 - 使用 mongoose.trusted 避免 CastError
    const [follows, total] = await Promise.all([
      Follow.find(mongoose.trusted({ follower_id: userId }))
        .populate('following_id', 'username display_name avatar bio follower_count')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Follow.countDocuments(mongoose.trusted({ follower_id: userId })),
    ])

    const totalPages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      data: {
        follows: follows.map((follow) => ({
          user: follow.following_id,
          followed_at: follow.createdAt,
        })),
        pagination: {
          current_page: pageNum,
          per_page: limitNum,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1,
        },
      },
    })
  } catch (error) {
    console.error('獲取追隨列表錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 獲取用戶的粉絲列表
export const getFollowers = async (req, res) => {
  try {
    const { user_id } = req.params
    const { page = 1, limit = 20 } = req.query

    // 查找用戶（支持 ID 或 username）
    let user
    let userId

    if (mongoose.Types.ObjectId.isValid(user_id)) {
      // 嘗試作為 ID 查詢
      user = await User.findById(user_id, '_id username')
      userId = user_id
    }

    // 如果沒有找到用戶或參數不是 ObjectId，嘗試作為 username 查詢
    if (!user) {
      user = await User.findOne({ username: user_id }, '_id username')
      userId = user?._id?.toString()
    }

    if (!user || !userId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶',
      })
    }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    // 查詢粉絲列表 - 使用 mongoose.trusted 避免 CastError
    const [follows, total] = await Promise.all([
      Follow.find(mongoose.trusted({ following_id: userId }))
        .populate('follower_id', 'username display_name avatar bio follower_count')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Follow.countDocuments(mongoose.trusted({ following_id: userId })),
    ])

    const totalPages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      data: {
        followers: follows.map((follow) => ({
          user: follow.follower_id,
          followed_at: follow.createdAt,
        })),
        pagination: {
          current_page: pageNum,
          per_page: limitNum,
          total,
          total_pages: totalPages,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1,
        },
      },
    })
  } catch (error) {
    console.error('獲取粉絲列表錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 檢查是否追隨某個用戶
export const checkFollowStatus = async (req, res) => {
  try {
    const { user_id: following_id } = req.params
    const follower_id = req.user._id

    // 查找目標用戶（支持 ID 或 username）
    let targetUser
    let followingId

    if (mongoose.Types.ObjectId.isValid(following_id)) {
      // 嘗試作為 ID 查詢
      targetUser = await User.findById(following_id, '_id username')
      followingId = following_id
    }

    // 如果沒有找到用戶或參數不是 ObjectId，嘗試作為 username 查詢
    if (!targetUser) {
      targetUser = await User.findOne({ username: following_id }, '_id username')
      followingId = targetUser?._id?.toString()
    }

    if (!targetUser || !followingId) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶',
      })
    }

    const follow = await Follow.findOne(
      mongoose.trusted({
        follower_id,
        following_id: followingId,
      }),
    )

    res.json({
      success: true,
      data: {
        is_following: !!follow,
        followed_at: follow?.createdAt || null,
      },
    })
  } catch (error) {
    console.error('檢查追隨狀態錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}

// 獲取用戶統計資訊
export const getUserStats = async (req, res) => {
  try {
    const { user_id } = req.params

    // 檢查是否為有效的 ObjectId，如果不是則嘗試作為 username 查詢
    let user
    if (mongoose.Types.ObjectId.isValid(user_id)) {
      // 嘗試作為 ID 查詢
      user = await User.findById(
        user_id,
        'follower_count following_count meme_count collection_count total_likes_received',
      )
    }

    // 如果沒有找到用戶或參數不是 ObjectId，嘗試作為 username 查詢
    if (!user) {
      user = await User.findOne(
        { username: user_id },
        'follower_count following_count meme_count collection_count total_likes_received',
      )
    }

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到用戶',
      })
    }

    res.json({
      success: true,
      data: {
        follower_count: user.follower_count,
        following_count: user.following_count,
        meme_count: user.meme_count,
        collection_count: user.collection_count,
        total_likes_received: user.total_likes_received,
        comment_count: user.comment_count,
        share_count: user.share_count,
      },
    })
  } catch (error) {
    console.error('獲取用戶統計錯誤:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '伺服器錯誤',
    })
  }
}
