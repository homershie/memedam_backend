// Scene 相關 API 服務
const API_BASE = '/api'

const sceneService = {
  // 創建新場景
  async create(sceneData) {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(sceneData)
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || '創建場景失敗')
      }
      return data
    } catch (error) {
      console.error('創建場景失敗:', error)
      throw error
    }
  },

  // 搜尋場景
  async search(query, sourceId = null) {
    try {
      const params = new URLSearchParams()
      params.append('q', query)
      if (sourceId) params.append('source_id', sourceId)
      
      const response = await fetch(`${API_BASE}/scenes/search?${params}`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error('搜尋場景失敗:', error)
      throw error
    }
  }
}

export default sceneService