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

  // 使用 session 來確保原子性操作
  const session = await Report.startSession()
  session.startTransaction()

  try {
    const { target_id, reason } = req.body
    const report = new Report({ target_id, reason, user_id: req.user?._id })
    await report.save({ session })

    // 提交事務
    await session.commitTransaction()

    res.status(201).json({ success: true, data: report, error: null })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '您已經檢舉過此內容，請勿重複檢舉',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(500).json({ success: false, data: null, error: error.message })
  } finally {
    // 結束 session
    session.endSession()
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
  // 使用 session 來確保原子性操作
  const session = await Report.startSession()
  session.startTransaction()

  try {
    const report = await Report.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
      session,
    })

    if (!report) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到舉報' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json(report)
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()

    // 處理重複鍵錯誤
    if (error.code === 11000) {
      return res.status(409).json({
        error: '檢舉記錄重複，請檢查是否已存在相同記錄',
      })
    }

    // 處理驗證錯誤
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
      })
    }

    res.status(400).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}

// 刪除舉報
export const deleteReport = async (req, res) => {
  // 使用 session 來確保原子性操作
  const session = await Report.startSession()
  session.startTransaction()

  try {
    const report = await Report.findByIdAndDelete(req.params.id).session(session)
    if (!report) {
      await session.abortTransaction()
      return res.status(404).json({ error: '找不到舉報' })
    }

    // 提交事務
    await session.commitTransaction()

    res.json({ message: '舉報已刪除' })
  } catch (error) {
    // 回滾事務
    await session.abortTransaction()
    res.status(500).json({ error: error.message })
  } finally {
    // 結束 session
    session.endSession()
  }
}
