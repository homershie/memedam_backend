/**
 * 版本控制快取整合測試
 * 測試版本控制在推薦系統中的實際應用
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheVersionManager } from '../../../utils/cacheVersionManager.js'

// Mock Redis 客戶端
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
}

// Mock 推薦系統依賴
vi.mock('../../../utils/mixedRecommendation.js', () => ({
  generateMixedRecommendations: vi.fn(),
}))

describe('Versioned Cache Integration', () => {
  let versionManager

  beforeEach(() => {
    vi.clearAllMocks()
    versionManager = new CacheVersionManager(mockRedisClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('推薦快取版本控制', () => {
    it('應該在快取命中時驗證版本', async () => {
      const cacheKey = 'mixed_recommendations:user123:30:{}:{}'
      const currentVersion = '2.1.0'

      // Mock Redis 返回帶版本的快取數據
      const cachedData = {
        data: { recommendations: [{ id: 'meme1' }] },
        version: currentVersion,
        timestamp: Date.now(),
      }

      // 設定 mock 調用順序：
      // 1. 版本管理器獲取版本號
      // 2. 直接獲取快取數據
      mockRedisClient.get
        .mockResolvedValueOnce(currentVersion) // 版本號
        .mockResolvedValueOnce(JSON.stringify(cachedData)) // 快取數據

      // 模擬版本控制快取處理器
      const cacheResult = await simulateVersionedCacheProcess(cacheKey, versionManager)

      expect(cacheResult.fromCache).toBe(true)
      expect(cacheResult.version).toBe(currentVersion)
      expect(mockRedisClient.get).toHaveBeenCalledWith(cacheKey)
    })

    it('應該在版本不匹配時重新計算數據', async () => {
      const cacheKey = 'mixed_recommendations:user123:30:{}:{}'
      const cacheVersion = '1.0.0'
      const currentVersion = '2.0.0'

      // Mock Redis 返回舊版本的快取數據
      const cachedData = {
        data: { recommendations: [{ id: 'old_meme' }] },
        version: cacheVersion,
        timestamp: Date.now(),
      }

      // 設定 mock 調用順序：
      // 1. 版本管理器獲取版本號（當前版本）
      // 2. 直接獲取快取數據（舊版本數據）
      mockRedisClient.get
        .mockResolvedValueOnce(currentVersion) // 當前版本
        .mockResolvedValueOnce(JSON.stringify(cachedData)) // 舊快取數據

      // Mock Redis set 操作
      mockRedisClient.set.mockResolvedValue('OK')

      // Mock 重新計算的數據
      const newData = { recommendations: [{ id: 'new_meme' }] }

      const cacheResult = await simulateVersionedCacheProcess(cacheKey, versionManager, () =>
        Promise.resolve(newData),
      )

      expect(cacheResult.fromCache).toBe(false)
      expect(cacheResult.version).toBe(currentVersion)
      expect(mockRedisClient.set).toHaveBeenCalled()
    })

    it('應該處理快取失效並更新版本', async () => {
      const cacheKey = 'hot_recommendations:20:7:[]'
      const currentVersion = '1.0.0'

      mockRedisClient.get
        .mockResolvedValueOnce(null) // 快取不存在
        .mockResolvedValueOnce(currentVersion) // 版本號

      mockRedisClient.set.mockResolvedValue('OK')

      const newVersion = await versionManager.updateVersion(cacheKey, 'patch')

      expect(newVersion).toBe('1.0.1')
      expect(mockRedisClient.set).toHaveBeenCalledWith(`cache_version:${cacheKey}`, '1.0.1')
    })
  })

  describe('分析監控版本控制', () => {
    it('應該為分析統計維護版本', async () => {
      const statsKey = 'analytics:realtime_stats'
      const statsData = {
        total_recommendations: 100,
        total_clicks: 25,
        ctr: 0.25,
      }

      mockRedisClient.get.mockResolvedValue('1.0.0')
      mockRedisClient.set.mockResolvedValue('OK')

      // 模擬統計數據更新
      const versionedData = {
        data: statsData,
        version: '1.0.0',
        timestamp: Date.now(),
      }

      await mockRedisClient.set(statsKey, JSON.stringify(versionedData), 300)

      // 更新版本
      const newVersion = await versionManager.updateVersion(statsKey)

      expect(newVersion).toBe('1.0.1')
    })

    it('應該批量更新多個分析快取版本', async () => {
      const cacheKeys = [
        'analytics:realtime_stats',
        'analytics:daily_stats',
        'analytics:algorithm_comparison',
      ]

      mockRedisClient.get.mockResolvedValue('1.0.0')
      mockRedisClient.set.mockResolvedValue('OK')
      mockRedisClient.del.mockResolvedValue(1)

      const results = await versionManager.batchUpdateVersions(cacheKeys, 'minor')

      expect(Object.keys(results)).toHaveLength(3)
      expect(results[cacheKeys[0]].new_version).toBe('1.1.0')
      expect(results[cacheKeys[1]].new_version).toBe('1.1.0')
      expect(results[cacheKeys[2]].new_version).toBe('1.1.0')
    })
  })

  describe('快取一致性', () => {
    it('應該確保版本更新的一致性', async () => {
      const cacheKey = 'user_activity:user123'
      const operations = ['login', 'view_meme', 'like_meme']

      mockRedisClient.get.mockResolvedValue('1.0.0')
      mockRedisClient.set.mockResolvedValue('OK')

      // 模擬一系列操作，每個操作都應該更新版本
      for (const operation of operations) {
        const newVersion = await versionManager.updateVersion(`${cacheKey}:${operation}`)
        expect(newVersion).toMatch(/^\d+\.\d+\.\d+$/)
      }

      // 確保 set 被調用了正確次數
      expect(mockRedisClient.set).toHaveBeenCalledTimes(operations.length)
    })

    it('應該處理並發版本更新', async () => {
      const cacheKey = 'social_scores:user123'

      // Mock 並發讀取
      mockRedisClient.get
        .mockResolvedValueOnce('1.0.0') // 第一個請求讀取
        .mockResolvedValueOnce('1.0.0') // 第二個請求讀取
        .mockResolvedValueOnce('1.0.1') // 第一個請求更新後

      mockRedisClient.set.mockResolvedValue('OK')

      // 模擬兩個並發的版本更新
      const [version1, version2] = await Promise.all([
        versionManager.updateVersion(cacheKey),
        versionManager.updateVersion(cacheKey),
      ])

      // 兩個版本都應該是有效的遞增版本
      expect(version1).toMatch(/^\d+\.\d+\.\d+$/)
      expect(version2).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('錯誤恢復', () => {
    it('應該在 Redis 故障時降級處理', async () => {
      const cacheKey = 'cold_start:user123'

      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'))

      const version = await versionManager.getVersion(cacheKey)

      // 應該返回預設版本
      expect(version).toBe('1.0.0')
    })

    it('應該處理版本號格式錯誤', async () => {
      const cacheKey = 'recommendation_strategy:user123'

      mockRedisClient.get.mockResolvedValue('invalid_version_format')

      const version = await versionManager.getVersion(cacheKey)

      // 應該返回預設版本
      expect(version).toBe('1.0.0')
    })
  })
})

/**
 * 模擬版本控制快取處理過程
 */
async function simulateVersionedCacheProcess(cacheKey, versionManager, fetchFunction = null) {
  try {
    const currentVersion = await versionManager.getVersion(cacheKey)
    const cachedData = await mockRedisClient.get(cacheKey)

    if (cachedData !== null) {
      const parsedData = JSON.parse(cachedData)

      // 檢查版本是否匹配
      if (parsedData.version && parsedData.version === currentVersion) {
        return {
          data: parsedData.data,
          version: parsedData.version,
          fromCache: true,
        }
      }
    }

    // 如果沒有快取或版本不匹配，獲取新數據
    const freshData = fetchFunction ? await fetchFunction() : { recommendations: [] }

    // 儲存帶版本的數據
    const versionedData = {
      data: freshData,
      version: currentVersion,
      timestamp: Date.now(),
    }

    await mockRedisClient.set(cacheKey, JSON.stringify(versionedData), 3600)

    return {
      data: freshData,
      version: currentVersion,
      fromCache: false,
    }
  } catch {
    // 降級處理
    const freshData = fetchFunction ? await fetchFunction() : { recommendations: [] }
    return {
      data: freshData,
      version: '1.0.0',
      fromCache: false,
    }
  }
}
