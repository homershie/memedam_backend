import apiService from './apiService'

export default {
  // 搜尋來源
  search(query, limit = 10) {
    return apiService.http.get('/api/sources/search', {
      params: { q: query, limit }
    })
  },

  // 創建新來源
  create(sourceData) {
    return apiService.httpAuth.post('/api/sources', sourceData)
  },

  // 獲取來源的場景
  getScenes(sourceId, query = '', page = 1) {
    return apiService.http.get(`/api/sources/${sourceId}/scenes`, {
      params: { query, page }
    })
  },

  // 檢查 slug 是否可用
  checkSlugAvailable(slug) {
    return apiService.http.get('/api/sources/slug-available', {
      params: { slug }
    })
  }
}