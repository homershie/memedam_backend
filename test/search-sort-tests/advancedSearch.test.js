import { expect } from 'chai'
import {
  advancedFuzzySearch,
  processAdvancedSearchResults,
  combineAdvancedSearchFilters,
  getSearchStats,
} from '../utils/advancedSearch.js'

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

      expect(results).to.be.an('array')
      expect(results.length).to.be.greaterThan(0)

      // 檢查每個結果都有分數
      results.forEach((result) => {
        expect(result).to.have.property('relevanceScore')
        expect(result).to.have.property('qualityScore')
        expect(result).to.have.property('freshnessScore')
        expect(result).to.have.property('userBehaviorScore')
        expect(result).to.have.property('comprehensiveScore')
        expect(result).to.have.property('searchScore')
      })
    })

    it('無搜尋詞時應該按綜合品質排序', () => {
      const results = advancedFuzzySearch(mockMemes, '')

      expect(results).to.be.an('array')
      expect(results.length).to.equal(mockMemes.length)

      // 檢查是否按綜合分數排序（降序）
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].comprehensiveScore).to.be.at.least(results[i].comprehensiveScore)
      }
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

      expect(processed).to.have.property('results')
      expect(processed).to.have.property('pagination')
      expect(processed).to.have.property('scoring')

      expect(processed.results.length).to.equal(2)
      expect(processed.pagination.page).to.equal(1)
      expect(processed.pagination.limit).to.equal(2)
      expect(processed.pagination.total).to.equal(searchResults.length)
    })

    it('應該支援不同的排序方式', () => {
      const searchResults = advancedFuzzySearch(mockMemes, '迷因')

      // 測試綜合排序
      const comprehensiveResults = processAdvancedSearchResults(
        searchResults,
        { page: 1, limit: 10 },
        'comprehensive',
      )
      expect(comprehensiveResults.results[0].comprehensiveScore).to.be.at.least(
        comprehensiveResults.results[1].comprehensiveScore,
      )

      // 測試品質排序
      const qualityResults = processAdvancedSearchResults(
        searchResults,
        { page: 1, limit: 10 },
        'quality',
      )
      expect(qualityResults.results[0].qualityScore).to.be.at.least(
        qualityResults.results[1].qualityScore,
      )

      // 測試時效性排序
      const freshnessResults = processAdvancedSearchResults(
        searchResults,
        { page: 1, limit: 10 },
        'freshness',
      )
      expect(freshnessResults.results[0].freshnessScore).to.be.at.least(
        freshnessResults.results[1].freshnessScore,
      )
    })
  })

  describe('combineAdvancedSearchFilters', () => {
    it('應該能正確過濾標籤', () => {
      const searchParams = {
        tags: ['有趣'],
        search: '迷因',
      }

      const filtered = combineAdvancedSearchFilters(mockMemes, searchParams)

      expect(filtered).to.be.an('array')
      filtered.forEach((item) => {
        expect(item.tags_cache).to.include('有趣')
      })
    })

    it('應該能正確過濾作者', () => {
      const searchParams = {
        author: 'user1',
        search: '迷因',
      }

      const filtered = combineAdvancedSearchFilters(mockMemes, searchParams)

      expect(filtered).to.be.an('array')
      filtered.forEach((item) => {
        expect(item.author.username).to.equal('user1')
      })
    })

    it('應該能正確過濾時間範圍', () => {
      const searchParams = {
        dateFrom: '2024-01-10',
        dateTo: '2024-01-20',
        search: '迷因',
      }

      const filtered = combineAdvancedSearchFilters(mockMemes, searchParams)

      expect(filtered).to.be.an('array')
      filtered.forEach((item) => {
        const createdAt = new Date(item.createdAt)
        const dateFrom = new Date('2024-01-10')
        const dateTo = new Date('2024-01-20')
        expect(createdAt).to.be.at.least(dateFrom)
        expect(createdAt).to.be.at.most(dateTo)
      })
    })
  })

  describe('getSearchStats', () => {
    it('應該能計算搜尋統計資訊', () => {
      const searchResults = advancedFuzzySearch(mockMemes, '迷因')
      const stats = getSearchStats(searchResults)

      expect(stats).to.have.property('totalResults')
      expect(stats).to.have.property('averageScores')
      expect(stats).to.have.property('scoreDistribution')

      expect(stats.totalResults).to.equal(searchResults.length)
      expect(stats.averageScores).to.have.property('relevance')
      expect(stats.averageScores).to.have.property('quality')
      expect(stats.averageScores).to.have.property('freshness')
      expect(stats.averageScores).to.have.property('userBehavior')
      expect(stats.averageScores).to.have.property('comprehensive')

      expect(stats.scoreDistribution).to.have.property('high')
      expect(stats.scoreDistribution).to.have.property('medium')
      expect(stats.scoreDistribution).to.have.property('low')
    })

    it('空結果時應該返回預設統計', () => {
      const stats = getSearchStats([])

      expect(stats.totalResults).to.equal(0)
      expect(stats.averageScores).to.be.an('object')
      expect(stats.scoreDistribution).to.be.an('object')
    })
  })

  describe('分數計算邏輯', () => {
    it('品質分數應該基於互動數據', () => {
      const highQualityMeme = {
        ...mockMemes[1], // 使用高互動的迷因
        views: 10000,
        likes: 1000,
        shares: 500,
        comments: 100,
      }

      const lowQualityMeme = {
        ...mockMemes[0], // 使用低互動的迷因
        views: 100,
        likes: 10,
        shares: 2,
        comments: 1,
      }

      const highQualityResults = advancedFuzzySearch([highQualityMeme], '迷因')
      const lowQualityResults = advancedFuzzySearch([lowQualityMeme], '迷因')

      expect(highQualityResults[0].qualityScore).to.be.greaterThan(
        lowQualityResults[0].qualityScore,
      )
    })

    it('時效性分數應該基於創建時間', () => {
      const recentMeme = {
        ...mockMemes[2],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const oldMeme = {
        ...mockMemes[0],
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
      }

      const recentResults = advancedFuzzySearch([recentMeme], '迷因')
      const oldResults = advancedFuzzySearch([oldMeme], '迷因')

      expect(recentResults[0].freshnessScore).to.be.greaterThan(oldResults[0].freshnessScore)
    })
  })
})
