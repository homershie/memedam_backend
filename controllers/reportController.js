import Report from '../models/Report.js'
import { body, validationResult } from 'express-validator'

// 建立舉報
export const validateCreateReport = [
  body('target_id').notEmpty().withMessage('被檢舉對象必填'),
  body('reason').isLength({ min: 1, max: 200 }).withMessage('檢舉原因必填，且長度需在 1~200 字'),
]

export const createReport = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, error: errors.array() })
  }
  try {
    const { target_id, reason } = req.body
    const report = new Report({ target_id, reason, user_id: req.user?._id })
    await report.save()
    res.status(201).json({ success: true, data: report, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message })
  }
}

// 取得所有舉報（可加分頁、條件查詢）
export const getReports = async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.target_type) filter.target_type = req.query.target_type
    if (req.query.target_id) filter.target_id = req.query.target_id
    if (req.query.reporter_id) filter.reporter_id = req.query.reporter_id
    const reports = await Report.find(filter).sort({ createdAt: -1 })
    res.json(reports)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 取得單一舉報
export const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
    if (!report) return res.status(404).json({ error: '找不到舉報' })
    res.json(report)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 更新舉報
export const updateReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!report) return res.status(404).json({ error: '找不到舉報' })
    res.json(report)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// 刪除舉報
export const deleteReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id)
    if (!report) return res.status(404).json({ error: '找不到舉報' })
    res.json({ message: '舉報已刪除' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
