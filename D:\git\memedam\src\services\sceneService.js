import apiService from './apiService'

export default {
  // 創建新場景
  create(sceneData) {
    return apiService.httpAuth.post('/api/scenes', sceneData)
  },

  // 搜尋場景
  search(query, sourceId = null) {
    const params = { q: query }
    if (sourceId) params.source_id = sourceId
    
    return apiService.http.get('/api/scenes/search', { params })
  }
}