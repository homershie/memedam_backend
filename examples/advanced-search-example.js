/**
 * 進階搜尋系統使用範例
 * 展示如何使用新的搜尋功能
 */

import express from 'express'
import {
  advancedFuzzySearch,
  processAdvancedSearchResults,
  getSearchStats,
} from '../utils/advancedSearch.js'

const app = express()
app.use(express.json())

// 模擬迷因資料
const mockMemes = [
  {
    _id: '1',
    title: '有趣的迷因',
    content: '這是一個很有趣的迷因，大家都喜歡',
    tags_cache: ['有趣', '迷因', '搞笑'],
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
    content: '這是一個非常熱門的迷因，很多人分享',
    tags_cache: ['熱門', '迷因', '流行'],
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
    content: '這是最新的迷因，剛剛發布',
    tags_cache: ['最新', '迷因', '新鮮'],
    author: { username: 'user3', display_name: '用戶3', meme_count: 25 },
    views: 500,
    likes: 50,
    shares: 10,
    comments: 5,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
]

// 範例 1: 基本搜尋
app.get('/search/basic', (req, res) => {
  const { q = '迷因' } = req.query

  console.log('🔍 基本搜尋:', q)

  const results = advancedFuzzySearch(mockMemes, q)

  res.json({
    query: q,
    results: results.map((item) => ({
      id: item._id,
      title: item.title,
      relevanceScore: item.relevanceScore,
      qualityScore: item.qualityScore,
      freshnessScore: item.freshnessScore,
      comprehensiveScore: item.comprehensiveScore,
    })),
  })
})

// 範例 2: 進階搜尋與排序
app.get('/search/advanced', (req, res) => {
  const { q = '迷因', sort = 'comprehensive', page = 1, limit = 10 } = req.query

  console.log('🔍 進階搜尋:', { q, sort, page, limit })

  const searchResults = advancedFuzzySearch(mockMemes, q)
  const processed = processAdvancedSearchResults(searchResults, { page, limit }, sort)
  const stats = getSearchStats(searchResults)

  res.json({
    query: q,
    sort,
    ...processed,
    stats,
  })
})

// 範例 3: 不同排序方式比較
app.get('/search/compare-sorts', (req, res) => {
  const { q = '迷因' } = req.query

  console.log('🔍 排序方式比較:', q)

  const searchResults = advancedFuzzySearch(mockMemes, q)
  const sortMethods = ['comprehensive', 'relevance', 'quality', 'freshness', 'popularity']

  const comparisons = sortMethods.map((sort) => {
    const processed = processAdvancedSearchResults(searchResults, { page: 1, limit: 5 }, sort)
    return {
      sort,
      topResults: processed.results.map((item) => ({
        id: item._id,
        title: item.title,
        comprehensiveScore: item.comprehensiveScore,
      })),
    }
  })

  res.json({
    query: q,
    comparisons,
  })
})

// 範例 4: 搜尋統計分析
app.get('/search/stats', (req, res) => {
  const { q = '迷因' } = req.query

  console.log('📊 搜尋統計分析:', q)

  const searchResults = advancedFuzzySearch(mockMemes, q)
  const stats = getSearchStats(searchResults)

  // 詳細分析
  const analysis = {
    query: q,
    totalResults: stats.totalResults,
    averageScores: stats.averageScores,
    scoreDistribution: stats.scoreDistribution,
    topResults: searchResults.slice(0, 3).map((item) => ({
      id: item._id,
      title: item.title,
      scores: {
        relevance: item.relevanceScore,
        quality: item.qualityScore,
        freshness: item.freshnessScore,
        comprehensive: item.comprehensiveScore,
      },
    })),
  }

  res.json(analysis)
})

// 範例 5: 實時搜尋建議
app.get('/search/suggestions', (req, res) => {
  const { q = '' } = req.query

  console.log('💡 搜尋建議:', q)

  if (!q.trim()) {
    // 無搜尋詞時返回熱門建議
    const suggestions = mockMemes
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .map((item) => ({
        type: 'popular',
        title: item.title,
        views: item.views,
      }))

    return res.json({ suggestions })
  }

  // 有搜尋詞時返回相關建議
  const results = advancedFuzzySearch(mockMemes, q)
  const suggestions = results.slice(0, 5).map((item) => ({
    type: 'relevant',
    title: item.title,
    relevanceScore: item.relevanceScore,
    matchType: item.searchMatches?.[0]?.key || 'title',
  }))

  res.json({ suggestions })
})

// 範例 6: 效能測試
app.get('/search/performance', async (req, res) => {
  const { q = '迷因', iterations = 100 } = req.query

  console.log('⚡ 效能測試:', { q, iterations })

  const startTime = Date.now()

  // 執行多次搜尋來測試效能
  for (let i = 0; i < iterations; i++) {
    advancedFuzzySearch(mockMemes, q)
  }

  const endTime = Date.now()
  const totalTime = endTime - startTime
  const avgTime = totalTime / iterations

  res.json({
    query: q,
    iterations: parseInt(iterations),
    totalTime: `${totalTime}ms`,
    averageTime: `${avgTime.toFixed(2)}ms`,
    performance: avgTime < 10 ? 'excellent' : avgTime < 50 ? 'good' : 'needs_optimization',
  })
})

// 啟動伺服器
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 進階搜尋範例伺服器運行在 http://localhost:${PORT}`)
  console.log('\n📝 可用的端點:')
  console.log('  GET /search/basic?q=迷因')
  console.log('  GET /search/advanced?q=迷因&sort=comprehensive')
  console.log('  GET /search/compare-sorts?q=迷因')
  console.log('  GET /search/stats?q=迷因')
  console.log('  GET /search/suggestions?q=迷因')
  console.log('  GET /search/performance?q=迷因&iterations=100')
})

export default app
