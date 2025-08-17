import { describe, it, expect } from 'vitest'
import {
  advancedFuzzySearch,
  processAdvancedSearchResults,
  combineAdvancedSearchFilters,
  getSearchStats,
} from '../../../utils/advancedSearch.js'

describe('進階搜尋功能測試', () => {
  // 模擬迷因資料
  const mockMemes = [
    {
      _id: '1',
      title: '有趣的迷因',
      content: '這是一個很有趣的迷因',
      tags_cache: ['有趣', '迷因'],
      author: { username: 'user1', display_name: '用戶1', meme_count: 50 },
      views: 1000,
      likes: 100,
      shares: 20,
      comments: 10,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      _id: '2',
      title: '熱門迷因',
      content: '這是一個非常熱門的迷因',
      tags_cache: ['熱門', '迷因'],
      author: { username: 'user2', display_name: '用戶2', meme_count: 100 },
      views: 5000,
      likes: 500,
      shares: 100,
      comments: 50,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    },
    {
      _id: '3',
      title: '最新迷因',
      content: '這是最新的迷因',
      tags_cache: ['最新', '迷因'],
      author: { username: 'user3', display_name: '用戶3', meme_count: 25 },
      views: 500,
      likes: 50,
      shares: 10,
      comments: 5,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    },
  ]

  describe('advancedFuzzySearch', () => {
    it('應該能進行模糊搜尋並計算綜合分數', () => {
      const results = advancedFuzzySearch(mockMemes, '迷因')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      // 檢查每個結果都有分數
      results.forEach((result) => {
        expect(result).toHaveProperty('relevanceScore')
        expect(result).toHaveProperty('qualityScore')
        expect(result).toHaveProperty('freshnessScore')
        expect(result).toHaveProperty('userBehaviorScore')
        expect(result).toHaveProperty('comprehensiveScore')
        expect(result).toHaveProperty('searchScore')
      })
    })

    it('無搜尋詞時應該按綜合品質排序', () => {
      const results = advancedFuzzySearch(mockMemes, '')

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(mockMemes.length)

      // 檢查是否按綜合分數排序（降序）
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].comprehensiveScore).toBeGreaterThanOrEqual(
          results[i].comprehensiveScore,
        )
      }
    })

    it('應該處理特殊字符和空格', () => {
      const results = advancedFuzzySearch(mockMemes, ' 迷因 ')
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })

    it('應該處理不存在的搜尋詞', () => {
      const results = advancedFuzzySearch(mockMemes, '不存在的詞')
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
  })

  describe('processAdvancedSearchResults', () => {
    it('應該能正確處理分頁和排序', () => {
      const searchResults = advancedFuzzySearch(mockMemes, '迷因')
      const processed = processAdvancedSearchResults(
        searchResults,
        { page: 1, limit: 2 },
        'comprehensive',
      )

      expect(processed).toHaveProperty('results')
      expect(processed).toHaveProperty('pagination')
      expect(processed).toHaveProperty('scoring')

      expect(processed.results.length).toBe(2)
      expect(processed.pagination.page).toBe(1)
      expect(processed.pagination.limit).toBe(2)
      expect(processed.pagination.total).toBe(searchResults.length)
    })

    it('應該處理不同的排序方式', () => {
      const searchResults = advancedFuzzySearch(mockMemes, '迷因')

      const relevanceSorted = processAdvancedSearchResults(
        searchResults,
        { page: 1, limit: 10 },
        'relevance',
      )

      const qualitySorted = processAdvancedSearchResults(
        searchResults,
        { page: 1, limit: 10 },
        'quality',
      )

      expect(relevanceSorted.results).toBeDefined()
      expect(qualitySorted.results).toBeDefined()
    })

    it('應該處理邊界分頁', () => {
      const searchResults = advancedFuzzySearch(mockMemes, '迷因')
      const processed = processAdvancedSearchResults(
        searchResults,
        { page: 999, limit: 10 },
        'comprehensive',
      )

      expect(processed.results.length).toBe(0)
      expect(processed.pagination.page).toBe(999)
    })
  })

  describe('combineAdvancedSearchFilters', () => {
    it('應該能組合多個搜尋條件', () => {
      const filters = {
        tags: ['有趣'],
        dateRange: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
        minViews: 100,
        maxViews: 2000,
      }

      const combined = combineAdvancedSearchFilters(filters)
      expect(combined).toBeDefined()
      expect(typeof combined).toBe('function')
    })

    it('應該處理空的過濾條件', () => {
      const filters = {}
      const combined = combineAdvancedSearchFilters(filters)
      expect(combined).toBeDefined()
    })
  })

  describe('getSearchStats', () => {
    it('應該能計算搜尋統計資訊', () => {
      const searchResults = advancedFuzzySearch(mockMemes, '迷因')
      const stats = getSearchStats(searchResults)

      expect(stats).toHaveProperty('totalResults')
      expect(stats).toHaveProperty('avgScore')
      expect(stats).toHaveProperty('scoreDistribution')
      expect(stats).toHaveProperty('tagFrequency')
    })

    it('應該處理空結果的統計', () => {
      const emptyResults = []
      const stats = getSearchStats(emptyResults)

      expect(stats.totalResults).toBe(0)
      expect(stats.avgScore).toBe(0)
    })
  })

  describe('搜尋品質評估', () => {
    it('應該根據多個因素計算品質分數', () => {
      const results = advancedFuzzySearch(mockMemes, '迷因')

      results.forEach((result) => {
        expect(result.qualityScore).toBeGreaterThanOrEqual(0)
        expect(result.qualityScore).toBeLessThanOrEqual(1)
      })
    })

    it('應該計算新鮮度分數', () => {
      const results = advancedFuzzySearch(mockMemes, '迷因')

      results.forEach((result) => {
        expect(result.freshnessScore).toBeGreaterThanOrEqual(0)
        expect(result.freshnessScore).toBeLessThanOrEqual(1)
      })
    })

    it('應該計算用戶行為分數', () => {
      const results = advancedFuzzySearch(mockMemes, '迷因')

      results.forEach((result) => {
        expect(result.userBehaviorScore).toBeGreaterThanOrEqual(0)
        expect(result.userBehaviorScore).toBeLessThanOrEqual(1)
      })
    })
  })
})
