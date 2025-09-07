import mongoose from 'mongoose'
import { cleanupExpiredNotifications } from '../services/notificationService.js'
import { cleanupOrphanReceipts, cleanupExpiredDeletedReceipts } from '../utils/notificationUtils.js'
import '../config/db.js'

/**
 * 清理過期的通知事件和收件狀態
 */
const cleanupNotifications = async () => {
  try {
    console.log('開始清理過期的通知...')

    // 清理過期的通知事件和收件狀態
    const notificationResult = await cleanupExpiredNotifications({
      notificationDays: 90, // 通知事件保留90天
      receiptDays: 30, // 已刪除收件狀態保留30天
    })

    console.log('通知事件清理結果:', {
      deletedNotifications: notificationResult.deletedNotifications,
      deletedReceipts: notificationResult.deletedReceipts,
    })

    // 清理孤兒收件狀態
    const orphanResult = await cleanupOrphanReceipts()
    console.log('孤兒收件狀態清理結果:', {
      deletedCount: orphanResult.deletedCount,
    })

    // 清理過期的已刪除收件狀態
    const expiredResult = await cleanupExpiredDeletedReceipts()
    console.log('過期已刪除收件狀態清理結果:', {
      deletedCount: expiredResult.deletedCount,
    })

    console.log('通知清理完成')

    return {
      success: true,
      results: {
        notifications: notificationResult,
        orphans: orphanResult,
        expired: expiredResult,
      },
    }
  } catch (error) {
    console.error('清理通知時發生錯誤:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 主函數
 */
const main = async () => {
  try {
    // 連接到資料庫
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('已連接到資料庫')

    // 執行清理
    const result = await cleanupNotifications()

    if (result.success) {
      console.log('清理任務完成')
      process.exit(0)
    } else {
      console.error('清理任務失敗:', result.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('執行清理任務時發生錯誤:', error)
    process.exit(1)
  } finally {
    // 關閉資料庫連接
    await mongoose.disconnect()
    console.log('已斷開資料庫連接')
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default cleanupNotifications
