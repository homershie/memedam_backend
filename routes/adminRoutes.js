import express from 'express'
import {
  checkAndFixCounts,
  batchCheckCounts,
  getCountStatistics,
  checkAndFixUserCounts,
} from '../utils/checkCounts.js'
import maintenanceScheduler from '../utils/maintenance.js'
import { token, isAdmin } from '../middleware/auth.js'

const router = express.Router()

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

// 檢查並修正單一用戶的統計計數
router.post('/check-user-counts/:userId', token, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const result = await checkAndFixUserCounts(userId)
    res.json({
      success: true,
      data: result,
      message: `已檢查用戶 ${userId} 的統計計數`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
})

// 檢查並修正所有用戶的統計計數
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

// 手動觸發完整數據檢查
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

// 獲取維護任務狀態
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

export default router
