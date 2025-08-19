import Report from '../models/Report.js'
import User from '../models/User.js'
import Meme from '../models/Meme.js'
import Comment from '../models/Comment.js'
import mongoose from 'mongoose'
import { body, validationResult } from 'express-validator'
import {
  notifyReportSubmitted,
  notifyReportProcessed,
  notifyAuthorWarned,
  notifyAuthorStruck,
  notifyContentRemoved,
  notifyContentHidden,
  notifyCommentsLocked,
} from '../services/notificationService.js'

// 檢舉原因選項
export const reportReasons = [
  { value: 'inappropriate', label: '不當內容' },
  { value: 'hate_speech', label: '仇恨言論' },
  { value: 'spam', label: '垃圾訊息' },
  { value: 'copyright', label: '版權問題' },
  { value: 'other', label: '其他' },
]

// 檢舉狀態選項
export const reportStatuses = [
  { value: 'pending', label: '待處理' },
  { value: 'processed', label: '已處理' },
  { value: 'rejected', label: '已駁回' },
]

// 處理方式選項
export const actionTypes = [
  { value: 'none', label: '無動作' },
  { value: 'remove_content', label: '刪除內容' },
  { value: 'soft_hide', label: '軟隱藏' },
  { value: 'age_gate', label: '年齡限制' },
  { value: 'mark_nsfw', label: '標記為成人內容' },
  { value: 'lock_comments', label: '鎖定留言' },
  { value: 'issue_strike', label: '記違規點數' },
  { value: 'warn_author', label: '警告作者' },
]

// ObjectId 驗證函數
const validateObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('無效的檢舉ID格式')
  }
  return new mongoose.Types.ObjectId(id)
}

// 建立檢舉驗證
export const validateCreateReport = [
  body('target_type')
    .isIn(['meme', 'comment', 'user'])
    .withMessage('檢舉目標類型必須是 meme、comment 或 user'),
  body('target_id').isMongoId().withMessage('檢舉目標ID必須是有效的MongoDB ID'),
  body('reason')
    .isIn(['inappropriate', 'hate_speech', 'spam', 'copyright', 'other'])
    .withMessage('檢舉原因必須是有效的選項'),
  body('description').optional().isLength({ max: 1000 }).withMessage('詳細描述不能超過1000字'),
]

// 處理檢舉驗證
export const validateResolveReport = [
  body('status').isIn(['pending', 'processed', 'rejected']).withMessage('狀態必須是有效的選項'),
  body('action')
    .optional()
    .isIn([
      'none',
      'remove_content',
      'soft_hide',
      'age_gate',
      'mark_nsfw',
      'lock_comments',
      'issue_strike',
      'warn_author',
    ])
    .withMessage('處理方式必須是有效的選項'),
  body('action_meta').optional().isObject().withMessage('處理方式詳細資訊必須是物件'),
  body('admin_comment').optional().isLength({ max: 1000 }).withMessage('管理員備註不能超過1000字'),
]

// 批量處理檢舉驗證
export const validateBatchResolveReport = [
  body('ids').isArray({ min: 1 }).withMessage('檢舉ID列表不能為空'),
  body('ids.*').isMongoId().withMessage('檢舉ID必須是有效的MongoDB ID'),
  body('status').isIn(['pending', 'processed', 'rejected']).withMessage('狀態必須是有效的選項'),
  body('action')
    .optional()
    .isIn([
      'none',
      'remove_content',
      'soft_hide',
      'age_gate',
      'mark_nsfw',
      'lock_comments',
      'issue_strike',
      'warn_author',
    ])
    .withMessage('處理方式必須是有效的選項'),
  body('action_meta').optional().isObject().withMessage('處理方式詳細資訊必須是物件'),
  body('admin_comment').optional().isLength({ max: 1000 }).withMessage('管理員備註不能超過1000字'),
]

// 建立檢舉
export const createReport = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      data: null,
      error: errors.array(),
    })
  }

  const session = await Report.startSession()
  session.startTransaction()

  try {
    const { target_type, target_id, reason, description } = req.body
    const reporter_id = req.user._id

    // 檢查目標是否存在
    let targetExists = false
    switch (target_type) {
      case 'meme':
        targetExists = await Meme.findById(target_id).session(session)
        break
      case 'comment':
        targetExists = await Comment.findById(target_id).session(session)
        break
      case 'user':
        targetExists = await User.findById(target_id).session(session)
        break
    }

    if (!targetExists) {
      await session.abortTransaction()
      return res.status(404).json({
        success: false,
        data: null,
        error: '檢舉目標不存在',
      })
    }

    // 檢查是否已檢舉過
    const existingReport = await Report.findOne({
      reporter_id,
      target_type,
      target_id,
    }).session(session)

    if (existingReport) {
      await session.abortTransaction()
      return res.status(409).json({
        success: false,
        data: null,
        error: '您已經檢舉過此內容，請勿重複檢舉',
      })
    }

    const report = new Report({
      reporter_id,
      target_type,
      target_id,
      reason,
      description,
    })

    await report.save({ session })
    await session.commitTransaction()

    // 發送檢舉提交通知
    try {
      await notifyReportSubmitted(report._id, reporter_id)
    } catch (notificationError) {
      console.error('發送檢舉提交通知失敗:', notificationError)
      // 通知失敗不影響檢舉提交
    }

    // 如果有品質警告，加入回應中
    const response = {
      success: true,
      data: report,
      error: null,
    }

    if (req.reportWarning) {
      response.warning = req.reportWarning
    }

    res.status(201).json(response)
  } catch (error) {
    await session.abortTransaction()

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        data: null,
        error: '您已經檢舉過此內容，請勿重複檢舉',
      })
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

// 取得用戶自己的檢舉列表
export const getMyReports = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, sort = 'createdAt', order = 'desc' } = req.query
    const reporter_id = req.user._id

    const filter = { reporter_id }
    if (status) filter.status = status

    const sortObj = {}
    sortObj[sort] = order === 'desc' ? -1 : 1

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const reports = await Report.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('handler_id', 'username avatar')

    // 為每個檢舉添加目標資訊
    const reportsWithTargetInfo = await Promise.all(
      reports.map(async (report) => {
        const reportObj = report.toObject()

        // 根據目標類型獲取目標資訊
        let targetInfo = {}
        try {
          switch (report.target_type) {
            case 'meme': {
              const meme = await Meme.findById(report.target_id).select('title author_id')
              if (meme) {
                const author = await User.findById(meme.author_id).select('username')
                targetInfo = {
                  title: meme.title,
                  author: author ? author.username : '未知用戶',
                }
              }
              break
            }
            case 'comment': {
              const comment = await Comment.findById(report.target_id).select('content author_id')
              if (comment) {
                const author = await User.findById(comment.author_id).select('username')
                targetInfo = {
                  title:
                    comment.content.substring(0, 50) + (comment.content.length > 50 ? '...' : ''),
                  author: author ? author.username : '未知用戶',
                }
              }
              break
            }
            case 'user': {
              const user = await User.findById(report.target_id).select('username')
              if (user) {
                targetInfo = {
                  title: `用戶: ${user.username}`,
                  author: user.username,
                }
              }
              break
            }
          }
        } catch (error) {
          console.error('獲取目標資訊失敗:', error)
          targetInfo = {
            title: '無法獲取資訊',
            author: '未知',
          }
        }

        return {
          ...reportObj,
          target_info: targetInfo,
        }
      }),
    )

    const total = await Report.countDocuments(filter)

    res.json({
      success: true,
      data: {
        reports: reportsWithTargetInfo,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
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
}

// 取得檢舉列表（管理員功能）
export const getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      reason,
      target_type,
      groupBy = 'target',
      sort = 'createdAt',
      order = 'desc',
    } = req.query

    const filter = {}
    if (status) filter.status = status
    if (reason) filter.reason = reason
    if (target_type) filter.target_type = target_type

    const sortObj = {}
    sortObj[sort] = order === 'desc' ? -1 : 1

    const skip = (parseInt(page) - 1) * parseInt(limit)

    if (groupBy === 'target') {
      // 群組化查詢：按目標分組
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: { target_type: '$target_type', target_id: '$target_id' },
            reports: { $push: '$$ROOT' },
            total_reports: { $sum: 1 },
            reasons: { $addToSet: '$reason' },
            latest_report: { $max: '$createdAt' },
            statuses: { $addToSet: '$status' },
          },
        },
        { $sort: { latest_report: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ]

      const groupedReports = await Report.aggregate(pipeline)
      const total = await Report.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { target_type: '$target_type', target_id: '$target_id' },
          },
        },
        { $count: 'total' },
      ])

      res.json({
        success: true,
        data: {
          reports: groupedReports,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total[0]?.total || 0,
            pages: Math.ceil((total[0]?.total || 0) / parseInt(limit)),
          },
        },
        error: null,
      })
    } else {
      // 一般查詢
      const reports = await Report.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reporter_id', 'username avatar')
        .populate('handler_id', 'username avatar')

      const total = await Report.countDocuments(filter)

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        },
        error: null,
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
}

// 取得單一檢舉詳情
export const getReportById = async (req, res) => {
  try {
    const reportId = validateObjectId(req.params.id)
    const report = await Report.findById(reportId)
      .populate('reporter_id', 'username avatar')
      .populate('handler_id', 'username avatar')

    if (!report) {
      return res.status(404).json({
        success: false,
        data: null,
        error: '檢舉不存在',
      })
    }

    // 如果是管理員，同時取得同目標的其他檢舉摘要
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      const relatedReports = await Report.find({
        target_type: report.target_type,
        target_id: report.target_id,
      })
        .where('_id')
        .ne(report._id)
        .populate('reporter_id', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(10)

      res.json({
        success: true,
        data: {
          report,
          relatedReports,
        },
        error: null,
      })
    } else {
      res.json({
        success: true,
        data: { report },
        error: null,
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  }
}

// 處理檢舉
export const resolveReport = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      data: null,
      error: errors.array(),
    })
  }

  const session = await Report.startSession()
  session.startTransaction()

  try {
    const { status, action, action_meta, admin_comment } = req.body
    const handler_id = req.user._id
    const reportId = validateObjectId(req.params.id)

    const report = await Report.findById(reportId).session(session)
    if (!report) {
      await session.abortTransaction()
      return res.status(404).json({
        success: false,
        data: null,
        error: '檢舉不存在',
      })
    }

    // 更新檢舉
    const updateData = {
      status,
      action,
      action_meta,
      admin_comment,
      handler_id,
    }

    if (status === 'processed' || status === 'rejected') {
      updateData.processed_at = new Date()
    }

    const updatedReport = await Report.findByIdAndUpdate(reportId, updateData, {
      new: true,
      runValidators: true,
      session,
    })

    await session.commitTransaction()

    // 發送相應的通知
    try {
      // 通知檢舉者處理結果
      await notifyReportProcessed(report._id, report.reporter_id, status, action, admin_comment)

      // 根據處理方式發送相應通知
      if (status === 'processed' && action !== 'none') {
        await sendActionNotifications(report, action, admin_comment)
      }
    } catch (notificationError) {
      console.error('發送處理通知失敗:', notificationError)
      // 通知失敗不影響檢舉處理
    }

    res.json({
      success: true,
      data: updatedReport,
      error: null,
    })
  } catch (error) {
    await session.abortTransaction()

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

// 批次處理檢舉
export const batchResolveReports = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      data: null,
      error: errors.array(),
    })
  }

  const session = await Report.startSession()
  session.startTransaction()

  try {
    const { ids, status, action, action_meta, admin_comment } = req.body
    const handler_id = req.user._id

    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction()
      return res.status(400).json({
        success: false,
        data: null,
        error: '請提供要處理的檢舉ID列表',
      })
    }

    // 驗證並轉換 ID 為 ObjectId（根據網路搜尋結果的建議）
    const validObjectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    if (validObjectIds.length !== ids.length) {
      await session.abortTransaction()
      return res.status(400).json({
        success: false,
        data: null,
        error: '部分檢舉ID格式無效',
      })
    }

    const updateData = {
      status,
      action,
      action_meta,
      admin_comment,
      handler_id,
    }

    if (status === 'processed' || status === 'rejected') {
      updateData.processed_at = new Date()
    }

    // 使用逐筆等值更新以避免在 _id 上使用 $in 導致的 CastError
    const operations = validObjectIds.map((id) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: updateData },
        upsert: false,
      },
    }))

    const result = await Report.bulkWrite(operations, { session })

    await session.commitTransaction()

    res.json({
      success: true,
      data: {
        updatedCount: result.modifiedCount || 0,
        totalCount: ids.length,
      },
      error: null,
    })
  } catch (error) {
    await session.abortTransaction()

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      })
    }

    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

// 刪除檢舉
export const deleteReport = async (req, res) => {
  const session = await Report.startSession()
  session.startTransaction()

  try {
    const reportId = validateObjectId(req.params.id)
    const report = await Report.findByIdAndDelete(reportId).session(session)
    if (!report) {
      await session.abortTransaction()
      return res.status(404).json({
        success: false,
        data: null,
        error: '檢舉不存在',
      })
    }

    await session.commitTransaction()

    res.json({
      success: true,
      data: { message: '檢舉已刪除' },
      error: null,
    })
  } catch (error) {
    await session.abortTransaction()
    res.status(500).json({
      success: false,
      data: null,
      error: error.message,
    })
  } finally {
    session.endSession()
  }
}

// 取得用戶自己的檢舉統計
export const getUserReportStats = async (req, res) => {
  try {
    const reporter_id = req.user._id

    const [total, pending, processed, rejected] = await Promise.all([
      Report.countDocuments({ reporter_id }),
      Report.countDocuments({ reporter_id, status: 'pending' }),
      Report.countDocuments({ reporter_id, status: 'processed' }),
      Report.countDocuments({ reporter_id, status: 'rejected' }),
    ])

    res.json({
      success: true,
      data: {
        total,
        pending,
        processed,
        rejected,
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
}

// 取得檢舉統計
export const getReportStats = async (req, res) => {
  try {
    const { period = '7d' } = req.query
    let dateFilter = {}

    // 根據期間設定日期篩選
    const now = new Date()
    switch (period) {
      case '1d':
        dateFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }),
        }
        break
      case '7d':
        dateFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }),
        }
        break
      case '30d':
        dateFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }),
        }
        break
      default:
        dateFilter = {
          createdAt: mongoose.trusted({ $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }),
        }
    }

    const [
      totalReports,
      pendingReports,
      processedReports,
      rejectedReports,
      reasonStats,
      targetTypeStats,
    ] = await Promise.all([
      Report.countDocuments(dateFilter),
      Report.countDocuments({ ...dateFilter, status: 'pending' }),
      Report.countDocuments({ ...dateFilter, status: 'processed' }),
      Report.countDocuments({ ...dateFilter, status: 'rejected' }),
      Report.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Report.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$target_type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ])

    res.json({
      success: true,
      data: {
        period,
        totalReports,
        pendingReports,
        processedReports,
        rejectedReports,
        reasonStats,
        targetTypeStats,
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
}

// 取得詳細檢舉統計（用於管理員統計頁面）
export const getDetailedReportStats = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query

    // 基本統計
    const dateQuery =
      startDate && endDate
        ? {
            createdAt: mongoose.trusted({
              $gte: new Date(startDate),
              $lte: new Date(endDate + 'T23:59:59.999Z'),
            }),
          }
        : {}

    const [total, pending, processed, rejected] = await Promise.all([
      Report.countDocuments(dateQuery),
      Report.countDocuments({ ...dateQuery, status: 'pending' }),
      Report.countDocuments({ ...dateQuery, status: 'processed' }),
      Report.countDocuments({ ...dateQuery, status: 'rejected' }),
    ])

    // 類型分佈統計
    const typeDistribution = await Report.aggregate([
      {
        $match:
          startDate && endDate
            ? {
                createdAt: mongoose.trusted({
                  $gte: new Date(startDate),
                  $lte: new Date(endDate + 'T23:59:59.999Z'),
                }),
              }
            : {},
      },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // 狀態分佈統計
    const statusDistribution = await Report.aggregate([
      {
        $match:
          startDate && endDate
            ? {
                createdAt: mongoose.trusted({
                  $gte: new Date(startDate),
                  $lte: new Date(endDate + 'T23:59:59.999Z'),
                }),
              }
            : {},
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // 每日趨勢統計
    let trendData = []
    if (groupBy === 'day' && startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

      trendData = await Report.aggregate([
        {
          $match: {
            createdAt: mongoose.trusted({
              $gte: new Date(startDate),
              $lte: new Date(endDate + 'T23:59:59.999Z'),
            }),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])

      // 填充缺失的日期
      const trendMap = new Map(trendData.map((item) => [item._id, item.count]))
      const filledTrendData = []

      for (let i = 0; i < days; i++) {
        const date = new Date(start)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        filledTrendData.push({
          date: dateStr,
          count: trendMap.get(dateStr) || 0,
        })
      }
      trendData = filledTrendData
    }

    // 近期檢舉列表
    const recentReports = await Report.find(
      startDate && endDate
        ? {
            createdAt: mongoose.trusted({
              $gte: new Date(startDate),
              $lte: new Date(endDate + 'T23:59:59.999Z'),
            }),
          }
        : {},
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('reporter_id', 'username email')
      .populate('handler_id', 'username')
      .lean()

    // 為每個檢舉添加目標資訊
    const reportsWithTargetInfo = await Promise.all(
      recentReports.map(async (report) => {
        let targetInfo = {}
        try {
          switch (report.target_type) {
            case 'meme': {
              const meme = await Meme.findById(report.target_id).select('title author_id')
              if (meme) {
                const author = await User.findById(meme.author_id).select('username')
                targetInfo = {
                  title: meme.title || '無標題',
                  author: author ? author.username : '未知用戶',
                }
              }
              break
            }
            case 'comment': {
              const comment = await Comment.findById(report.target_id).select('content author_id')
              if (comment) {
                const author = await User.findById(comment.author_id).select('username')
                targetInfo = {
                  title:
                    comment.content.substring(0, 50) + (comment.content.length > 50 ? '...' : ''),
                  author: author ? author.username : '未知用戶',
                }
              }
              break
            }
            case 'user': {
              const user = await User.findById(report.target_id).select('username')
              if (user) {
                targetInfo = {
                  title: `用戶: ${user.username}`,
                  author: user.username,
                }
              }
              break
            }
          }
        } catch (error) {
          console.error('獲取目標資訊失敗:', error)
          targetInfo = {
            title: '無法獲取資訊',
            author: '未知',
          }
        }

        return {
          ...report,
          target_info: targetInfo,
        }
      }),
    )

    res.json({
      success: true,
      data: {
        summary: {
          total,
          pending,
          processed,
          rejected,
        },
        typeDistribution: typeDistribution.map((item) => ({
          label: getReasonLabel(item._id),
          value: item._id,
          count: item.count,
        })),
        statusDistribution: statusDistribution.map((item) => ({
          label: getStatusLabel(item._id),
          value: item._id,
          count: item.count,
        })),
        trendData,
        recentReports: reportsWithTargetInfo,
        dateRange: {
          startDate,
          endDate,
        },
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
}

// 輔助函數：獲取檢舉原因標籤
const getReasonLabel = (reason) => {
  const reasonMap = {
    inappropriate: '不當內容',
    hate_speech: '仇恨言論',
    spam: '垃圾訊息',
    copyright: '版權問題',
    other: '其他',
  }
  return reasonMap[reason] || reason
}

// 輔助函數：獲取狀態標籤
const getStatusLabel = (status) => {
  const statusMap = {
    pending: '待處理',
    processed: '已處理',
    rejected: '已駁回',
  }
  return statusMap[status] || status
}

// 根據處理方式發送相應通知
const sendActionNotifications = async (report, action, adminComment) => {
  try {
    let authorId = null
    let contentType = ''

    // 根據目標類型取得作者ID
    switch (report.target_type) {
      case 'meme': {
        const meme = await Meme.findById(report.target_id)
        if (meme) {
          authorId = meme.user_id
          contentType = '迷因'
        }
        break
      }
      case 'comment': {
        const comment = await Comment.findById(report.target_id)
        if (comment) {
          authorId = comment.user_id
          contentType = '留言'
        }
        break
      }
      case 'user': {
        authorId = report.target_id
        contentType = '用戶資料'
        break
      }
    }

    if (!authorId) {
      return
    }

    // 根據處理方式發送相應通知
    switch (action) {
      case 'warn_author': {
        await notifyAuthorWarned(authorId, report._id, adminComment)
        break
      }
      case 'issue_strike': {
        // 這裡可以實作違規點數系統
        const strikeCount = 1 // 暫時設為1，實際應該從用戶資料取得
        await notifyAuthorStruck(authorId, report._id, strikeCount, adminComment)
        break
      }
      case 'remove_content': {
        await notifyContentRemoved(authorId, report._id, contentType, adminComment)
        break
      }
      case 'soft_hide': {
        await notifyContentHidden(authorId, report._id, contentType, adminComment)
        break
      }
      case 'lock_comments': {
        await notifyCommentsLocked(authorId, report._id, adminComment)
        break
      }
    }
  } catch (error) {
    console.error('發送處理方式通知失敗:', error)
  }
}

// 獲取待處理檢舉數量（用於管理員選單 badge 顯示）
export const getPendingCount = async (req, res) => {
  try {
    const count = await Report.countDocuments({ status: 'pending' })

    res.json({
      success: true,
      data: {
        count: count,
      },
      error: null,
    })
  } catch (error) {
    console.error('獲取待處理檢舉數量失敗:', error)
    res.status(500).json({
      success: false,
      data: null,
      error: '獲取待處理檢舉數量失敗',
    })
  }
}
