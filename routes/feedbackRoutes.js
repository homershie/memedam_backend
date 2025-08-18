import express from 'express'
import {
  submitFeedback,
  getFeedbacks,
  updateFeedbackStatus,
} from '../controllers/feedbackController.js'
import { token, isAdmin } from '../middleware/auth.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

// 需要登入的路由：提交意見 (限制頻率防止濫用)
router.post(
  '/submit',
  token, // 需要登入
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 3, // 降低為最多 3 次提交
    message: '提交過於頻繁，請稍後再試',
  }),
  submitFeedback,
)

// 管理員路由：取得意見列表
router.get('/admin', isAdmin, getFeedbacks)

// 管理員路由：更新意見狀態
router.put('/admin/:id', isAdmin, updateFeedbackStatus)

export default router
