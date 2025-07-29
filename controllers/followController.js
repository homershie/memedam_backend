import { StatusCodes } from 'http-status-codes'
import Follow from '../models/Follow.js'
import User from '../models/User.js'
import { executeTransaction } from '../utils/transaction.js'

// 追隨用戶
export const followUser = async (req, res) => {
  try {
    const { user_id: following_id } = req.body
    const follower_id = req.user._id

    // 檢查必要參數
    if (!following_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少被追隨者ID',
      })
    }

    // 檢查是否嘗試追隨自己
    if (follower_id.equals(following_id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不能追隨自己',
      })
    }

    // 檢查被追隨者是否存在
    const targetUser = await User.findById(following_id)
    if (!targetUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到要追隨的用戶',
      })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查是否已經追隨
      const existingFollow = await Follow.findOne({
        follower_id,
        following_id,
      }).session(session)

      if (existingFollow) {
        throw new Error('已經追隨過這個用戶')
      }

      // 創建追隨關係
      await Follow.create(
        [
          {
            follower_id,
            following_id,
            ip: req.ip,
            user_agent: req.get('User-Agent'),
            platform_detail: req.body.platform_detail || 'web',
          },
        ],
        { session },
      )

      // 更新統計數字
      await User.findByIdAndUpdate(follower_id, { $inc: { following_count: 1 } }, { session })

      await User.findByIdAndUpdate(following_id, { $inc: { follower_count: 1 } }, { session })

      return { action: 'followed' }
    })

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: '成功追隨用戶',
      ...result,
    })
  } catch (error) {
    console.error('追隨用戶錯誤:', error)

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
  try {
    const { user_id: following_id } = req.body
    const follower_id = req.user._id

    // 檢查必要參數
    if (!following_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少被追隨者ID',
      })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 查找並刪除追隨關係
      const existingFollow = await Follow.findOneAndDelete(
        {
          follower_id,
          following_id,
        },
        { session },
      )

      if (!existingFollow) {
        throw new Error('尚未追隨這個用戶')
      }

      // 更新統計數字
      await User.findByIdAndUpdate(follower_id, { $inc: { following_count: -1 } }, { session })

      await User.findByIdAndUpdate(following_id, { $inc: { follower_count: -1 } }, { session })

      return { action: 'unfollowed' }
    })

    res.json({
      success: true,
      message: '成功取消追隨',
      ...result,
    })
  } catch (error) {
    console.error('取消追隨錯誤:', error)

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

    // 檢查必要參數
    if (!following_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '缺少被追隨者ID',
      })
    }

    // 檢查是否嘗試追隨自己
    if (follower_id.equals(following_id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: '不能追隨自己',
      })
    }

    // 檢查被追隨者是否存在
    const targetUser = await User.findById(following_id)
    if (!targetUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: '找不到要追隨的用戶',
      })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      const existingFollow = await Follow.findOne({
        follower_id,
        following_id,
      }).session(session)

      if (existingFollow) {
        // 取消追隨
        await existingFollow.deleteOne({ session })
        await User.findByIdAndUpdate(follower_id, { $inc: { following_count: -1 } }, { session })
        await User.findByIdAndUpdate(following_id, { $inc: { follower_count: -1 } }, { session })
        return { action: 'unfollowed' }
      } else {
        // 追隨
        await Follow.create(
          [
            {
              follower_id,
              following_id,
              ip: req.ip,
              user_agent: req.get('User-Agent'),
              platform_detail: req.body.platform_detail || 'web',
            },
          ],
          { session },
        )
        await User.findByIdAndUpdate(follower_id, { $inc: { following_count: 1 } }, { session })
        await User.findByIdAndUpdate(following_id, { $inc: { follower_count: 1 } }, { session })
        return { action: 'followed' }
      }
    })

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

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    // 查詢追隨列表
    const [follows, total] = await Promise.all([
      Follow.find({ follower_id: user_id })
        .populate('following_id', 'username display_name avatar bio follower_count')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Follow.countDocuments({ follower_id: user_id }),
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

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip = (pageNum - 1) * limitNum

    // 查詢粉絲列表
    const [follows, total] = await Promise.all([
      Follow.find({ following_id: user_id })
        .populate('follower_id', 'username display_name avatar bio follower_count')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Follow.countDocuments({ following_id: user_id }),
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

    const follow = await Follow.findOne({
      follower_id,
      following_id,
    })

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

    const user = await User.findById(
      user_id,
      'follower_count following_count meme_count collection_count total_likes_received',
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
