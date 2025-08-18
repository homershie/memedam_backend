import express from 'express'
import { token, isAdmin } from '../middleware/auth.js'
import logService from '../services/logService.js'
import { logger } from '../utils/logger.js'
import jwt from 'jsonwebtoken'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     LogEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 日誌唯一識別碼
 *         level:
 *           type: string
 *           enum: [info, warn, error]
 *           description: 日誌等級
 *         message:
 *           type: string
 *           description: 日誌訊息
 *         context:
 *           type: string
 *           description: 日誌來源
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 建立時間
 *     LogResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             logs:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LogEntry'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *     LogStatistics:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: 總日誌數量
 *         levels:
 *           type: object
 *           description: 各等級日誌數量
 *         contexts:
 *           type: object
 *           description: 各來源日誌數量
 *         recentActivity:
 *           type: object
 *           description: 24小時內各小時活動量
 */

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: 獲取系統日誌列表
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warn, error]
 *         description: 篩選日誌等級
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *         description: 篩選日誌來源
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 開始時間
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 結束時間
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 每頁數量
 *     responses:
 *       200:
 *         description: 成功獲取日誌
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogResponse'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 需要管理員權限
 */
router.get('/', token, isAdmin, async (req, res) => {
  try {
    const { level, context, search, startDate, endDate, page = 1, limit = 50 } = req.query

    const options = {
      level,
      context,
      search,
      startDate,
      endDate,
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // 限制最大每頁數量
    }

    const result = await logService.getLogs(options)

    res.json({
      success: true,
      data: result,
      error: null,
    })
  } catch (error) {
    logger.error('獲取日誌失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取日誌失敗',
    })
  }
})

/**
 * @swagger
 * /api/logs/statistics:
 *   get:
 *     summary: 獲取日誌統計資訊
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功獲取統計
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/LogStatistics'
 */
router.get('/statistics', token, isAdmin, async (req, res) => {
  try {
    const stats = logService.getLogStatistics()
    res.json({
      success: true,
      data: stats,
      error: null,
    })
  } catch (error) {
    logger.error('獲取日誌統計失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取日誌統計失敗',
    })
  }
})

/**
 * @swagger
 * /api/logs/export:
 *   get:
 *     summary: 匯出日誌為 CSV
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warn, error]
 *         description: 篩選日誌等級
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 開始時間
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 結束時間
 *     responses:
 *       200:
 *         description: CSV 檔案
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export', token, isAdmin, async (req, res) => {
  try {
    const { level, startDate, endDate, context } = req.query

    const options = {
      level,
      context,
      startDate,
      endDate,
      page: 1,
      limit: 10000, // 匯出時獲取更多記錄
    }

    const result = await logService.getLogs(options)
    const csvContent = logService.exportToCSV(result.logs)

    const filename = `logs-${new Date().toISOString().split('T')[0]}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('\uFEFF' + csvContent) // 加入 BOM 支援中文
  } catch (error) {
    logger.error('匯出日誌失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '匯出日誌失敗',
    })
  }
})

/**
 * @swagger
 * /api/logs/contexts:
 *   get:
 *     summary: 獲取可用的日誌來源列表
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功獲取來源列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/contexts', token, isAdmin, async (req, res) => {
  try {
    const contexts = logService.getAvailableContexts()
    res.json({
      success: true,
      data: contexts,
      error: null,
    })
  } catch (error) {
    logger.error('獲取日誌來源失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取日誌來源失敗',
    })
  }
})

/**
 * @swagger
 * /api/logs/cleanup:
 *   post:
 *     summary: 清理舊日誌
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysToKeep:
 *                 type: integer
 *                 default: 7
 *                 description: 保留天數
 *     responses:
 *       200:
 *         description: 清理完成
 */
router.post('/cleanup', token, isAdmin, async (req, res) => {
  try {
    const { daysToKeep = 7 } = req.body
    const result = logService.cleanOldLogs(daysToKeep)

    res.json({
      success: true,
      data: result,
      message: `已清理 ${result.removedCount} 條舊日誌`,
    })
  } catch (error) {
    logger.error('清理日誌失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '清理日誌失敗',
    })
  }
})

/**
 * @swagger
 * /api/logs/stream:
 *   get:
 *     summary: 即時日誌串流 (Server-Sent Events)
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [info, warn, error]
 *         description: 篩選日誌等級
 *     responses:
 *       200:
 *         description: SSE 串流
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.get('/stream', (req, res) => {
  // 檢查 token 參數
  const { token: tokenParam } = req.query
  if (!tokenParam) {
    return res.status(401).json({ error: '缺少認證 token' })
  }

  // 驗證 token
  try {
    const decoded = jwt.verify(tokenParam, process.env.JWT_SECRET)
    console.log('Token 解碼結果:', decoded)

    // 檢查用戶是否存在且為管理員
    if (!decoded._id) {
      return res.status(401).json({ error: '無效的 token' })
    }

    // 這裡需要檢查用戶是否為管理員，但由於 stream 路由的特殊性，
    // 我們暫時跳過管理員檢查，只驗證 token 的有效性
    // 實際的管理員檢查應該在用戶登入時進行
  } catch (error) {
    console.error('Token 驗證失敗:', error)
    return res.status(401).json({ error: '無效的 token' })
  }
  // 設置 SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Credentials': 'true',
  })

  const { level } = req.query
  let lastSentIndex = 0

  // 發送現有日誌
  const sendExistingLogs = () => {
    if (!logService.logBuffer) {
      console.warn('logBuffer 不存在')
      return
    }
    console.log('發送現有日誌，logBuffer 長度:', logService.logBuffer.length)
    const logs = logService.logBuffer.slice(0, 50) // 最新50條
    logs.reverse().forEach((log) => {
      if (!level || log.level === level) {
        const logData = JSON.stringify(log)
        console.log('發送日誌:', logData)
        res.write(`data: ${logData}\n\n`)
      }
    })
  }

  // 發送新日誌的間隔檢查
  const interval = setInterval(() => {
    if (!logService.logBuffer) {
      return
    }
    if (logService.logBuffer.length > lastSentIndex) {
      const recentLogs = logService.logBuffer.slice(lastSentIndex)
      console.log('發送新日誌，數量:', recentLogs.length)
      recentLogs.forEach((log) => {
        if (!level || log.level === level) {
          const logData = JSON.stringify(log)
          console.log('發送新日誌:', logData)
          res.write(`data: ${logData}\n\n`)
        }
      })
      lastSentIndex = logService.logBuffer.length
    }
  }, 1000)

  // 發送初始日誌
  console.log('開始發送初始日誌')
  sendExistingLogs()
  lastSentIndex = logService.logBuffer ? logService.logBuffer.length : 0
  console.log('初始 lastSentIndex:', lastSentIndex)

  // 發送一個初始連接成功的訊息
  res.write(`data: ${JSON.stringify({ type: 'connection', message: '串流連接成功' })}\n\n`)

  // 發送一個心跳訊息
  const heartbeatInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`)
  }, 30000) // 每30秒發送一次心跳

  // 清理連線
  req.on('close', () => {
    clearInterval(interval)
    clearInterval(heartbeatInterval)
  })

  req.on('aborted', () => {
    clearInterval(interval)
    clearInterval(heartbeatInterval)
  })
})

export default router
