import Fuse from 'fuse.js'

// Fuse.js 搜尋配置
const fuseOptions = {
  // 搜尋欄位配置
  keys: [
    {
      name: 'title',
      weight: 0.8, // 標題權重最高
    },
    {
      name: 'content',
      weight: 0.6, // 內容權重中等
    },
    {
      name: 'detail_markdown',
      weight: 0.4, // 詳細內容權重較低
    },
    {
      name: 'tags_cache',
      weight: 0.7, // 標籤權重較高
    },
    {
      name: 'display_name',
      weight: 0.1,
    },
    {
      name: 'username',
      weight: 0.05,
    },
  ],
  // 搜尋選項
  includeScore: true, // 包含分數
  includeMatches: true, // 包含匹配資訊
  threshold: 0.3, // 相似度閾值（0.0 = 完全匹配，1.0 = 完全不匹配）
  minMatchCharLength: 2, // 最小匹配字元長度
  // 進階選項
  useExtendedSearch: true, // 啟用擴展搜尋語法
  ignoreLocation: true, // 忽略位置影響
  findAllMatches: true, // 找到所有匹配
  // 距離設定
  distance: 100, // 編輯距離
  // 大小寫敏感
  isCaseSensitive: false,
}

/**
 * 使用 Fuse.js 進行模糊搜尋
 * @param {Array} data - 要搜尋的資料陣列
 * @param {string} searchTerm - 搜尋關鍵字
 * @param {Object} options - 額外選項
 * @returns {Array} 搜尋結果
 */
export const fuzzySearch = (data, searchTerm, options = {}) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return data
  }

  // 合併預設選項和自訂選項
  const searchOptions = {
    ...fuseOptions,
    ...options,
  }

  const fuse = new Fuse(data, searchOptions)
  const results = fuse.search(searchTerm)

  // 轉換結果格式
  return results.map((result) => ({
    ...result.item,
    searchScore: result.score,
    searchMatches: result.matches,
  }))
}

/**
 * 建立搜尋索引（用於大量資料的預處理）
 * @param {Array} data - 要建立索引的資料
 * @param {Object} options - Fuse.js 選項
 * @returns {Fuse} Fuse 實例
 */
export const createSearchIndex = (data, options = {}) => {
  const searchOptions = {
    ...fuseOptions,
    ...options,
  }
  return new Fuse(data, searchOptions)
}

/**
 * 處理搜尋結果的排序和分頁
 * @param {Array} results - 搜尋結果
 * @param {Object} pagination - 分頁參數
 * @returns {Object} 處理後的結果
 */
export const processSearchResults = (results, pagination = {}) => {
  const { page = 1, limit = 50 } = pagination
  const skip = (parseInt(page) - 1) * parseInt(limit)
  const limitNum = parseInt(limit)

  // 按搜尋分數排序（分數越低越相關）
  // 如果有搜尋分數，按分數排序；否則保持原有順序
  const sortedResults = results.sort((a, b) => {
    if (a.searchScore !== undefined && b.searchScore !== undefined) {
      return a.searchScore - b.searchScore
    }
    // 如果沒有搜尋分數，保持原有順序（通常是按創建時間排序）
    return 0
  })

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
  }
}

/**
 * 組合多個搜尋條件
 * @param {Array} data - 原始資料
 * @param {Object} searchParams - 搜尋參數
 * @returns {Array} 過濾後的資料
 */
export const combineSearchFilters = (data, searchParams) => {
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

  // 模糊搜尋
  if (searchParams.search) {
    filteredData = fuzzySearch(filteredData, searchParams.search)
  }

  return filteredData
}
