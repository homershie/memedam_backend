import express from 'express'
import {
  getTemplates,
  getTemplate,
  getMemeSidebar,
  updateMemeSidebar,
  resetMemeSidebar,
  previewSidebar,
  batchUpdateSidebarTemplate,
} from '../controllers/sidebarController.js'
import { token, isUser, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// 模板管理路由
router.get('/templates', getTemplates) // 取得所有可用模板
router.get('/templates/:templateName', getTemplate) // 取得特定模板定義

// 迷因側邊欄路由
router.get('/memes/:memeId', getMemeSidebar) // 取得迷因的側邊欄資料
router.put('/memes/:memeId', token, isUser, updateMemeSidebar) // 更新迷因的側邊欄資料
router.post('/memes/:memeId/reset', token, isUser, resetMemeSidebar) // 重置迷因的側邊欄

// 預覽功能
router.post('/preview', previewSidebar) // 預覽側邊欄（不保存）

// 管理員功能
router.post('/batch-update', token, isAdmin, batchUpdateSidebarTemplate) // 批次更新側邊欄模板

export default router
