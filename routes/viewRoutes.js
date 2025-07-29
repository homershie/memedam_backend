import express from 'express'
import {
  recordView,
  getViewStats,
  getUserViewHistory,
  getPopularMemes,
  cleanupOldViews,
} from '../controllers/viewController.js'
import { token, isManager } from '../middleware/auth.js'

const router = express.Router()

// 記錄瀏覽（公開，不需要登入）
router.post('/:meme_id', recordView)

// 取得迷因瀏覽統計（公開）
router.get('/stats/:meme_id', getViewStats)

// 取得用戶瀏覽歷史（需要登入）
router.get('/history', token, getUserViewHistory)

// 取得熱門迷因（基於瀏覽數，公開）
router.get('/popular', getPopularMemes)

// 清理過期瀏覽記錄（管理員功能）
router.delete('/cleanup', token, isManager, cleanupOldViews)

export default router
