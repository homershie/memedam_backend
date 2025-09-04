import Like from '../models/Like.js'
import Dislike from '../models/Dislike.js'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import { StatusCodes } from 'http-status-codes'
import { executeTransaction } from '../utils/transaction.js'
import { createNewLikeNotification } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'

// 建立讚
export const createLike = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(400).json({ success: false, data: null, error: '缺少 meme_id' })
    }

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 檢查迷因是否存在
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      const like = new Like({ meme_id, user_id: req.user?._id })
      await like.save({ session })

      // 更新迷因的按讚數
      await Meme.findByIdAndUpdate(meme_id, { $inc: { like_count: 1 } }, { session })

      // 更新作者的總獲讚數
      await User.findByIdAndUpdate(
        meme.author_id,
        { $inc: { total_likes_received: 1 } },
        { session },
      )

      return like
    })

    // 創建按讚通知（在事務外執行）
    createNewLikeNotification(meme_id, req.user._id)
      .then((notificationResult) => {
        if (notificationResult?.success) {
          if (notificationResult.skipped) {
            logger.info(
              {
                event: 'like_notification_skipped',
                memeId: meme_id,
                userId: req.user._id,
                reason: notificationResult.reason,
              },
              '按讚通知被跳過',
            )
          } else {
            logger.info(
              {
                event: 'like_notification_created',
                memeId: meme_id,
                userId: req.user._id,
                notificationId: notificationResult.result?.notification?._id,
              },
              '按讚通知創建完成',
            )
          }
        } else {
          logger.warn(
            {
              event: 'like_notification_failed',
              memeId: meme_id,
              userId: req.user._id,
              error: notificationResult?.error,
            },
            '按讚通知創建失敗',
          )
        }
      })
      .catch((error) => {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            memeId: meme_id,
            userId: req.user._id,
            event: 'like_notification_error',
          },
          '發送按讚通知時發生未預期的錯誤',
        )
        // 不影響按讚操作的成功回應
      })

    res.status(201).json({ success: true, data: result, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有讚（可加分頁、條件查詢）
export const getLikes = async (req, res) => {
  try {
    const filter = {}
    // 如果沒有指定 user_id，使用當前用戶ID（如果已登入）
    const targetUserId = req.query.user_id || req.user?._id
    if (targetUserId) filter.user_id = targetUserId
    if (req.query.meme_id) filter.meme_id = req.query.meme_id
    const likes = await Like.find(filter).sort({ createdAt: -1 })
    res.json(likes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 刪除讚
export const deleteLike = async (req, res) => {
  try {
    const like = await Like.findByIdAndDelete(req.params.id)
    if (!like) return res.status(404).json({ error: '找不到讚' })
    res.json({ message: '讚已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 切換讚/取消讚
export const toggleLike = async (req, res) => {
  try {
    const { meme_id } = req.body
    if (!meme_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '缺少 meme_id' })
    }
    const user_id = req.user._id

    // 使用事務處理
    const result = await executeTransaction(async (session) => {
      // 先獲取迷因資訊以取得作者ID
      const meme = await Meme.findById(meme_id).session(session)
      if (!meme) {
        throw new Error('迷因不存在')
      }

      // 先檢查有沒有噓，有的話先刪除並更新計數
      const existingDislike = await Dislike.findOne({ meme_id, user_id }).session(session)
      if (existingDislike) {
        await existingDislike.deleteOne({ session })
        // 更新迷因的按噓數（減少）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { dislike_count: -1 } }, { session })
      }

      const existing = await Like.findOne({ meme_id, user_id }).session(session)
      if (existing) {
        // 已經按讚過，則取消讚
        await existing.deleteOne({ session })
        // 更新迷因的按讚數（減少）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { like_count: -1 } }, { session })
        // 更新作者的總獲讚數（減少）
        await User.findByIdAndUpdate(
          meme.author_id,
          { $inc: { total_likes_received: -1 } },
          { session },
        )
        return { action: 'removed' }
      } else {
        // 尚未按讚過，則新增
        await Like.create([{ meme_id, user_id }], { session })
        // 更新迷因的按讚數（增加）
        await Meme.findByIdAndUpdate(meme_id, { $inc: { like_count: 1 } }, { session })
        // 更新作者的總獲讚數（增加）
        await User.findByIdAndUpdate(
          meme.author_id,
          { $inc: { total_likes_received: 1 } },
          { session },
        )
        return { action: 'added' }
      }
    })

    // 如果是新增讚，創建通知（在事務外執行）
    if (result.action === 'added') {
      createNewLikeNotification(meme_id, user_id)
        .then((notificationResult) => {
          if (notificationResult?.success) {
            if (notificationResult.skipped) {
              logger.info(
                {
                  event: 'toggle_like_notification_skipped',
                  memeId: meme_id,
                  userId: user_id,
                  reason: notificationResult.reason,
                },
                '切換按讚通知被跳過',
              )
            } else {
              logger.info(
                {
                  event: 'toggle_like_notification_created',
                  memeId: meme_id,
                  userId: user_id,
                  notificationId: notificationResult.result?.notification?._id,
                },
                '切換按讚通知創建完成',
              )
            }
          } else {
            logger.warn(
              {
                event: 'toggle_like_notification_failed',
                memeId: meme_id,
                userId: user_id,
                error: notificationResult?.error,
              },
              '切換按讚通知創建失敗',
            )
          }
        })
        .catch((error) => {
          logger.error(
            {
              error: error.message,
              stack: error.stack,
              memeId: meme_id,
              userId: user_id,
              event: 'toggle_like_notification_error',
            },
            '發送切換按讚通知時發生未預期的錯誤',
          )
          // 不影響按讚操作的成功回應
        })
    }

    return res.json({ success: true, ...result })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
