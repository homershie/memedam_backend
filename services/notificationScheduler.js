import cron from 'node-cron'
import mongoose from 'mongoose'
import Meme from '../models/Meme.js'
import User from '../models/User.js'
import Follow from '../models/Follow.js'
import Like from '../models/Like.js'
import Comment from '../models/Comment.js'
import {
  createHotContentNotifications,
  createWeeklySummaryNotification,
} from '../services/notificationService.js'
import { cleanupExpiredNotifications } from '../services/notificationService.js'

/**
 * 獲取熱門迷因
 * @param {Number} hoursAgo - 多少小時前的數據
 * @param {Number} limit - 返回數量限制
 */
const getHotMemes = async (hoursAgo = 24, limit = 5) => {
  try {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)

    // 獲取熱門迷因（基於讚數、留言數和觀看數的綜合熱度）
    const rawMemes = await Meme.find({
      createdAt: { $gte: cutoffTime },
      like_count: { $gte: 5 }, // 至少5個讚
    })
      .select('_id title author_id like_count comment_count view_count createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 2) // 多取一些，用於排序

    // 在JavaScript中計算hotScore，確保類型正確
    const hotMemes = rawMemes
      .map((meme) => {
        const likeCount = Number(meme.like_count) || 0
        const commentCount = Number(meme.comment_count) || 0
        const viewCount = Number(meme.view_count) || 0

        return {
          ...meme.toObject(),
          hotScore: likeCount * 3 + commentCount * 2 + viewCount * 1,
        }
      })
      .sort((a, b) => b.hotScore - a.hotScore)
      .slice(0, limit)

    return hotMemes
  } catch (error) {
    console.error('獲取熱門迷因失敗:', error)
    return []
  }
}

/**
 * 獲取用戶週統計數據
 * @param {String} userId - 用戶ID
 */
const getUserWeeklyStats = async (userId) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // 獲取新追蹤者數量
    const newFollowers = await Follow.countDocuments(
      mongoose.trusted({
        following_id: userId,
        createdAt: { $gte: weekAgo },
      }),
    )

    // 獲取該用戶迷因的總讚數和留言數
    const userMemes = await Meme.find({ author_id: userId }, '_id')
    const memeIds = userMemes.map((meme) => meme._id)

    const [totalLikes, totalComments] = await Promise.all([
      Like.countDocuments({
        meme_id: { $in: memeIds },
        createdAt: { $gte: weekAgo },
      }),
      Comment.countDocuments({
        meme_id: { $in: memeIds },
        createdAt: { $gte: weekAgo },
      }),
    ])

    // 獲取本週發布的迷因數量
    const memesPosted = await Meme.countDocuments({
      author_id: userId,
      createdAt: { $gte: weekAgo },
    })

    // 獲取本週最受歡迎的迷因
    const mostLikedMeme = await Like.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo },
          meme_id: { $in: memeIds },
        },
      },
      {
        $group: {
          _id: '$meme_id',
          likeCount: { $sum: 1 },
        },
      },
      {
        $sort: { likeCount: -1 },
      },
      {
        $limit: 1,
      },
      {
        $lookup: {
          from: 'memes',
          localField: '_id',
          foreignField: '_id',
          as: 'meme',
        },
      },
      {
        $unwind: '$meme',
      },
      {
        $project: {
          memeId: '$_id',
          title: '$meme.title',
          likeCount: 1,
        },
      },
    ])

    return {
      new_followers: newFollowers,
      total_likes: totalLikes,
      total_comments: totalComments,
      memes_posted: memesPosted,
      most_liked_meme: mostLikedMeme.length > 0 ? mostLikedMeme[0] : null,
    }
  } catch (error) {
    console.error('獲取用戶週統計失敗:', error)
    return {
      new_followers: 0,
      total_likes: 0,
      total_comments: 0,
      memes_posted: 0,
      most_liked_meme: null,
    }
  }
}

/**
 * 發送熱門內容通知任務
 */
const sendHotContentNotifications = async () => {
  try {
    console.log('開始發送熱門內容通知...')

    const hotMemes = await getHotMemes(24, 3) // 獲取過去24小時內最熱門的3個迷因

    if (hotMemes.length === 0) {
      console.log('沒有找到熱門內容，跳過通知發送')
      return
    }

    // 獲取活躍用戶（可以根據需要調整篩選條件）
    const activeUsers = await User.find(
      {
        $or: [
          { last_login_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
      '_id',
    ).limit(500) // 限制為500個用戶，避免過載

    const userIds = activeUsers.map((user) => user._id)

    const result = await createHotContentNotifications(hotMemes, userIds)
    console.log(`熱門內容通知發送完成，共發送 ${result.sent} 條通知`)
  } catch (error) {
    console.error('發送熱門內容通知失敗:', error)
  }
}

/**
 * 發送週報摘要通知任務
 */
const sendWeeklySummaryNotifications = async () => {
  try {
    console.log('開始發送週報摘要通知...')

    // 獲取所有活躍用戶
    const activeUsers = await User.find(
      {
        $or: [
          { last_login_at: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
          { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
      '_id username',
    ).limit(1000)

    let sentCount = 0

    // 批量處理用戶（每次處理50個）
    const batchSize = 50
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize)

      const promises = batch.map(async (user) => {
        try {
          const weeklyStats = await getUserWeeklyStats(user._id)

          // 只有當用戶有活動時才發送週報
          if (
            weeklyStats.new_followers > 0 ||
            weeklyStats.total_likes > 0 ||
            weeklyStats.total_comments > 0 ||
            weeklyStats.memes_posted > 0
          ) {
            await createWeeklySummaryNotification(user._id, weeklyStats)
            return 1
          }
          return 0
        } catch (error) {
          console.error(`為用戶 ${user.username} 創建週報失敗:`, error)
          return 0
        }
      })

      const results = await Promise.allSettled(promises)
      const batchSentCount = results
        .filter((result) => result.status === 'fulfilled')
        .reduce((sum, result) => sum + result.value, 0)

      sentCount += batchSentCount

      // 添加延遲避免數據庫過載
      if (i + batchSize < activeUsers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`週報摘要通知發送完成，共發送 ${sentCount} 條通知`)
  } catch (error) {
    console.error('發送週報摘要通知失敗:', error)
  }
}

/**
 * 清理舊通知任務
 */
const cleanupOldNotificationsTask = async () => {
  try {
    console.log('開始清理舊通知...')
    const result = await cleanupExpiredNotifications({ notificationDays: 30, receiptDays: 30 })
    console.log(
      `清理舊通知完成，共刪除 ${result.deletedNotifications} 條通知事件，${result.deletedReceipts} 條收件項`,
    )
  } catch (error) {
    console.error('清理舊通知失敗:', error)
  }
}

/**
 * 啟動通知調度器
 */
export const startNotificationScheduler = () => {
  console.log('啟動通知調度器...')

  // 每天上午9點發送熱門內容通知
  cron.schedule(
    '0 9 * * *',
    () => {
      console.log('執行熱門內容通知任務')
      sendHotContentNotifications()
    },
    {
      timezone: 'Asia/Taipei',
    },
  )

  // 每週一上午10點發送週報摘要
  cron.schedule(
    '0 10 * * 1',
    () => {
      console.log('執行週報摘要通知任務')
      sendWeeklySummaryNotifications()
    },
    {
      timezone: 'Asia/Taipei',
    },
  )

  // 每天凌晨4點清理舊通知
  cron.schedule(
    '0 4 * * *',
    () => {
      console.log('執行清理舊通知任務')
      cleanupOldNotificationsTask()
    },
    {
      timezone: 'Asia/Taipei',
    },
  )

  console.log('通知調度器已啟動')
  console.log('- 熱門內容通知：每天上午9點')
  console.log('- 週報摘要通知：每週一上午10點')
  console.log('- 清理舊通知：每天凌晨4點')
}

/**
 * 停止通知調度器
 */
export const stopNotificationScheduler = () => {
  cron.getTasks().forEach((task) => task.destroy())
  console.log('通知調度器已停止')
}

// 手動觸發函數（用於測試）
export const manualTriggers = {
  sendHotContentNotifications,
  sendWeeklySummaryNotifications,
  cleanupOldNotificationsTask,
}

// 導出內部函數供測試使用
export { getHotMemes, getUserWeeklyStats }
