import { logger } from '../utils/logger.js'
import util from 'util'

class LogService {
  constructor() {
    this.logBuffer = []
    this.maxBufferSize = 1000
    this.setupLogCapture()
  }

  // 設置日誌捕獲
  setupLogCapture() {
    // 攔截 console 輸出
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn

    console.log = (...args) => {
      this.addToBuffer('info', this.formatLogArgs(args), 'console')
      originalConsoleLog(...args)
    }

    console.error = (...args) => {
      this.addToBuffer('error', this.formatLogArgs(args), 'console')
      originalConsoleError(...args)
    }

    console.warn = (...args) => {
      this.addToBuffer('warn', this.formatLogArgs(args), 'console')
      originalConsoleWarn(...args)
    }

    // 攔截 pino logger
    const originalLoggerInfo = logger.info.bind(logger)
    const originalLoggerError = logger.error.bind(logger)
    const originalLoggerWarn = logger.warn.bind(logger)

    logger.info = (...args) => {
      this.addToBuffer('info', this.formatLogArgs(args), 'pino')
      originalLoggerInfo(...args)
    }

    logger.error = (...args) => {
      this.addToBuffer('error', this.formatLogArgs(args), 'pino')
      originalLoggerError(...args)
    }

    logger.warn = (...args) => {
      this.addToBuffer('warn', this.formatLogArgs(args), 'pino')
      originalLoggerWarn(...args)
    }

    // 添加一些測試日誌來確保系統正常工作
    this.addToBuffer('info', '日誌服務已初始化', 'system')
    this.addToBuffer('info', '系統啟動完成', 'system')
    this.addToBuffer('warn', '這是一條測試警告日誌', 'test')
    this.addToBuffer('error', '這是一條測試錯誤日誌', 'test')
  }

  formatLogArgs(args) {
    try {
      const parts = args.map((arg) => {
        try {
          if (typeof arg === 'string') return arg
          if (typeof arg === 'number' || typeof arg === 'boolean' || arg == null) return String(arg)
          if (typeof arg === 'symbol') return String(arg)
          if (typeof arg === 'function') return `[Function ${arg.name || 'anonymous'}]`
          // 安全處理物件（含循環引用）
          return util.inspect(arg, { depth: 3, maxArrayLength: 50, breakLength: 120 })
        } catch {
          return '[Unserializable]'
        }
      })
      return parts.join(' ')
    } catch {
      return '[Log formatting error]'
    }
  }

  addToBuffer(level, message, context) {
    const logEntry = {
      id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      message: this.sanitizeMessage(message),
      context,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    }

    this.logBuffer.unshift(logEntry)

    // 保持緩衝區大小
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(0, this.maxBufferSize)
    }
  }

  // 敏感資訊遮罩
  sanitizeMessage(message) {
    if (typeof message !== 'string') return message

    return (
      message
        // 遮罩 JWT token
        .replace(/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, 'Bearer [TOKEN]')
        // 遮罩密碼
        .replace(/"password"\s*:\s*"[^"]*"/g, '"password": "[MASKED]"')
        // 遮罩 email
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
        // 遮罩 MongoDB ObjectId 部分
        .replace(/ObjectId\('[a-f0-9]{24}'\)/g, 'ObjectId([ID])')
        // 遮罩 API key
        .replace(/api[_-]?key["\s]*[:=]["\s]*[a-zA-Z0-9]+/gi, 'api_key: "[MASKED]"')
    )
  }

  // 獲取日誌列表
  async getLogs(options = {}) {
    const {
      level = null,
      startDate = null,
      endDate = null,
      search = null,
      page = 1,
      limit = 50,
      context = null,
    } = options

    let filteredLogs = [...this.logBuffer]

    // 等級篩選
    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level)
    }

    // 時間範圍篩選
    if (startDate) {
      const start = new Date(startDate).getTime()
      filteredLogs = filteredLogs.filter((log) => log.timestamp >= start)
    }

    if (endDate) {
      const end = new Date(endDate).getTime()
      filteredLogs = filteredLogs.filter((log) => log.timestamp <= end)
    }

    // 來源篩選
    if (context) {
      filteredLogs = filteredLogs.filter((log) => log.context === context)
    }

    // 搜尋篩選
    if (search) {
      const searchLower = search.toLowerCase()
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          log.context.toLowerCase().includes(searchLower),
      )
    }

    // 分頁
    const total = filteredLogs.length
    const offset = (page - 1) * limit
    const paginatedLogs = filteredLogs.slice(offset, offset + limit)

    return {
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // 獲取日誌統計
  getLogStatistics() {
    const stats = {
      total: this.logBuffer.length,
      levels: {},
      contexts: {},
      recentActivity: {},
    }

    // 計算各等級數量
    this.logBuffer.forEach((log) => {
      stats.levels[log.level] = (stats.levels[log.level] || 0) + 1
      stats.contexts[log.context] = (stats.contexts[log.context] || 0) + 1
    })

    // 最近24小時活動
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const recentLogs = this.logBuffer.filter((log) => log.timestamp > oneDayAgo)

    recentLogs.forEach((log) => {
      const hour = new Date(log.timestamp).getHours()
      stats.recentActivity[hour] = (stats.recentActivity[hour] || 0) + 1
    })

    return stats
  }

  // 匯出日誌為 CSV
  exportToCSV(logs) {
    const headers = ['ID', '等級', '訊息', '來源', '時間']
    const csvContent = [
      headers.join(','),
      ...logs.map((log) =>
        [
          log.id,
          log.level,
          `"${log.message.replace(/"/g, '""')}"`, // CSV 轉義
          log.context,
          log.createdAt,
        ].join(','),
      ),
    ].join('\n')

    return csvContent
  }

  // 清理舊日誌
  cleanOldLogs(daysToKeep = 7) {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
    const initialCount = this.logBuffer.length

    this.logBuffer = this.logBuffer.filter((log) => log.timestamp > cutoffTime)

    const removedCount = initialCount - this.logBuffer.length
    logger.info(`清理了 ${removedCount} 條舊日誌，保留 ${this.logBuffer.length} 條`)

    return { removedCount, remainingCount: this.logBuffer.length }
  }

  // 獲取可用的來源列表
  getAvailableContexts() {
    const contexts = [...new Set(this.logBuffer.map((log) => log.context))]
    return contexts.sort()
  }
}

// 單例模式
const logService = new LogService()

export default logService
