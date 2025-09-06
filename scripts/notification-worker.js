#!/usr/bin/env node

/**
 * 通知隊列工作者
 * 負責處理通知隊列中的工作
 */

import 'dotenv/config'
import notificationQueue from '../services/notificationQueue.js'
import { logger } from '../utils/logger.js'
import connectDB from '../config/db.js'

/**
 * 啟動通知工作者
 */
async function startNotificationWorker() {
  try {
    logger.info('啟動通知隊列工作者...')

    // 連接到資料庫
    await connectDB()
    logger.info('資料庫連接成功')

    // 初始化通知隊列
    await notificationQueue.initialize()
    logger.info('通知隊列初始化成功')

    // 啟動處理程序
    logger.info('通知工作者已啟動並開始處理隊列')

    // 定期記錄統計資訊
    setInterval(async () => {
      const stats = await notificationQueue.getStats()
      if (stats) {
        logger.info('通知隊列統計', {
          waiting: stats.waiting,
          active: stats.active,
          completed: stats.completed,
          failed: stats.failed,
          delayed: stats.delayed,
          event: 'notification_queue_stats',
        })
      }
    }, 60000) // 每分鐘記錄一次

    // 處理程序結束時的清理
    process.on('SIGTERM', async () => {
      logger.info('收到 SIGTERM 信號，正在關閉通知工作者...')
      await notificationQueue.close()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      logger.info('收到 SIGINT 信號，正在關閉通知工作者...')
      await notificationQueue.close()
      process.exit(0)
    })

    // 保持程序運行
    process.stdin.resume()
  } catch (error) {
    logger.error('啟動通知工作者失敗:', error)
    process.exit(1)
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  startNotificationWorker()
}

export { startNotificationWorker }
