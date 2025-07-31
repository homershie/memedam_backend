import Fuse from 'fuse.js'

/**
 * 進階搜尋配置 - 結合 Google 搜尋理念
 */
const advancedSearchConfig = {
  // Fuse.js 基礎配置
  fuse: {
    keys: [
      { name: 'title', weight: 0.8 }, // 標題權重最高
      { name: 'content', weight: 0.6 }, // 內容權重中等
      { name: 'detail_markdown', weight: 0.4 }, // 詳細內容
      { name: 'tags_cache', weight: 0.7 }, // 標籤權重較高
      { name: 'display_name', weight: 0.1 }, // 作者顯示名稱
      { name: 'username', weight: 0.05 }, // 作者用戶名
    ],
    includeScore: true,
    includeMatches: true,
    threshold: 0.3,
    minMatchCharLength: 2,
    useExtendedSearch: true,
    ignoreLocation: true,
    findAllMatches: true,
    distance: 100,
    isCaseSensitive: false,
  },

  // 評分權重配置
  scoring: {
    relevance: 0.4, // 相關性 40%
    quality: 0.3, // 品質 30%
    freshness: 0.2, // 時效性 20%
    userBehavior: 0.1, // 用戶行為 10%
  },

  // 品質評分配置
  quality: {
    viewWeight: 0.2, // 瀏覽數權重
    likeWeight: 0.3, // 讚數權重
    shareWeight: 0.2, // 分享數權重
    commentWeight: 0.1, // 評論數權重
    authorReputationWeight: 0.2, // 作者聲望權重
  },

  // 時效性配置
  freshness: {
    createdAtWeight: 0.4, // 創建時間權重
    lastUpdatedWeight: 0.3, // 最後更新權重
    trendingPeriodWeight: 0.3, // 趨勢週期權重
    decayFactor: 0.1, // 時間衰減因子
  },

  // 用戶行為配置
  userBehavior: {
    clickThroughRateWeight: 0.3, // 點擊率權重
    averageViewTimeWeight: 0.3, // 平均觀看時間權重
    engagementRateWeight: 0.4, // 互動率權重
  },
}

/**
 * 計算相關性分數
 * @param {Object} item - 迷因項目
 * @param {number} searchScore - Fuse.js 搜尋分數
 * @param {string} searchTerm - 搜尋關鍵字
 * @returns {number} 相關性分數 (0-1)
 */
const calculateRelevanceScore = (item, searchScore, searchTerm) => {
  if (!searchTerm) return 0.5 // 無搜尋詞時給中等分數

  // 將 Fuse.js 分數轉換為 0-1 範圍（分數越低越相關）
  const normalizedScore = Math.max(0, 1 - (searchScore || 0))

  // 標題匹配加分
  const titleMatch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ? 0.2 : 0

  // 標籤匹配加分
  const tagMatch = item.tags_cache?.some((tag) =>
    tag.toLowerCase().includes(searchTerm.toLowerCase()),
  )
    ? 0.15
    : 0

  // 作者匹配加分
  const authorMatch =
    item.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.username?.toLowerCase().includes(searchTerm.toLowerCase())
      ? 0.1
      : 0

  return Math.min(1, normalizedScore + titleMatch + tagMatch + authorMatch)
}

/**
 * 計算品質分數
 * @param {Object} item - 迷因項目
 * @returns {number} 品質分數 (0-1)
 */
const calculateQualityScore = (item) => {
  const config = advancedSearchConfig.quality

  // 標準化各項指標
  const views = Math.min(1, (item.views || 0) / 10000) // 標準化到 10000 次瀏覽
  const likes = Math.min(1, (item.likes || 0) / 1000) // 標準化到 1000 個讚
  const shares = Math.min(1, (item.shares || 0) / 500) // 標準化到 500 次分享
  const comments = Math.min(1, (item.comments || 0) / 100) // 標準化到 100 條評論

  // 作者聲望（基於作者的其他迷因平均品質）
  const authorReputation = Math.min(1, (item.author?.meme_count || 0) / 100)

  // 計算加權品質分數
  const qualityScore =
    views * config.viewWeight +
    likes * config.likeWeight +
    shares * config.shareWeight +
    comments * config.commentWeight +
    authorReputation * config.authorReputationWeight

  return Math.min(1, qualityScore)
}

/**
 * 計算時效性分數
 * @param {Object} item - 迷因項目
 * @returns {number} 時效性分數 (0-1)
 */
const calculateFreshnessScore = (item) => {
  const config = advancedSearchConfig.freshness
  const now = new Date()

  // 創建時間分數
  const createdAt = new Date(item.createdAt)
  const createdAtAge = (now - createdAt) / (1000 * 60 * 60 * 24) // 天數
  const createdAtScore = Math.max(0, 1 - createdAtAge * config.decayFactor)

  // 更新時間分數
  const updatedAt = new Date(item.updatedAt || item.createdAt)
  const updatedAtAge = (now - updatedAt) / (1000 * 60 * 60 * 24)
  const updatedAtScore = Math.max(0, 1 - updatedAtAge * config.decayFactor)

  // 趨勢週期分數（基於最近活動）
  const trendingScore = Math.min(1, (item.views || 0) / 1000) // 簡化的趨勢計算

  return (
    createdAtScore * config.createdAtWeight +
    updatedAtScore * config.lastUpdatedWeight +
    trendingScore * config.trendingPeriodWeight
  )
}

/**
 * 計算用戶行為分數
 * @param {Object} item - 迷因項目
 * @returns {number} 用戶行為分數 (0-1)
 */
const calculateUserBehaviorScore = (item) => {
  const config = advancedSearchConfig.userBehavior

  // 點擊率（簡化計算）
  const clickThroughRate = Math.min(1, (item.views || 0) / 1000)

  // 平均觀看時間（假設數據）
  const averageViewTime = Math.min(1, (item.avg_view_time || 30) / 120) // 標準化到 2 分鐘

  // 互動率
  const totalInteractions = (item.likes || 0) + (item.shares || 0) + (item.comments || 0)
  const engagementRate = Math.min(1, totalInteractions / (item.views || 1))

  return (
    clickThroughRate * config.clickThroughRateWeight +
    averageViewTime * config.averageViewTimeWeight +
    engagementRate * config.engagementRateWeight
  )
}

/**
 * 計算綜合搜尋分數
 * @param {Object} item - 迷因項目
 * @param {number} searchScore - Fuse.js 搜尋分數
 * @param {string} searchTerm - 搜尋關鍵字
 * @returns {number} 綜合分數 (0-1)
 */
const calculateComprehensiveScore = (item, searchScore, searchTerm) => {
  const config = advancedSearchConfig.scoring

  const relevanceScore = calculateRelevanceScore(item, searchScore, searchTerm)
  const qualityScore = calculateQualityScore(item)
  const freshnessScore = calculateFreshnessScore(item)
  const userBehaviorScore = calculateUserBehaviorScore(item)

  return (
    relevanceScore * config.relevance +
    qualityScore * config.quality +
    freshnessScore * config.freshness +
    userBehaviorScore * config.userBehavior
  )
}

/**
 * 進階模糊搜尋
 * @param {Array} data - 要搜尋的資料陣列
 * @param {string} searchTerm - 搜尋關鍵字
 * @param {Object} options - 額外選項
 * @returns {Array} 搜尋結果
 */
export const advancedFuzzySearch = (data, searchTerm, options = {}) => {
  if (!searchTerm || searchTerm.trim() === '') {
    // 無搜尋詞時，按綜合品質排序
    return data
      .map((item) => ({
        ...item,
        comprehensiveScore: calculateComprehensiveScore(item, null, ''),
        relevanceScore: 0.5,
        qualityScore: calculateQualityScore(item),
        freshnessScore: calculateFreshnessScore(item),
        userBehaviorScore: calculateUserBehaviorScore(item),
      }))
      .sort((a, b) => b.comprehensiveScore - a.comprehensiveScore)
  }

  // 合併配置選項
  const searchOptions = {
    ...advancedSearchConfig.fuse,
    ...options,
  }

  const fuse = new Fuse(data, searchOptions)
  const results = fuse.search(searchTerm)

  // 轉換結果並計算綜合分數
  return results.map((result) => {
    const item = result.item
    const searchScore = result.score

    return {
      ...item,
      searchScore,
      searchMatches: result.matches,
      relevanceScore: calculateRelevanceScore(item, searchScore, searchTerm),
      qualityScore: calculateQualityScore(item),
      freshnessScore: calculateFreshnessScore(item),
      userBehaviorScore: calculateUserBehaviorScore(item),
      comprehensiveScore: calculateComprehensiveScore(item, searchScore, searchTerm),
    }
  })
}

/**
 * 建立進階搜尋索引
 * @param {Array} data - 要建立索引的資料
 * @param {Object} options - Fuse.js 選項
 * @returns {Fuse} Fuse 實例
 */
export const createAdvancedSearchIndex = (data, options = {}) => {
  const searchOptions = {
    ...advancedSearchConfig.fuse,
    ...options,
  }
  return new Fuse(data, searchOptions)
}

/**
 * 處理進階搜尋結果的排序和分頁
 * @param {Array} results - 搜尋結果
 * @param {Object} pagination - 分頁參數
 * @param {string} sortBy - 排序方式
 * @returns {Object} 處理後的結果
 */
export const processAdvancedSearchResults = (
  results,
  pagination = {},
  sortBy = 'comprehensive',
) => {
  const { page = 1, limit = 50 } = pagination
  const skip = (parseInt(page) - 1) * parseInt(limit)
  const limitNum = parseInt(limit)

  // 根據排序方式排序
  let sortedResults = [...results]
  switch (sortBy) {
    case 'relevance':
      sortedResults.sort((a, b) => b.relevanceScore - a.relevanceScore)
      break
    case 'quality':
      sortedResults.sort((a, b) => b.qualityScore - a.qualityScore)
      break
    case 'freshness':
      sortedResults.sort((a, b) => b.freshnessScore - a.freshnessScore)
      break
    case 'popularity':
      sortedResults.sort((a, b) => (b.views || 0) - (a.views || 0))
      break
    case 'createdAt':
      sortedResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      break
    case 'comprehensive':
    default:
      sortedResults.sort((a, b) => b.comprehensiveScore - a.comprehensiveScore)
      break
  }

  // 分頁
  const paginatedResults = sortedResults.slice(skip, skip + limitNum)

  return {
    results: paginatedResults,
    pagination: {
      page: parseInt(page),
      limit: limitNum,
      total: results.length,
      totalPages: Math.ceil(results.length / limitNum),
      hasNext: parseInt(page) < Math.ceil(results.length / limitNum),
      hasPrev: parseInt(page) > 1,
    },
    scoring: {
      relevance: sortedResults[0]?.relevanceScore || 0,
      quality: sortedResults[0]?.qualityScore || 0,
      freshness: sortedResults[0]?.freshnessScore || 0,
      userBehavior: sortedResults[0]?.userBehaviorScore || 0,
      comprehensive: sortedResults[0]?.comprehensiveScore || 0,
    },
  }
}

/**
 * 組合進階搜尋過濾器
 * @param {Array} data - 原始資料
 * @param {Object} searchParams - 搜尋參數
 * @returns {Array} 過濾後的資料
 */
export const combineAdvancedSearchFilters = (data, searchParams) => {
  let filteredData = [...data]

  // 基本篩選條件
  if (searchParams.type) {
    filteredData = filteredData.filter((item) => item.type === searchParams.type)
  }

  if (searchParams.status) {
    filteredData = filteredData.filter((item) => item.status === searchParams.status)
  }

  if (searchParams.tags && searchParams.tags.length > 0) {
    filteredData = filteredData.filter((item) => {
      if (!item.tags_cache || !Array.isArray(item.tags_cache)) return false
      return searchParams.tags.some((tag) => item.tags_cache.includes(tag))
    })
  }

  // 作者篩選
  if (searchParams.author) {
    filteredData = filteredData.filter(
      (item) =>
        item.author_id?.toString() === searchParams.author ||
        item.username?.toLowerCase().includes(searchParams.author.toLowerCase()) ||
        item.display_name?.toLowerCase().includes(searchParams.author.toLowerCase()),
    )
  }

  // 時間範圍篩選
  if (searchParams.dateFrom) {
    const dateFrom = new Date(searchParams.dateFrom)
    filteredData = filteredData.filter((item) => new Date(item.createdAt) >= dateFrom)
  }

  if (searchParams.dateTo) {
    const dateTo = new Date(searchParams.dateTo)
    filteredData = filteredData.filter((item) => new Date(item.createdAt) <= dateTo)
  }

  // 進階模糊搜尋
  if (searchParams.search) {
    filteredData = advancedFuzzySearch(filteredData, searchParams.search)
  }

  return filteredData
}

/**
 * 取得搜尋統計資訊
 * @param {Array} results - 搜尋結果
 * @returns {Object} 統計資訊
 */
export const getSearchStats = (results) => {
  if (results.length === 0) {
    return {
      totalResults: 0,
      averageScores: {},
      scoreDistribution: {},
    }
  }

  const totalResults = results.length

  // 計算平均分數
  const avgScores = results.reduce(
    (acc, item) => {
      acc.relevance += item.relevanceScore || 0
      acc.quality += item.qualityScore || 0
      acc.freshness += item.freshnessScore || 0
      acc.userBehavior += item.userBehaviorScore || 0
      acc.comprehensive += item.comprehensiveScore || 0
      return acc
    },
    { relevance: 0, quality: 0, freshness: 0, userBehavior: 0, comprehensive: 0 },
  )

  Object.keys(avgScores).forEach((key) => {
    avgScores[key] = avgScores[key] / totalResults
  })

  // 分數分佈
  const scoreDistribution = {
    high: results.filter((item) => (item.comprehensiveScore || 0) >= 0.7).length,
    medium: results.filter(
      (item) => (item.comprehensiveScore || 0) >= 0.4 && (item.comprehensiveScore || 0) < 0.7,
    ).length,
    low: results.filter((item) => (item.comprehensiveScore || 0) < 0.4).length,
  }

  return {
    totalResults,
    averageScores: avgScores,
    scoreDistribution,
  }
}
