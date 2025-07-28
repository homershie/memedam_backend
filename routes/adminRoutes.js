import express from 'express'
import { checkAndFixCounts, batchCheckCounts, getCountStatistics } from '../utils/checkCounts.js'
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

export default router
