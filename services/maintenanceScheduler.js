import cron from 'node-cron'
import { checkAndFixCounts, checkAndFixUserCounts } from '../utils/checkCounts.js'
import { logger } from '../utils/logger.js'

/**
 * 定期維護任務配置
 */
class MaintenanceScheduler {
  constructor() {
    this.tasks = new Map()
  }

  /**
   * 啟動所有定期維護任務
   */
  startAllTasks() {
    try {
      // 每日凌晨1點檢查迷因統計計數
      this.scheduleMemeCountsCheck()

      // 每日凌晨1點檢查用戶統計計數
      this.scheduleUserCountsCheck()

      // 每週日凌晨4點進行完整數據檢查
      this.scheduleWeeklyFullCheck()

      console.log('✅ 所有定期維護任務已啟動')
    } catch (error) {
      console.error('❌ 定期維護任務啟動失敗:', error)
    }
  }

  /**
   * 停止所有定期維護任務
   */
  stopAllTasks() {
    try {
      this.tasks.forEach((task, name) => {
        task.stop()
        console.log(`⏹️ 已停止任務: ${name}`)
      })
      this.tasks.clear()
      console.log('✅ 所有定期維護任務已停止')
    } catch (error) {
      console.error('❌ 停止定期維護任務失敗:', error)
    }
  }

  /**
   * 每日迷因統計計數檢查 (凌晨1點)
   */
  scheduleMemeCountsCheck() {
    const task = cron.schedule(
      '0 1 * * *',
      async () => {
        try {
          console.log('🔍 開始每日迷因統計計數檢查...')
          const result = await checkAndFixCounts()

          if (result.fixed > 0) {
            console.log(`✅ 迷因統計檢查完成，修正了 ${result.fixed} 個迷因的計數`)
            logger.info('Daily meme counts check completed', {
              total: result.total,
              fixed: result.fixed,
              errors: result.errors.length,
            })
          } else {
            console.log('✅ 迷因統計檢查完成，無需修正')
          }
        } catch (error) {
          console.error('❌ 每日迷因統計檢查失敗:', error)
          logger.error('Daily meme counts check failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('dailyMemeCountsCheck', task)
    console.log('📅 已排程每日迷因統計檢查 (凌晨1點)')
  }

  /**
   * 每日用戶統計計數檢查 (凌晨1點)
   */
  scheduleUserCountsCheck() {
    const task = cron.schedule(
      '0 1 * * *',
      async () => {
        try {
          console.log('🔍 開始每日用戶統計計數檢查...')
          const result = await checkAndFixUserCounts()

          if (result.fixed > 0) {
            console.log(`✅ 用戶統計檢查完成，修正了 ${result.fixed} 個用戶的計數`)
            logger.info('Daily user counts check completed', {
              total: result.total,
              fixed: result.fixed,
              errors: result.errors.length,
            })
          } else {
            console.log('✅ 用戶統計檢查完成，無需修正')
          }
        } catch (error) {
          console.error('❌ 每日用戶統計檢查失敗:', error)
          logger.error('Daily user counts check failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('dailyUserCountsCheck', task)
    console.log('📅 已排程每日用戶統計檢查 (凌晨1點)')
  }

  /**
   * 每週完整數據檢查 (週日凌晨4點)
   */
  scheduleWeeklyFullCheck() {
    const task = cron.schedule(
      '0 4 * * 0',
      async () => {
        try {
          console.log('🔍 開始每週完整數據檢查...')

          // 檢查迷因統計
          const memeResult = await checkAndFixCounts()

          // 檢查用戶統計
          const userResult = await checkAndFixUserCounts()

          const totalFixed = memeResult.fixed + userResult.fixed
          const totalErrors = memeResult.errors.length + userResult.errors.length

          console.log(`✅ 每週完整檢查完成，修正了 ${totalFixed} 項數據`)

          logger.info('Weekly full data check completed', {
            memes: {
              total: memeResult.total,
              fixed: memeResult.fixed,
              errors: memeResult.errors.length,
            },
            users: {
              total: userResult.total,
              fixed: userResult.fixed,
              errors: userResult.errors.length,
            },
            summary: {
              totalFixed,
              totalErrors,
            },
          })

          // 如果有錯誤，記錄詳細信息
          if (totalErrors > 0) {
            const allErrors = [...memeResult.errors, ...userResult.errors]
            logger.warn('Weekly check found errors', { errors: allErrors })
          }
        } catch (error) {
          console.error('❌ 每週完整數據檢查失敗:', error)
          logger.error('Weekly full data check failed', { error: error.message })
        }
      },
      {
        timezone: 'Asia/Taipei',
      },
    )

    this.tasks.set('weeklyFullCheck', task)
    console.log('📅 已排程每週完整數據檢查 (週日凌晨4點)')
  }

  /**
   * 手動觸發完整數據檢查
   */
  async runFullCheck() {
    try {
      console.log('🔍 手動觸發完整數據檢查...')

      const [memeResult, userResult] = await Promise.all([
        checkAndFixCounts(),
        checkAndFixUserCounts(),
      ])

      const summary = {
        memes: {
          total: memeResult.total,
          fixed: memeResult.fixed,
          errors: memeResult.errors.length,
        },
        users: {
          total: userResult.total,
          fixed: userResult.fixed,
          errors: userResult.errors.length,
        },
        totalFixed: memeResult.fixed + userResult.fixed,
        totalErrors: memeResult.errors.length + userResult.errors.length,
      }

      console.log(`✅ 手動檢查完成，修正了 ${summary.totalFixed} 項數據`)

      return summary
    } catch (error) {
      console.error('❌ 手動數據檢查失敗:', error)
      throw error
    }
  }

  /**
   * 獲取任務狀態
   */
  getTasksStatus() {
    const status = {}
    this.tasks.forEach((task, name) => {
      status[name] = {
        running: task.running,
        lastDate: task.lastDate,
      }
    })
    return status
  }
}

// 創建全局實例
const maintenanceScheduler = new MaintenanceScheduler()

export default maintenanceScheduler
export { MaintenanceScheduler }
