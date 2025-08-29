// Source 相關 API 服務
const API_BASE = '/api'

const sourceService = {
  // 搜尋來源
  async search(query, limit = 10) {
    try {
      const response = await fetch(`${API_BASE}/sources/search?q=${encodeURIComponent(query)}&limit=${limit}`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error('搜尋來源失敗:', error)
      throw error
    }
  },

  // 創建新來源
  async create(sourceData) {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(sourceData)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || '創建來源失敗')
      }
      return data
    } catch (error) {
      console.error('創建來源失敗:', error)
      throw error
    }
  },

  // 獲取來源的場景
  async getScenes(sourceId, query = '', page = 1) {
    try {
      const params = new URLSearchParams()
      if (query) params.append('query', query)
      params.append('page', page)
      
      const response = await fetch(`${API_BASE}/sources/${sourceId}/scenes?${params}`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error('獲取場景失敗:', error)
      throw error
    }
  },

  // 檢查 slug 是否可用
  async checkSlugAvailable(slug) {
    try {
      const response = await fetch(`${API_BASE}/sources/slug-available?slug=${encodeURIComponent(slug)}`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error('檢查 slug 失敗:', error)
      throw error
    }
  }
}

export default sourceService