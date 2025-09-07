import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import cacheManager from '../../../utils/cacheManager.js'
import cacheMonitor from '../../../utils/cacheMonitor.js'
import cacheVersionManager from '../../../utils/cacheVersionManager.js'

// Mock Redis client
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
}

const mockRedisCache = {
  client: mockRedisClient,
  isEnabled: true,
  isConnected: true,
  connect: vi.fn(),
  disconnect: vi.fn(),
  set: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockImplementation(async (key) => {
    const value = await mockRedisClient.get(key)
    if (!value) return null

    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }),
  del: vi.fn().mockResolvedValue(true),
  exists: vi.fn().mockImplementation(async (key) => {
    const result = await mockRedisClient.exists(key)
    return result === 1
  }),
  delPattern: vi.fn(),
  getStats: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
}

describe('CacheManager', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock Redis client
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

    // Re-setup mock Redis cache after clearing mocks
    mockRedisCache.get = vi.fn().mockImplementation(async (key) => {
      const value = await mockRedisClient.get(key)
      if (!value) return null

      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    })
    mockRedisCache.set = vi.fn().mockImplementation(async (key, value, ttl = 3600) => {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)
      await mockRedisClient.setex(key, ttl, serializedValue)
      return true
    })
    mockRedisCache.del = vi.fn().mockImplementation(async (key) => {
      await mockRedisClient.del(key)
      return true
    })
    mockRedisCache.exists = vi.fn().mockImplementation(async (key) => {
      const result = await mockRedisClient.exists(key)
      return result === 1
    })
    mockRedisCache.ping = vi.fn().mockResolvedValue('PONG')
    mockRedisCache.getStats = vi.fn().mockResolvedValue({
      connected: true,
      enabled: true,
      keys: 10,
      info: { redis_version: '6.2.0' },
    })

    // Setup cache manager with mock Redis
    cacheManager.redis = mockRedisCache
    cacheManager.isEnabled = true // Enable cache manager for tests
    cacheVersionManager.redis = mockRedisCache

    // Enable monitoring for tests
    cacheMonitor.setEnabled(true)
  })

  afterEach(() => {
    // Reset cache monitor
    cacheMonitor.reset()
  })

  describe('getOrSet', () => {
    it('應該從快取取得資料', async () => {
      const cacheKey = 'test:key'
      const expectedData = { id: 1, name: 'test' }
      const fetchFunction = vi.fn()

      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedData))

      const result = await cacheManager.getOrSet(cacheKey, fetchFunction)

      expect(result).toEqual(expectedData)
      expect(fetchFunction).not.toHaveBeenCalled()
      expect(mockRedisClient.get).toHaveBeenCalledWith(cacheKey)
    })

    it('應該在快取未命中時執行獲取函數', async () => {
      const cacheKey = 'test:key'
      const expectedData = { id: 1, name: 'test' }
      const fetchFunction = vi.fn().mockResolvedValue(expectedData)

      mockRedisClient.get.mockResolvedValue(null)

      const result = await cacheManager.getOrSet(cacheKey, fetchFunction)

      expect(result).toEqual(expectedData)
      expect(fetchFunction).toHaveBeenCalledTimes(1)
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        cacheKey,
        3600,
        JSON.stringify(expectedData),
      )
    })

    it('應該支援版本控制', async () => {
      const cacheKey = 'test:key'
      const expectedData = { id: 1, name: 'test' }
      const fetchFunction = vi.fn().mockResolvedValue(expectedData)

      mockRedisClient.get.mockResolvedValue(null)

      const result = await cacheManager.getOrSet(cacheKey, fetchFunction, {
        useVersion: true,
        clientVersion: '1.0.0',
      })

      expect(result.data).toEqual(expectedData)
      expect(result.version).toBe('1.0.0')
      expect(result.fromCache).toBe(false)
    })

    it('應該處理版本過期', async () => {
      const cacheKey = 'test:key'
      const expectedData = { id: 1, name: 'test' }
      const fetchFunction = vi.fn().mockResolvedValue(expectedData)

      // Mock version manager
      vi.spyOn(cacheVersionManager, 'isVersionStale').mockResolvedValue(true)
      vi.spyOn(cacheVersionManager, 'updateVersion').mockResolvedValue('1.1.0')

      const result = await cacheManager.getOrSet(cacheKey, fetchFunction, {
        useVersion: true,
        clientVersion: '1.0.0',
      })

      expect(result.data).toEqual(expectedData)
      expect(result.version).toBe('1.1.0')
      expect(result.fromCache).toBe(false)
    })
  })

  describe('get', () => {
    it('應該從快取取得資料', async () => {
      const cacheKey = 'test:key'
      const expectedData = { id: 1, name: 'test' }

      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedData))

      const result = await cacheManager.get(cacheKey)

      expect(result).toEqual(expectedData)
      expect(mockRedisClient.get).toHaveBeenCalledWith(cacheKey)
    })

    it('應該在快取不存在時返回 null', async () => {
      const cacheKey = 'test:key'

      mockRedisClient.get.mockResolvedValue(null)

      const result = await cacheManager.get(cacheKey)

      expect(result).toBeNull()
    })

    it('應該支援版本控制的 get 操作', async () => {
      const cacheKey = 'test:key'
      const expectedData = { id: 1, name: 'test' }

      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedData))
      vi.spyOn(cacheVersionManager, 'getVersion').mockResolvedValue('1.0.0')

      const result = await cacheManager.get(cacheKey, { useVersion: true })

      expect(result.data).toEqual(expectedData)
      expect(result.version).toBe('1.0.0')
      expect(result.fromCache).toBe(true)
    })
  })

  describe('set', () => {
    it('應該設定快取資料', async () => {
      const cacheKey = 'test:key'
      const data = { id: 1, name: 'test' }

      const result = await cacheManager.set(cacheKey, data)

      expect(result).toBe(true)
      expect(mockRedisClient.setex).toHaveBeenCalledWith(cacheKey, 3600, JSON.stringify(data))
    })

    it('應該支援自定義 TTL', async () => {
      const cacheKey = 'test:key'
      const data = { id: 1, name: 'test' }
      const ttl = 1800

      const result = await cacheManager.set(cacheKey, data, { ttl })

      expect(result).toBe(true)
      expect(mockRedisClient.setex).toHaveBeenCalledWith(cacheKey, ttl, JSON.stringify(data))
    })

    it('應該支援版本控制的 set 操作', async () => {
      const cacheKey = 'test:key'
      const data = { id: 1, name: 'test' }

      vi.spyOn(cacheVersionManager, 'updateVersion').mockResolvedValue('1.1.0')

      const result = await cacheManager.set(cacheKey, data, { useVersion: true })

      expect(result).toBe(true)
      expect(cacheVersionManager.updateVersion).toHaveBeenCalledWith(cacheKey, 'patch')
    })
  })

  describe('del', () => {
    it('應該刪除快取資料', async () => {
      const cacheKey = 'test:key'

      const result = await cacheManager.del(cacheKey)

      expect(result).toBe(true)
      expect(mockRedisClient.del).toHaveBeenCalledWith(cacheKey)
      expect(mockRedisClient.del).toHaveBeenCalledWith(`${cacheKey}:version`)
    })
  })

  describe('delMulti', () => {
    it('應該批量刪除快取資料', async () => {
      const cacheKeys = ['test:key1', 'test:key2', 'test:key3']

      const result = await cacheManager.delMulti(cacheKeys)

      expect(result.deleted).toBe(3)
      expect(result.errors).toHaveLength(0)
      expect(mockRedisClient.del).toHaveBeenCalledTimes(6) // 3 keys + 3 versions
    })

    it('應該處理刪除錯誤', async () => {
      const cacheKeys = ['test:key1', 'test:key2']

      // Mock del to reject on first call
      mockRedisCache.del = vi
        .fn()
        .mockRejectedValueOnce(new Error('Delete failed'))
        .mockResolvedValue(true)

      const result = await cacheManager.delMulti(cacheKeys)

      expect(result.deleted).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].key).toBe('test:key1')
    })
  })

  describe('exists', () => {
    it('應該檢查快取是否存在', async () => {
      const cacheKey = 'test:key'
      mockRedisClient.exists.mockResolvedValue(1)

      const result = await cacheManager.exists(cacheKey)

      expect(result).toBe(true)
      expect(mockRedisClient.exists).toHaveBeenCalledWith(cacheKey)
    })

    it('應該處理不存在的快取', async () => {
      const cacheKey = 'test:key'
      mockRedisClient.exists.mockResolvedValue(0)

      const result = await cacheManager.exists(cacheKey)

      expect(result).toBe(false)
    })
  })

  describe('updateVersion', () => {
    it('應該更新快取版本', async () => {
      const cacheKey = 'test:key'

      vi.spyOn(cacheVersionManager, 'updateVersion').mockResolvedValue('1.1.0')

      const result = await cacheManager.updateVersion(cacheKey, 'minor')

      expect(result).toBe('1.1.0')
      expect(cacheVersionManager.updateVersion).toHaveBeenCalledWith(cacheKey, 'minor')
    })
  })

  describe('getVersion', () => {
    it('應該取得快取版本', async () => {
      const cacheKey = 'test:key'

      vi.spyOn(cacheVersionManager, 'getVersion').mockResolvedValue('1.0.0')

      const result = await cacheManager.getVersion(cacheKey)

      expect(result).toBe('1.0.0')
      expect(cacheVersionManager.getVersion).toHaveBeenCalledWith(cacheKey)
    })
  })

  describe('getStats', () => {
    it('應該取得快取統計資訊', async () => {
      mockRedisCache.getStats.mockResolvedValue({
        connected: true,
        enabled: true,
        keys: 10,
        info: { redis_version: '6.2.0' },
      })

      vi.spyOn(cacheVersionManager, 'getVersionStats').mockResolvedValue({
        memoryCache: 5,
        redisCache: 3,
        total: 8,
      })

      const result = await cacheManager.getStats()

      expect(result.redis).toBeDefined()
      expect(result.manager).toBeDefined()
      expect(result.version).toBeDefined()
      expect(result.redis.connected).toBe(true)
      expect(result.version.memoryCache).toBe(5)
    })
  })

  describe('healthCheck', () => {
    it('應該執行健康檢查', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG')

      const result = await cacheManager.healthCheck()

      expect(result.status).toBe('healthy')
      expect(result.redis.enabled).toBe(true)
      expect(result.redis.connected).toBe(true)
      expect(result.redis.ping).toBe('PONG')
    })

    it('應該處理不健康的狀態', async () => {
      mockRedisCache.isConnected = false
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'))

      const result = await cacheManager.healthCheck()

      expect(result.status).toBe('unhealthy')
      expect(result.redis.connected).toBe(false)
    })
  })

  describe('error handling', () => {
    it('應該處理 Redis 連線錯誤', async () => {
      mockRedisCache.isConnected = false
      const fetchFunction = vi.fn().mockResolvedValue({ data: 'test' })

      const result = await cacheManager.getOrSet('test:key', fetchFunction)

      expect(result).toEqual({ data: 'test' })
    })

    it('應該處理快取操作錯誤', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'))
      const fetchFunction = vi.fn().mockResolvedValue({ data: 'fallback' })

      const result = await cacheManager.getOrSet('test:key', fetchFunction)

      expect(result).toEqual({ data: 'fallback' })
    })
  })

  describe('performance report', () => {
    it('應該產生效能報告', () => {
      // Add some mock data to monitor
      cacheMonitor.recordHit('test:key1')
      cacheMonitor.recordMiss('test:key2')

      const report = cacheManager.getPerformanceReport()

      expect(typeof report).toBe('string')
      expect(report).toContain('快取效能報告')
      expect(report).toContain('命中率')
    })
  })
})
