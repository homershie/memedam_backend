#!/usr/bin/env node

/**
 * Render One-Off Jobs 腳本
 * 這些腳本可以用於 Render 的 One-Off Jobs 功能
 *
 * 使用方法：
 * 1. 在 Render Dashboard 中創建 One-Off Job
 * 2. 使用以下命令之一作為 startCommand
 */

import { config } from 'dotenv'
import { logger } from '../utils/logger.js'
import {
  manualSendDeletionReminders,
  manualDeleteUnverifiedUsers,
} from '../utils/userCleanupScheduler.js'
import { manualTriggers } from '../utils/notificationScheduler.js'
import {
  updateHotScores,
  updateContentBasedCache,
  updateCollaborativeFilteringCacheScheduler,
  updateSocialCollaborativeFilteringCacheScheduler,
  updateAllRecommendationSystems,
} from '../utils/recommendationScheduler.js'
import { checkAndFixCounts, checkAndFixUserCounts } from '../utils/checkCounts.js'

// 載入環境變數
config()

// 調試信息：顯示當前工作目錄和檔案路徑
console.log('當前工作目錄:', process.cwd())
console.log('腳本路徑:', import.meta.url)

// 獲取命令行參數
const command = process.argv[2]

if (!command) {
  console.log(`
Render One-Off Jobs 腳本

可用的命令：

用戶管理：
  cleanup-reminders     - 發送帳號刪除提醒
  cleanup-users         - 刪除未驗證用戶

通知系統：
  hot-content-notifications    - 發送熱門內容通知
  weekly-summary-notifications - 發送週報摘要通知
  cleanup-notifications        - 清理舊通知

推薦系統：
  update-hot-scores            - 更新熱門分數
  update-content-based         - 更新內容基礎推薦
  update-collaborative         - 更新協同過濾推薦
  update-social-collaborative  - 更新社交協同過濾推薦
  update-all-recommendations   - 更新所有推薦系統

維護任務：
  check-meme-counts            - 檢查並修正迷因計數
  check-user-counts            - 檢查並修正用戶計數

使用範例：
  node scripts/render-jobs.js cleanup-reminders
  node scripts/render-jobs.js update-hot-scores
  `)
  process.exit(0)
}

// 執行對應的任務
async function runTask() {
  const startTime = Date.now()

  try {
    logger.info(`開始執行任務: ${command}`)

    switch (command) {
      // 用戶管理任務
      case 'cleanup-reminders':
        await manualSendDeletionReminders()
        break

      case 'cleanup-users':
        await manualDeleteUnverifiedUsers()
        break

      // 通知系統任務
      case 'hot-content-notifications':
        await manualTriggers.sendHotContentNotifications()
        break

      case 'weekly-summary-notifications':
        await manualTriggers.sendWeeklySummaryNotifications()
        break

      case 'cleanup-notifications':
        await manualTriggers.cleanupOldNotificationsTask()
        break

      // 推薦系統任務
      case 'update-hot-scores':
        await updateHotScores()
        break

      case 'update-content-based':
        await updateContentBasedCache()
        break

      case 'update-collaborative':
        await updateCollaborativeFilteringCacheScheduler()
        break

      case 'update-social-collaborative':
        await updateSocialCollaborativeFilteringCacheScheduler()
        break

      case 'update-all-recommendations':
        await updateAllRecommendationSystems()
        break

      // 維護任務
      case 'check-meme-counts':
        await checkAndFixCounts()
        break

      case 'check-user-counts':
        await checkAndFixUserCounts()
        break

      default:
        logger.error(`未知的命令: ${command}`)
        process.exit(1)
    }

    const duration = Date.now() - startTime
    logger.info(`任務 ${command} 執行完成，耗時: ${duration}ms`)
  } catch (error) {
    logger.error(`任務 ${command} 執行失敗:`, error)
    process.exit(1)
  }
}

// 執行任務
runTask()
