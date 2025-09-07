#!/usr/bin/env node

/**
 * 通知系統診斷腳本
 * 用於檢查按讚通知功能的各個環節
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { createNewLikeNotification } from '../services/notificationService.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Notification from '../models/Notification.js'
import NotificationReceipt from '../models/NotificationReceipt.js'

// 載入環境變數
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

const MONGODB_URI =
  process.env.MONGO_TEST_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/memedam_test'

async function diagnoseNotificationSystem() {
  console.log('🔍 開始診斷通知系統...')
  console.log('📍 使用的資料庫URI:', MONGODB_URI)

  try {
    // 載入環境變數
    console.log('📋 載入環境變數...')
    console.log('📋 NODE_ENV:', process.env.NODE_ENV)
    console.log('📋 MONGO_URI:', process.env.MONGO_URI ? '已設定' : '未設定')
    console.log('📋 MONGO_TEST_URI:', process.env.MONGO_TEST_URI ? '已設定' : '未設定')

    // 連接到資料庫
    console.log('🔌 連接到資料庫...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ 資料庫連接成功')

    // 清理測試資料
    await cleanupTestData()

    // 建立測試用戶
    console.log('📝 建立測試用戶...')
    const likerUser = await User.create({
      username: 'liker_test',
      email: 'liker@test.com',
      password: 'password123',
      displayName: '按讚測試用戶',
      notificationSettings: {
        newLike: true,
        newComment: true,
        newFollower: true,
      },
    })

    const authorUser = await User.create({
      username: 'author_test',
      email: 'author@test.com',
      password: 'password123',
      displayName: '作者測試用戶',
      notificationSettings: {
        newLike: true,
        newComment: true,
        newFollower: true,
      },
    })

    console.log('✅ 測試用戶建立成功')

    // 建立測試迷因
    console.log('🎭 建立測試迷因...')
    const testMeme = await Meme.create({
      title: '測試通知的迷因',
      type: 'image',
      content: '這是一個測試迷因',
      author_id: authorUser._id,
      tags: ['test'],
      image_url: 'https://example.com/test.jpg',
    })
    console.log('✅ 測試迷因建立成功')

    // 測試按讚通知
    console.log('👍 測試按讚通知功能...')
    const notificationResult = await createNewLikeNotification(testMeme._id, likerUser._id)

    console.log('通知結果:', notificationResult)

    if (notificationResult?.success) {
      if (notificationResult.skipped) {
        console.log(`⚠️ 通知被跳過: ${notificationResult.reason}`)
      } else {
        console.log('✅ 通知建立成功')

        // 檢查資料庫中的通知
        const notifications = await Notification.find({
          verb: 'like',
          object_type: 'meme',
          object_id: testMeme._id,
        })

        console.log(`📊 找到 ${notifications.length} 個通知事件`)

        if (notifications.length > 0) {
          const receipts = await NotificationReceipt.find({
            notification_id: notifications[0]._id,
          })

          console.log(`📨 找到 ${receipts.length} 個收件項`)

          if (receipts.length > 0) {
            console.log('✅ 通知系統運作正常')
          } else {
            console.log('❌ 缺少收件項')
          }
        } else {
          console.log('❌ 通知事件未建立')
        }
      }
    } else {
      console.log('❌ 通知建立失敗:', notificationResult?.error)
    }

    // 清理測試資料
    await cleanupTestData()
  } catch (error) {
    console.error('❌ 診斷過程中發生錯誤:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 資料庫連接已關閉')
  }
}

async function cleanupTestData() {
  try {
    await User.deleteMany({ username: { $in: ['liker_test', 'author_test'] } })
    await Meme.deleteMany({ title: '測試通知的迷因' })
    await Notification.deleteMany({ verb: 'like', 'payload.meme_title': '測試通知的迷因' })
    console.log('🧹 測試資料清理完成')
  } catch (error) {
    console.error('清理測試資料時發生錯誤:', error)
  }
}

// 如果直接執行此腳本
if (process.argv[1] && process.argv[1].endsWith('diagnose-notifications.js')) {
  console.log('🚀 啟動診斷腳本...')
  diagnoseNotificationSystem()
}

export { diagnoseNotificationSystem }
