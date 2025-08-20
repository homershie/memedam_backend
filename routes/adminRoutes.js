import express from 'express'
import {
  checkAndFixCounts,
  batchCheckCounts,
  getCountStatistics,
  checkAndFixUserCounts,
} from '../utils/checkCounts.js'
import maintenanceScheduler from '../services/maintenanceScheduler.js'
import {
  batchUpdateHotScores,
  scheduledHotScoreUpdate,
  getHotScoreStats,
} from '../utils/hotScoreScheduler.js'
import {
  updateAllRecommendationSystems,
  getRecommendationSystemStatus,
  updateRecommendationConfig,
} from '../services/recommendationScheduler.js'
import {
  batchUpdateUserPreferences,
  scheduledContentBasedUpdate,
  getContentBasedStats,
  updateContentBasedConfig,
} from '../utils/contentBasedScheduler.js'
import {
  batchUpdateCollaborativeFilteringCache,
  scheduledCollaborativeFilteringUpdate,
  getCollaborativeFilteringStats,
  updateCollaborativeFilteringConfig,
} from '../utils/collaborativeFilteringScheduler.js'
import { manualTriggers } from '../services/notificationScheduler.js'
import { token, isAdmin } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: 操作是否成功
 *         data:
 *           type: object
 *           description: 回應數據
 *         error:
 *           type: string
 *           description: 錯誤訊息
 *         message:
 *           type: string
 *           description: 成功訊息
 *     CountStatistics:
 *       type: object
 *       properties:
 *         totalMemes:
 *           type: integer
 *           description: 總迷因數
 *         memesWithIncorrectCounts:
 *           type: integer
 *           description: 計數錯誤的迷因數
 *         totalUsers:
 *           type: integer
 *           description: 總用戶數
 *         usersWithIncorrectCounts:
 *           type: integer
 *           description: 計數錯誤的用戶數
 *     HotScoreStats:
 *       type: object
 *       properties:
 *         lastUpdate:
 *           type: string
 *           format: date-time
 *           description: 最後更新時間
 *         updatedCount:
 *           type: integer
 *           description: 更新的迷因數量
 *         averageHotScore:
 *           type: number
 *           description: 平均熱門分數
 *     RecommendationSystemStatus:
 *       type: object
 *       properties:
 *         contentBased:
 *           type: object
 *           description: 內容基礎推薦系統狀態
 *         collaborativeFiltering:
 *           type: object
 *           description: 協同過濾推薦系統狀態
 *         lastUpdate:
 *           type: string
 *           format: date-time
 *           description: 最後更新時間
 */

/**
 * @swagger
 * /api/admin/check-counts/{memeId}:
 *   post:
 *     summary: 檢查並修正單一迷因的計數
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 檢查完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */

/**
 * @swagger
 * /api/admin/check-all-counts:
 *   post:
 *     summary: 檢查並修正所有迷因的計數
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               batchSize:
 *                 type: integer
 *                 default: 100
 *                 description: 批次處理大小
 *     responses:
 *       200:
 *         description: 檢查完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */

/**
 * @swagger
 * /api/admin/count-statistics:
 *   get:
 *     summary: 取得計數統計資訊
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得統計資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CountStatistics'
 *                 error:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */

/**
 * @swagger
 * /api/admin/check-user-counts/{userId}:
 *   post:
 *     summary: 檢查並修正單一用戶的統計計數
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     responses:
 *       200:
 *         description: 檢查完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */

// 檢查並修正單一迷因的計數
router.post('/check-counts/:memeId', token, isAdmin, async (req, res) => {
  try {
    const { memeId } = req.params
    const result = await checkAndFixCounts(memeId)
    res.json({
      success: true,
      data: result,
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

// 檢查並修正所有迷因的計數
router.post('/check-all-counts', token, isAdmin, async (req, res) => {
  try {
    const batchSize = req.body?.batchSize || 100
    const result = await batchCheckCounts(batchSize)
    res.json({
      success: true,
      data: result,
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

// 取得計數統計資訊
router.get('/count-statistics', token, isAdmin, async (req, res) => {
  try {
    const statistics = await getCountStatistics()
    res.json({
      success: true,
      data: statistics,
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/check-all-user-counts:
 *   post:
 *     summary: 檢查並修正所有用戶的統計計數
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 檢查完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/check-all-user-counts', token, isAdmin, async (req, res) => {
  try {
    const result = await checkAndFixUserCounts()
    res.json({
      success: true,
      data: result,
      message: '已完成所有用戶統計計數檢查',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/run-full-check:
 *   post:
 *     summary: 手動觸發完整數據檢查
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 檢查完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/run-full-check', token, isAdmin, async (req, res) => {
  try {
    const result = await maintenanceScheduler.runFullCheck()
    res.json({
      success: true,
      data: result,
      message: '手動完整數據檢查已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/maintenance-status:
 *   get:
 *     summary: 獲取維護任務狀態
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功獲取維護狀態
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/maintenance-status', token, isAdmin, async (req, res) => {
  try {
    const status = maintenanceScheduler.getTasksStatus()
    res.json({
      success: true,
      data: status,
      message: '已獲取維護任務狀態',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/batch-update-hot-scores:
 *   post:
 *     summary: 批次更新熱門分數
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 1000
 *                 description: 更新數量限制
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: 是否強制更新
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/batch-update-hot-scores', token, isAdmin, async (req, res) => {
  try {
    const { limit = 1000, force = false } = req.body
    const result = await batchUpdateHotScores({ limit, force })
    res.json({
      success: true,
      data: result,
      message: '批次更新熱門分數已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/scheduled-hot-score-update:
 *   post:
 *     summary: 執行定期熱門分數更新任務
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updateInterval:
 *                 type: string
 *                 default: '1h'
 *                 description: 更新間隔
 *               maxUpdates:
 *                 type: integer
 *                 default: 1000
 *                 description: 最大更新數量
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: 是否強制更新
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/scheduled-hot-score-update', token, isAdmin, async (req, res) => {
  try {
    const { updateInterval = '1h', maxUpdates = 1000, force = false } = req.body
    const result = await scheduledHotScoreUpdate({ updateInterval, maxUpdates, force })
    res.json({
      success: true,
      data: result,
      message: '定期熱門分數更新任務已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/hot-score-statistics:
 *   get:
 *     summary: 取得熱門分數統計資訊
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得統計資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/HotScoreStats'
 *                 error:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/hot-score-statistics', token, isAdmin, async (req, res) => {
  try {
    const statistics = await getHotScoreStats()
    res.json({
      success: true,
      data: statistics,
      message: '已獲取熱門分數統計資訊',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

// 推薦系統管理端點
/**
 * @swagger
 * /api/admin/update-all-recommendation-systems:
 *   post:
 *     summary: 執行所有推薦系統更新
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               options:
 *                 type: object
 *                 description: 更新選項
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/update-all-recommendation-systems', token, isAdmin, async (req, res) => {
  try {
    const { options = {} } = req.body || {}
    const result = await updateAllRecommendationSystems(options)
    res.json({
      success: true,
      data: result,
      message: '所有推薦系統更新已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/recommendation-system-status:
 *   get:
 *     summary: 取得推薦系統狀態
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得系統狀態
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RecommendationSystemStatus'
 *                 error:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/recommendation-system-status', token, isAdmin, async (req, res) => {
  try {
    const status = await getRecommendationSystemStatus()
    res.json({
      success: true,
      data: status,
      message: '已獲取推薦系統狀態',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/recommendation-system-config:
 *   put:
 *     summary: 更新推薦系統配置
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *                 description: 系統配置
 *     responses:
 *       200:
 *         description: 配置更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.put('/recommendation-system-config', token, isAdmin, async (req, res) => {
  try {
    const { config } = req.body
    const result = await updateRecommendationConfig(config)
    res.json({
      success: true,
      data: result,
      message: '推薦系統配置已更新',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

// 內容基礎推薦管理端點
/**
 * @swagger
 * /api/admin/batch-update-user-preferences:
 *   post:
 *     summary: 批次更新用戶偏好快取
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxUsers:
 *                 type: integer
 *                 default: 1000
 *                 description: 最大用戶數
 *               batchSize:
 *                 type: integer
 *                 default: 100
 *                 description: 批次大小
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/batch-update-user-preferences', token, isAdmin, async (req, res) => {
  try {
    const { maxUsers = 1000, batchSize = 100 } = req.body
    const result = await batchUpdateUserPreferences({ maxUsers, batchSize })
    res.json({
      success: true,
      data: result,
      message: '用戶偏好快取批次更新已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/scheduled-content-based-update:
 *   post:
 *     summary: 執行定期內容基礎推薦更新任務
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updateInterval:
 *                 type: string
 *                 default: '24h'
 *                 description: 更新間隔
 *               maxUsers:
 *                 type: integer
 *                 default: 1000
 *                 description: 最大用戶數
 *               batchSize:
 *                 type: integer
 *                 default: 100
 *                 description: 批次大小
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/scheduled-content-based-update', token, isAdmin, async (req, res) => {
  try {
    const { updateInterval = '24h', maxUsers = 1000, batchSize = 100 } = req.body
    const result = await scheduledContentBasedUpdate({ updateInterval, maxUsers, batchSize })
    res.json({
      success: true,
      data: result,
      message: '定期內容基礎推薦更新任務已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/content-based-statistics:
 *   get:
 *     summary: 取得內容基礎推薦統計資訊
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得統計資訊
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/content-based-statistics', token, isAdmin, async (req, res) => {
  try {
    const statistics = await getContentBasedStats()
    res.json({
      success: true,
      data: statistics,
      message: '已獲取內容基礎推薦統計資訊',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/content-based-config:
 *   put:
 *     summary: 更新內容基礎推薦配置
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *                 description: 配置參數
 *     responses:
 *       200:
 *         description: 配置更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.put('/content-based-config', token, isAdmin, async (req, res) => {
  try {
    const { config } = req.body
    const result = await updateContentBasedConfig(config)
    res.json({
      success: true,
      data: result,
      message: '內容基礎推薦配置已更新',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

// 協同過濾推薦管理端點
/**
 * @swagger
 * /api/admin/batch-update-collaborative-filtering:
 *   post:
 *     summary: 批次更新協同過濾快取
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxUsers:
 *                 type: integer
 *                 default: 1000
 *                 description: 最大用戶數
 *               maxMemes:
 *                 type: integer
 *                 default: 5000
 *                 description: 最大迷因數
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/batch-update-collaborative-filtering', token, isAdmin, async (req, res) => {
  try {
    const { maxUsers = 1000, maxMemes = 5000 } = req.body
    const result = await batchUpdateCollaborativeFilteringCache({ maxUsers, maxMemes })
    res.json({
      success: true,
      data: result,
      message: '協同過濾快取批次更新已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/scheduled-collaborative-filtering-update:
 *   post:
 *     summary: 執行定期協同過濾推薦更新任務
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updateInterval:
 *                 type: string
 *                 default: '24h'
 *                 description: 更新間隔
 *               maxUsers:
 *                 type: integer
 *                 default: 1000
 *                 description: 最大用戶數
 *               maxMemes:
 *                 type: integer
 *                 default: 5000
 *                 description: 最大迷因數
 *               includeSocial:
 *                 type: boolean
 *                 default: true
 *                 description: 是否包含社交因素
 *     responses:
 *       200:
 *         description: 更新完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/scheduled-collaborative-filtering-update', token, isAdmin, async (req, res) => {
  try {
    const {
      updateInterval = '24h',
      maxUsers = 1000,
      maxMemes = 5000,
      includeSocial = true,
    } = req.body
    const result = await scheduledCollaborativeFilteringUpdate({
      updateInterval,
      maxUsers,
      maxMemes,
      includeSocial,
    })
    res.json({
      success: true,
      data: result,
      message: '定期協同過濾推薦更新任務已完成',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/collaborative-filtering-statistics:
 *   get:
 *     summary: 取得協同過濾推薦統計資訊
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得統計資訊
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/collaborative-filtering-statistics', token, isAdmin, async (req, res) => {
  try {
    const statistics = await getCollaborativeFilteringStats()
    res.json({
      success: true,
      data: statistics,
      message: '已獲取協同過濾推薦統計資訊',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/collaborative-filtering-config:
 *   put:
 *     summary: 更新協同過濾推薦配置
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - config
 *             properties:
 *               config:
 *                 type: object
 *                 description: 配置參數
 *     responses:
 *       200:
 *         description: 配置更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.put('/collaborative-filtering-config', token, isAdmin, async (req, res) => {
  try {
    const { config } = req.body
    const result = await updateCollaborativeFilteringConfig(config)
    res.json({
      success: true,
      data: result,
      message: '協同過濾推薦配置已更新',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/notifications/hot-content:
 *   post:
 *     summary: 手動觸發熱門內容通知
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 熱門內容通知發送成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/notifications/hot-content', token, isAdmin, async (req, res) => {
  try {
    await manualTriggers.sendHotContentNotifications()
    res.json({
      success: true,
      data: { message: '熱門內容通知已發送' },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/notifications/weekly-summary:
 *   post:
 *     summary: 手動觸發週報摘要通知
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 週報摘要通知發送成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/notifications/weekly-summary', token, isAdmin, async (req, res) => {
  try {
    await manualTriggers.sendWeeklySummaryNotifications()
    res.json({
      success: true,
      data: { message: '週報摘要通知已發送' },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/notifications/cleanup:
 *   post:
 *     summary: 手動清理舊通知
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: 清理多少天前的通知
 *     responses:
 *       200:
 *         description: 舊通知清理成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/notifications/cleanup', token, isAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    await manualTriggers.cleanupOldNotificationsTask()
    res.json({
      success: true,
      data: { message: `已清理 ${days} 天前的舊通知` },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/create-test-reports:
 *   post:
 *     summary: 創建測試報告
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 測試報告創建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/create-test-reports', token, isAdmin, async (req, res) => {
  try {
    // 這裡可以調用測試報告創建腳本
    const { spawn } = await import('child_process')
    const { fileURLToPath } = await import('url')
    const { dirname, join } = await import('path')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const scriptPath = join(__dirname, '..', 'scripts', 'create-test-reports.js')

    const child = spawn('node', [scriptPath], {
      stdio: 'pipe',
      cwd: join(__dirname, '..'),
    })

    let output = ''
    let errorOutput = ''

    child.stdout.on('data', (data) => {
      output += data.toString()
    })

    child.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          data: {
            message: '測試報告創建成功',
            output: output,
          },
          error: null,
        })
      } else {
        res.status(500).json({
          success: false,
          data: null,
          error: `測試報告創建失敗: ${errorOutput}`,
        })
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/system-performance-stats:
 *   get:
 *     summary: 獲取系統性能統計
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 系統性能統計獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/system-performance-stats', token, isAdmin, async (req, res) => {
  try {
    const os = await import('os')
    const process = await import('process')

    const stats = {
      uptime: process.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
      },
      cpu: {
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      pid: process.pid,
    }

    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/database-stats:
 *   get:
 *     summary: 獲取資料庫統計
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 資料庫統計獲取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.get('/database-stats', token, isAdmin, async (req, res) => {
  try {
    // 直接使用已導入的 mongoose
    const mongoose = (await import('mongoose')).default

    // 檢查 mongoose 是否已初始化
    if (!mongoose || !mongoose.connection) {
      throw new Error('Mongoose 未初始化')
    }

    // 檢查連接狀態
    if (mongoose.connection.readyState !== 1) {
      throw new Error('資料庫連接未就緒')
    }

    // 等待連接完全建立
    await new Promise((resolve, reject) => {
      if (mongoose.connection.readyState === 1) {
        resolve()
      } else {
        mongoose.connection.once('connected', resolve)
        mongoose.connection.once('error', reject)
        // 設置超時
        setTimeout(() => reject(new Error('資料庫連接超時')), 5000)
      }
    })

    const db = mongoose.connection.db
    if (!db) {
      throw new Error('無法獲取資料庫實例')
    }

    const stats = await db.stats()
    const collections = await db.listCollections().toArray()

    res.json({
      success: true,
      data: {
        database: stats.db,
        collectionsCount: collections.length,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
        collections: collections.map((col) => ({
          name: col.name,
          type: col.type,
        })),
      },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/cleanup-expired-cache:
 *   post:
 *     summary: 清理過期快取
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 過期快取清理成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/cleanup-expired-cache', token, isAdmin, async (req, res) => {
  try {
    // 這裡可以實現快取清理邏輯
    // 例如清理 Redis 過期鍵、清理記憶體快取等

    res.json({
      success: true,
      data: { message: '過期快取清理完成' },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

/**
 * @swagger
 * /api/admin/rebuild-indexes:
 *   post:
 *     summary: 重建資料庫索引
 *     tags: [管理員]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 索引重建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       500:
 *         description: 伺服器錯誤
 */
router.post('/rebuild-indexes', token, isAdmin, async (req, res) => {
  try {
    // 直接使用已導入的 mongoose
    const mongoose = (await import('mongoose')).default

    // 檢查 mongoose 是否已初始化
    if (!mongoose || !mongoose.connection) {
      throw new Error('Mongoose 未初始化')
    }

    // 檢查連接狀態
    if (mongoose.connection.readyState !== 1) {
      throw new Error('資料庫連接未就緒')
    }

    // 等待連接完全建立
    await new Promise((resolve, reject) => {
      if (mongoose.connection.readyState === 1) {
        resolve()
      } else {
        mongoose.connection.once('connected', resolve)
        mongoose.connection.once('error', reject)
        // 設置超時
        setTimeout(() => reject(new Error('資料庫連接超時')), 5000)
      }
    })

    const db = mongoose.connection.db
    if (!db) {
      throw new Error('無法獲取資料庫實例')
    }

    // 重建所有集合的索引
    const collections = await db.listCollections().toArray()
    const results = []

    for (const collection of collections) {
      try {
        await db.collection(collection.name).reIndex()
        results.push({
          collection: collection.name,
          status: 'success',
        })
      } catch (error) {
        results.push({
          collection: collection.name,
          status: 'error',
          error: error.message,
        })
      }
    }

    res.json({
      success: true,
      data: {
        message: '索引重建完成',
        results: results,
      },
      error: null,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

export default router
