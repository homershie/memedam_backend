import Report from '../models/Report.js'

// 建立舉報
export const createReport = async (req, res) => {
  try {
    const report = new Report(req.body)
    await report.save()
    res.status(201).json(report)
  } catch (err) {
    res.status(400).json({ error: err.message })
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
