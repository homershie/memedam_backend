import express from 'express'
import {
  checkAndFixCounts,
  batchCheckCounts,
  getCountStatistics,
  checkAndFixUserCounts,
} from '../utils/checkCounts.js'
import maintenanceScheduler from '../utils/maintenance.js'
import {
  batchUpdateHotScores,
  scheduledHotScoreUpdate,
  getHotScoreStats,
} from '../utils/hotScoreScheduler.js'
import {
  updateAllRecommendationSystems,
  getRecommendationSystemStatus,
  updateRecommendationConfig,
} from '../utils/recommendationScheduler.js'
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
    const { batchSize = 100 } = req.body
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

export default router
