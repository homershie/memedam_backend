import { describe, it, expect, beforeEach, vi } from 'vitest'
import integratedCache from '../../config/cache.js'

// Mock Redis for integration tests
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  keys: vi.fn(),
  ping: vi.fn(),
  info: vi.fn(),
  dbsize: vi.fn(),
  expire: vi.fn(),
  quit: vi.fn(),
  connect: vi.fn(),
}

const mockRedisCache = {
  client: mockRedisClient,
  isEnabled: true,
  isConnected: false, // Start as disconnected for testing
  connect: vi.fn(),
  disconnect: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  delPattern: vi.fn(),
  getStats: vi.fn(),
  ping: vi.fn(),
}

describe('Integrated Cache System', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock Redis
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.set.mockResolvedValue(true)
    mockRedisClient.setex.mockResolvedValue(true)
    mockRedisClient.del.mockResolvedValue(1)
    mockRedisClient.exists.mockResolvedValue(0)
    mockRedisClient.keys.mockResolvedValue([])
    mockRedisClient.ping.mockResolvedValue('PONG')
    mockRedisClient.info.mockResolvedValue('redis_version:6.2.0\nconnected_clients:1\n')
    mockRedisClient.dbsize.mockResolvedValue(10)
    mockRedisClient.expire.mockResolvedValue(true)
    mockRedisClient.quit.mockResolvedValue(true)
    mockRedisClient.connect.mockResolvedValue(true)

    mockRedisCache.connect.mockResolvedValue(true)
    mockRedisCache.disconnect.mockResolvedValue(true)
    mockRedisCache.getStats.mockResolvedValue({
      connected: true,
      enabled: true,
      keys: 10,
      info: { redis_version: '6.2.0' },
    })
  })

  describe('initialization', () => {
    it('應該成功初始化整合快取系統', async () => {
      mockRedisCache.isConnected = true

      const result = await integratedCache.initialize()

      expect(result).toBe(true)
      expect(mockRedisCache.connect).toHaveBeenCalled()
    })

    it('應該處理初始化失敗', async () => {
      mockRedisCache.connect.mockRejectedValue(new Error('Connection failed'))

      const result = await integratedCache.initialize()

      expect(result).toBe(false)
    })
  })

  describe('health check', () => {
    it('應該執行健康檢查', async () => {
      mockRedisCache.isConnected = true

      const result = await integratedCache.healthCheck()

      expect(result.integrated).toBe(true)
      expect(result.redis).toBeDefined()
      expect(result.manager).toBeDefined()
    })

    it('應該處理不健康的狀態', async () => {
      mockRedisCache.isConnected = false

      const result = await integratedCache.healthCheck()

      expect(result.integrated).toBe(true)
      expect(result.overall).toBe('unhealthy')
    })
  })

  describe('stats retrieval', () => {
    it('應該取得整合統計資訊', async () => {
      mockRedisCache.isConnected = true

      const result = await integratedCache.getStats()

      expect(result.integrated).toBe(true)
      expect(result.redis).toBeDefined()
      expect(result.manager).toBeDefined()
      expect(result.timestamp).toBeDefined()
    })

    it('應該處理統計取得失敗', async () => {
      mockRedisCache.getStats.mockRejectedValue(new Error('Stats error'))

      const result = await integratedCache.getStats()

      expect(result.integrated).toBe(true)
      expect(result.error).toBe('Stats error')
      expect(result.timestamp).toBeDefined()
    })
  })

  describe('cache operations', () => {
    beforeEach(async () => {
      mockRedisCache.isConnected = true
      await integratedCache.initialize()
    })

    it('應該支援基本的快取操作', async () => {
      const testKey = 'integration:test'
      const testData = { message: 'Hello from integrated cache' }

      // Test set operation
      const setResult = await integratedCache.manager.set(testKey, testData)
      expect(setResult).toBe(true)

      // Test get operation
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData))
      const getResult = await integratedCache.manager.get(testKey)
      expect(getResult).toEqual(testData)

      // Test exists operation
      mockRedisClient.exists.mockResolvedValue(1)
      const existsResult = await integratedCache.manager.exists(testKey)
      expect(existsResult).toBe(true)

      // Test delete operation
      const deleteResult = await integratedCache.manager.del(testKey)
      expect(deleteResult).toBe(true)
    })

    it('應該支援 getOrSet 操作', async () => {
      const testKey = 'integration:getorset'
      const testData = { data: 'from function' }
      const fetchFunction = vi.fn().mockResolvedValue(testData)

      // Test cache miss
      const result = await integratedCache.manager.getOrSet(testKey, fetchFunction)

      expect(result).toEqual(testData)
      expect(fetchFunction).toHaveBeenCalledTimes(1)
      expect(mockRedisClient.setex).toHaveBeenCalledWith(testKey, 3600, JSON.stringify(testData))
    })

    it('應該支援版本控制', async () => {
      const testKey = 'integration:versioned'
      const testData = { version: 'test' }

      // Mock version operations
      vi.spyOn(integratedCache.versionManager, 'getVersion').mockResolvedValue('1.0.0')
      vi.spyOn(integratedCache.versionManager, 'updateVersion').mockResolvedValue('1.1.0')

      const result = await integratedCache.manager.getOrSet(
        testKey,
        () => Promise.resolve(testData),
        {
          useVersion: true,
        },
      )

      expect(result.data).toEqual(testData)
      expect(result.version).toBe('1.1.0')
      expect(result.fromCache).toBe(false)
    })
  })

  describe('monitoring integration', () => {
    beforeEach(async () => {
      mockRedisCache.isConnected = true
      await integratedCache.initialize()
    })

    it('應該整合快取監控', async () => {
      const testKey = 'monitor:test'

      // Perform some operations
      await integratedCache.manager.get(testKey) // Miss
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ hit: true }))
      await integratedCache.manager.get(testKey) // Hit

      // Check monitor stats
      const stats = integratedCache.monitor.getStats()
      expect(stats.summary.totalRequests).toBeGreaterThan(0)
      expect(stats.summary.totalHits).toBeGreaterThanOrEqual(0)
      expect(stats.summary.totalMisses).toBeGreaterThanOrEqual(0)
    })

    it('應該產生效能報告', () => {
      const report = integratedCache.getPerformanceReport()

      expect(typeof report).toBe('string')
      expect(report).toContain('快取效能報告')
    })
  })

  describe('cleanup', () => {
    it('應該支援清理操作', async () => {
      mockRedisCache.isConnected = true

      const result = await integratedCache.clearAll()

      expect(result).toBe(true)
    })

    it('應該支援重新連接', async () => {
      mockRedisCache.isConnected = false
      mockRedisCache.connect.mockResolvedValue(true)

      const result = await integratedCache.reconnect()

      expect(result).toBe(true)
      expect(mockRedisCache.connect).toHaveBeenCalled()
    })

    it('應該支援斷開連線', async () => {
      await integratedCache.disconnect()

      expect(mockRedisCache.disconnect).toHaveBeenCalled()
    })
  })

  describe('error scenarios', () => {
    it('應該處理 Redis 連線中斷', async () => {
      mockRedisCache.isConnected = false

      const health = await integratedCache.healthCheck()
      expect(health.overall).toBe('unhealthy')

      // Operations should still work (fallback to direct function calls)
      const fetchFunction = vi.fn().mockResolvedValue({ fallback: true })
      const result = await integratedCache.manager.getOrSet('test:key', fetchFunction)
      expect(result).toEqual({ fallback: true })
    })

    it('應該處理初始化錯誤', async () => {
      mockRedisCache.connect.mockRejectedValue(new Error('Init failed'))

      const result = await integratedCache.initialize()
      expect(result).toBe(false)
    })
  })
})
