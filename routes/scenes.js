import express from 'express'
import {
  getSceneBundle,
  getSourceScenes,
  createScene,
  updateScene,
  deleteScene,
  updateSceneStats,
  searchScenes,
  getPopularScenes,
} from '../controllers/sceneController.js'
import { authenticateToken, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// 公開路由
router.get('/search', searchScenes) // 搜尋片段
router.get('/popular', getPopularScenes) // 取得熱門片段
router.get('/source/:sourceId', getSourceScenes) // 取得來源的所有片段
router.get('/:idOrSlug', getSceneBundle) // 取得單一片段及相關資料

// 需要管理員權限的路由
router.post('/', authenticateToken, isAdmin, createScene) // 建立新片段
router.put('/:id', authenticateToken, isAdmin, updateScene) // 更新片段
router.delete('/:id', authenticateToken, isAdmin, deleteScene) // 刪除片段
router.post('/:id/update-stats', authenticateToken, isAdmin, updateSceneStats) // 更新統計

export default router