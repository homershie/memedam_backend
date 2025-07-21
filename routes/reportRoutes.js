import express from 'express'
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
} from '../controllers/reportController.js'
import { token, isUser, isManager, canEditReport, canViewReport } from '../middleware/auth.js'

const router = express.Router()

// 建立舉報
router.post('/', token, isUser, createReport)
// 取得所有舉報
router.get('/', token, isManager, getReports)
// 取得單一舉報
router.get('/:id', token, canViewReport, getReportById)
// 編輯舉報
router.put('/:id', token, canEditReport, updateReport)
// 刪除舉報
router.delete('/:id', token, canEditReport, deleteReport)

export default router
