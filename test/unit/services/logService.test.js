import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 獨立測試，不依賴資料庫和外部服務
describe('LogService 獨立測試', () => {
  let logService

  beforeEach(async () => {
    // 直接導入真實的 logService 以測試完整功能
    const module = await import('../../../services/logService.js')
    logService = module.default

    // 清空緩衝區確保測試隔離
    logService.logBuffer = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基本功能測試', () => {
    it('應該能初始化日誌服務', () => {
      expect(logService).toBeDefined()
      expect(logService.logBuffer).toEqual([])
      expect(logService.maxBufferSize).toBe(1000)
    })

    it('應該能手動添加日誌到緩衝區', () => {
      logService.addToBuffer('info', '測試訊息', 'test')

      expect(logService.logBuffer).toHaveLength(1)
      expect(logService.logBuffer[0]).toMatchObject({
        level: 'info',
        message: '測試訊息',
        context: 'test',
      })
      expect(logService.logBuffer[0].id).toMatch(/^L-\d+-[a-z0-9]+$/)
    })

    it('應該能處理敏感資訊遮罩', () => {
      // 測試基本的敏感資訊遮罩功能
      expect(logService.sanitizeMessage('{"password":"secret"}')).toContain('[MASKED]')
      expect(logService.sanitizeMessage('user@test.com')).toBe('[EMAIL]')
      expect(logService.sanitizeMessage("ObjectId('123456789012345678901234')")).toBe(
        'ObjectId([ID])',
      )

      // 測試非字串輸入
      expect(logService.sanitizeMessage(null)).toBe(null)
      expect(logService.sanitizeMessage(123)).toBe(123)
    })

    it('應該能格式化不同類型的參數', () => {
      const args = ['字串', 123, { key: 'value' }, true, null, undefined]
      const result = logService.formatLogArgs(args)

      expect(result).toBe('字串 123 {"key":"value"} true null undefined')
    })

    it('應該維持緩衝區大小限制', () => {
      const originalMaxSize = logService.maxBufferSize
      logService.maxBufferSize = 3

      // 添加超過限制的日誌
      for (let i = 1; i <= 5; i++) {
        logService.addToBuffer('info', `訊息${i}`, 'test')
      }

      expect(logService.logBuffer).toHaveLength(3)
      expect(logService.logBuffer[0].message).toBe('訊息5')
      expect(logService.logBuffer[2].message).toBe('訊息3')

      logService.maxBufferSize = originalMaxSize
    })
  })

  describe('查詢功能測試', () => {
    beforeEach(() => {
      // 準備測試數據
      logService.logBuffer = []
      const now = Date.now()

      logService.addToBuffer('info', '資訊訊息1', 'api')
      logService.addToBuffer('warn', '警告訊息1', 'database')
      logService.addToBuffer('error', '錯誤訊息1', 'api')
      logService.addToBuffer('info', '資訊訊息2', 'console')

      // 手動設置時間戳以便測試時間篩選
      logService.logBuffer.forEach((log, index) => {
        log.timestamp = now - index * 60000 // 每條日誌間隔1分鐘
      })
    })

    it('應該能獲取所有日誌', async () => {
      const result = await logService.getLogs()

      expect(result.logs).toHaveLength(4)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 4,
        pages: 1,
      })
    })

    it('應該能根據等級篩選', async () => {
      const result = await logService.getLogs({ level: 'info' })

      expect(result.logs).toHaveLength(2)
      expect(result.logs.every((log) => log.level === 'info')).toBe(true)
    })

    it('應該能根據來源篩選', async () => {
      const result = await logService.getLogs({ context: 'api' })

      expect(result.logs).toHaveLength(2)
      expect(result.logs.every((log) => log.context === 'api')).toBe(true)
    })

    it('應該能搜尋關鍵字', async () => {
      const result = await logService.getLogs({ search: '警告' })

      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].message).toContain('警告')
    })

    it('應該能分頁查詢', async () => {
      const page1 = await logService.getLogs({ page: 1, limit: 2 })
      const page2 = await logService.getLogs({ page: 2, limit: 2 })

      expect(page1.logs).toHaveLength(2)
      expect(page2.logs).toHaveLength(2)
      expect(page1.pagination.total).toBe(4)
      expect(page2.pagination.total).toBe(4)
    })

    it('應該能根據時間範圍篩選', async () => {
      const now = Date.now()
      const twoMinutesAgo = now - 2 * 60000

      const result = await logService.getLogs({
        startDate: new Date(twoMinutesAgo).toISOString(),
      })

      // 應該只包含最近2分鐘的日誌
      expect(result.logs.length).toBeLessThanOrEqual(3)
    })
  })

  describe('統計功能測試', () => {
    beforeEach(() => {
      logService.logBuffer = []
      logService.addToBuffer('info', '資訊1', 'api')
      logService.addToBuffer('info', '資訊2', 'database')
      logService.addToBuffer('warn', '警告1', 'api')
      logService.addToBuffer('error', '錯誤1', 'console')
    })

    it('應該能生成正確的統計資料', () => {
      const stats = logService.getLogStatistics()

      expect(stats.total).toBe(4)
      expect(stats.levels).toEqual({
        info: 2,
        warn: 1,
        error: 1,
      })
      expect(stats.contexts).toEqual({
        api: 2,
        database: 1,
        console: 1,
      })
      expect(stats.recentActivity).toBeDefined()
    })
  })

  describe('CSV 匯出測試', () => {
    it('應該能生成 CSV 格式', () => {
      const logs = [
        {
          id: 'L-123',
          level: 'info',
          message: '測試訊息',
          context: 'test',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'L-124',
          level: 'error',
          message: '包含"引號"的訊息',
          context: 'api',
          createdAt: '2024-01-01T01:00:00.000Z',
        },
      ]

      const csv = logService.exportToCSV(logs)
      const lines = csv.split('\n')

      expect(lines[0]).toBe('ID,等級,訊息,來源,時間')
      expect(lines[1]).toBe('L-123,info,"測試訊息",test,2024-01-01T00:00:00.000Z')
      expect(lines[2]).toBe('L-124,error,"包含""引號""的訊息",api,2024-01-01T01:00:00.000Z')
    })
  })

  describe('清理功能測試', () => {
    it('應該能清理舊日誌', () => {
      const now = Date.now()
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000

      // 完全重置緩衝區
      logService.logBuffer = [
        {
          id: 'new-log',
          level: 'info',
          message: '新日誌',
          context: 'test',
          timestamp: now,
          createdAt: new Date(now).toISOString(),
        },
        {
          id: 'old-log',
          level: 'info',
          message: '舊日誌',
          context: 'test',
          timestamp: threeDaysAgo,
          createdAt: new Date(threeDaysAgo).toISOString(),
        },
      ]

      const result = logService.cleanOldLogs(2)

      // 驗證清理結果 - 考慮到 cleanOldLogs 本身會產生日誌
      expect(result.removedCount).toBe(1)
      expect(logService.logBuffer.length).toBeGreaterThanOrEqual(1)

      // 確認舊日誌被清理，新日誌保留
      const hasNewLog = logService.logBuffer.some((log) => log.id === 'new-log')
      const hasOldLog = logService.logBuffer.some((log) => log.id === 'old-log')

      expect(hasNewLog).toBe(true)
      expect(hasOldLog).toBe(false)
    })
  })

  describe('來源管理測試', () => {
    it('應該能獲取去重排序的來源列表', () => {
      logService.logBuffer = []
      logService.addToBuffer('info', '訊息1', 'zebra')
      logService.addToBuffer('warn', '訊息2', 'api')
      logService.addToBuffer('error', '訊息3', 'zebra')
      logService.addToBuffer('info', '訊息4', 'database')

      const contexts = logService.getAvailableContexts()

      expect(contexts).toEqual(['api', 'database', 'zebra'])
    })
  })
})
