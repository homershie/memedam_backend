/**
 * 快取版本管理器測試
 * 測試版本控制功能的核心邏輯
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheVersionManager } from '../../../utils/cacheVersionManager.js'

// Mock Redis 客戶端
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
}

describe('CacheVersionManager', () => {
  let versionManager

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()

    // 創建版本管理器實例
    versionManager = new CacheVersionManager(mockRedisClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('基本版本管理', () => {
    it('應該返回預設版本號當快取鍵不存在時', async () => {
      mockRedisClient.get.mockResolvedValue(null)

      const version = await versionManager.getVersion('test:key')

      expect(version).toBe('1.0.0')
      expect(mockRedisClient.get).toHaveBeenCalledWith('cache_version:test:key')
    })

    it('應該返回已存在的版本號', async () => {
      mockRedisClient.get.mockResolvedValue('2.1.3')

      const version = await versionManager.getVersion('test:key')

      expect(version).toBe('2.1.3')
    })

    it('應該正確更新版本號', async () => {
      mockRedisClient.get.mockResolvedValue('1.0.0')
      mockRedisClient.set.mockResolvedValue('OK')

      const newVersion = await versionManager.updateVersion('test:key')

      expect(newVersion).toBe('1.0.1') // patch 版本遞增
      expect(mockRedisClient.set).toHaveBeenCalledWith('cache_version:test:key', '1.0.1')
    })

    it('應該能夠設定特定的版本號', async () => {
      mockRedisClient.set.mockResolvedValue('OK')

      const newVersion = await versionManager.updateVersion('test:key', '3.2.1')

      expect(newVersion).toBe('3.2.1')
      expect(mockRedisClient.set).toHaveBeenCalledWith('cache_version:test:key', '3.2.1')
    })
  })

  describe('版本遞增邏輯', () => {
    it('應該正確執行 patch 版本遞增', () => {
      expect(versionManager.incrementVersion('1.0.0', 'patch')).toBe('1.0.1')
      expect(versionManager.incrementVersion('1.0.99', 'patch')).toBe('1.0.100')
    })

    it('應該正確執行 minor 版本遞增', () => {
      expect(versionManager.incrementVersion('1.0.0', 'minor')).toBe('1.1.0')
      expect(versionManager.incrementVersion('1.0.99', 'minor')).toBe('1.1.0')
    })

    it('應該正確執行 major 版本遞增', () => {
      expect(versionManager.incrementVersion('1.0.0', 'major')).toBe('2.0.0')
      expect(versionManager.incrementVersion('1.99.99', 'major')).toBe('2.0.0')
    })

    it('應該預設為 patch 版本遞增', () => {
      expect(versionManager.incrementVersion('1.0.0')).toBe('1.0.1')
    })

    it('應該處理無效版本號', () => {
      expect(versionManager.incrementVersion('invalid')).toBe('1.0.0')
      expect(versionManager.incrementVersion('')).toBe('1.0.0')
    })
  })

  describe('版本比較', () => {
    it('應該正確比較版本號', () => {
      expect(versionManager.compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(versionManager.compareVersions('1.0.1', '1.0.0')).toBe(1)
      expect(versionManager.compareVersions('1.0.0', '1.0.1')).toBe(-1)
      expect(versionManager.compareVersions('1.1.0', '1.0.99')).toBe(1)
      expect(versionManager.compareVersions('2.0.0', '1.99.99')).toBe(1)
    })

    it('應該處理無效版本號比較', () => {
      expect(versionManager.compareVersions('invalid', '1.0.0')).toBe(0)
      expect(versionManager.compareVersions('1.0.0', 'invalid')).toBe(0)
    })
  })

  describe('版本格式驗證', () => {
    it('應該驗證有效的版本號格式', () => {
      expect(versionManager.isValidVersion('1.0.0')).toBe(true)
      expect(versionManager.isValidVersion('0.0.1')).toBe(true)
      expect(versionManager.isValidVersion('99.99.999')).toBe(true)
    })

    it('應該拒絕無效的版本號格式', () => {
      expect(versionManager.isValidVersion('1.0')).toBe(false)
      expect(versionManager.isValidVersion('1.0.0.0')).toBe(false)
      expect(versionManager.isValidVersion('v1.0.0')).toBe(false)
      expect(versionManager.isValidVersion('1.0.0-beta')).toBe(false)
      expect(versionManager.isValidVersion('invalid')).toBe(false)
    })
  })

  describe('批量操作', () => {
    it('應該批量更新多個快取版本', async () => {
      mockRedisClient.get.mockResolvedValue('1.0.0')
      mockRedisClient.set.mockResolvedValue('OK')

      const cacheKeys = ['key1', 'key2', 'key3']
      const results = await versionManager.batchUpdateVersions(cacheKeys, 'minor')

      expect(results.key1.new_version).toBe('1.1.0')
      expect(results.key2.new_version).toBe('1.1.0')
      expect(results.key3.new_version).toBe('1.1.0')
      expect(mockRedisClient.set).toHaveBeenCalledTimes(3)
    })

    it('應該處理批量更新中的錯誤', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'))

      const cacheKeys = ['key1']
      await expect(versionManager.batchUpdateVersions(cacheKeys, 'patch', true)).rejects.toThrow()
    })
  })

  describe('快取狀態檢查', () => {
    it('應該檢查快取是否過時', async () => {
      mockRedisClient.get.mockResolvedValue('2.0.0')

      const isStale = await versionManager.isCacheStale('test:key', '1.0.0')
      expect(isStale).toBe(true)

      const isNotStale = await versionManager.isCacheStale('test:key', '2.0.0')
      expect(isNotStale).toBe(false)
    })

    it('應該處理快取狀態檢查錯誤', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'))

      const isStale = await versionManager.isCacheStale('test:key', '1.0.0', false)
      expect(isStale).toBe(true) // 預設為過時

      // 測試拋出錯誤的情況
      await expect(versionManager.isCacheStale('test:key', '1.0.0', true)).rejects.toThrow()
    })
  })

  describe('版本統計', () => {
    it('應該取得版本統計資訊', async () => {
      mockRedisClient.keys.mockResolvedValue(['cache_version:key1', 'cache_version:key2'])
      mockRedisClient.get.mockResolvedValueOnce('1.0.0').mockResolvedValueOnce('1.1.0')

      const stats = await versionManager.getVersionStats()

      expect(stats.total_cache_keys).toBe(2)
      expect(stats.version_distribution['1.0.0']).toHaveLength(1)
      expect(stats.version_distribution['1.1.0']).toHaveLength(1)
    })

    it('應該處理版本統計錯誤', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'))

      const stats = await versionManager.getVersionStats()

      expect(stats.total_cache_keys).toBe(0)
      expect(stats.version_distribution).toEqual({})
    })
  })

  describe('錯誤處理', () => {
    it('應該處理 Redis 連線錯誤', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection failed'))

      const version = await versionManager.getVersion('test:key')
      expect(version).toBe('1.0.0') // 返回預設版本
    })

    it('應該處理更新版本時的錯誤', async () => {
      // 測試拋出錯誤的情況
      mockRedisClient.get.mockRejectedValue(new Error('Connection failed'))
      mockRedisClient.set.mockRejectedValue(new Error('Connection failed'))
      await expect(versionManager.updateVersion('test:key', null, true)).rejects.toThrow()

      // 測試不拋出錯誤的情況 - 需要重置 mock
      vi.clearAllMocks()
      mockRedisClient.get.mockRejectedValue(new Error('Connection failed'))
      mockRedisClient.set.mockRejectedValue(new Error('Connection failed'))
      const result = await versionManager.updateVersion('test:key', null, false)
      expect(result).toBe('1.0.0')
    })
  })
})
