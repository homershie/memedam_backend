import express from 'express'
import {
  getSourceBundle,
  getSources,
  createSource,
  updateSource,
  deleteSource,
  updateSourceStats,
  searchSourcesAutocomplete,
  getPopularSources,
  checkSlugAvailable,
} from '../controllers/sourceController.js'
import { token, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// 公開路由
router.get('/search/autocomplete', searchSourcesAutocomplete) // 自動完成搜尋
router.get('/popular', getPopularSources) // 取得熱門來源
router.get('/slug-available', checkSlugAvailable) // 檢查 slug 可用性
router.get('/', getSources) // 取得來源列表
router.get('/:slug', getSourceBundle) // 取得單一來源及相關資料

// 需要登入權限的路由
router.post('/', token, createSource) // 建立新來源
router.put('/:id', token, updateSource) // 更新來源
router.delete('/:id', token, deleteSource) // 刪除來源
router.post('/:id/update-stats', token, isAdmin, updateSourceStats) // 更新統計

export default router
