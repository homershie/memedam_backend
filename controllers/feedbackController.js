import axios from 'axios'
import crypto from 'crypto'
import Feedback from '../models/Feedback.js'
import { logger } from '../utils/logger.js'

// reCAPTCHA 驗證函數
const verifyRecaptcha = async (recaptchaToken) => {
  try {
    console.log('🔍 reCAPTCHA 驗證開始...')
    console.log('📝 收到的 token:', recaptchaToken ? '已提供' : '未提供')
    console.log('🔑 是否有 SECRET_KEY:', !!process.env.RECAPTCHA_SECRET_KEY)
    console.log('🌍 當前環境:', process.env.NODE_ENV || 'development')

    // 檢查是否有設定 reCAPTCHA 密鑰
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.error('❌ reCAPTCHA 密鑰未設定，無法進行驗證')
      return false
    }

    // 檢查是否有提供 token
    if (!recaptchaToken) {
      console.error('❌ 未提供 reCAPTCHA token')
      return false
    }

    console.log('🌐 開始向 Google reCAPTCHA API 發送驗證請求...')
    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: recaptchaToken,
      },
    })

    console.log('📊 Google API 回應:', response.data)
    const isValid = response.data.success
    console.log('✅ reCAPTCHA 驗證結果:', isValid)

    return isValid
  } catch (error) {
    console.error('❌ reCAPTCHA 驗證錯誤:', error)
    console.error('🔍 錯誤詳情:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    })
    return false
  }
}

// 提交意見
export const submitFeedback = async (req, res) => {
  try {
    // 驗證使用者是否已登入
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: '請先登入才能提交意見',
      })
    }

    const { title, message, category, recaptchaToken } = req.body

    // 驗證必填欄位
    if (!title || !message || !category || !recaptchaToken) {
      return res.status(400).json({
        success: false,
        message: '所有欄位都必須填寫，包括 reCAPTCHA 驗證',
      })
    }

    // 驗證欄位長度
    if (title.length < 5 || title.length > 200) {
      return res.status(400).json({
        success: false,
        message: '標題長度必須在 5-200 個字元之間',
      })
    }

    if (message.length < 10 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: '訊息內容長度必須在 10-2000 個字元之間',
      })
    }

    // 驗證分類
    const validCategories = ['suggestion', 'bug', 'content', 'feature', 'other']
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: '無效的分類',
      })
    }

    // 過濾惡意字串（簡單檢查）
    const maliciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i, /eval\(/i]
    const combinedText = title + ' ' + message
    if (maliciousPatterns.some((pattern) => pattern.test(combinedText))) {
      return res.status(400).json({
        success: false,
        message: '內容包含不允許的字元，請檢查後重新提交',
      })
    }

    // 驗證 reCAPTCHA
    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken)
    if (!isRecaptchaValid) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA 驗證失敗，請重新驗證',
      })
    }

    // 產生 IP hash
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']
    const ipHash = crypto
      .createHash('sha256')
      .update(clientIp + process.env.IP_SALT || 'default-salt')
      .digest('hex')

    // 建立新的意見記錄
    const feedback = new Feedback({
      userId: req.user._id,
      email: req.user.email,
      title,
      message,
      category,
      userAgent: req.headers['user-agent'],
      ipHash,
    })

    await feedback.save()

    // 記錄事件到 logService
    logger.info('feedback_submitted', {
      userId: req.user._id,
      category,
      titleLength: title.length,
      messageLength: message.length,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    })

    res.status(201).json({
      success: true,
      message: '意見已成功提交，感謝您的回饋！',
      feedbackId: feedback._id,
    })
  } catch (error) {
    logger.error('提交意見錯誤:', error)
    res.status(500).json({
      success: false,
      message: '提交意見時發生錯誤，請稍後再試',
    })
  }
}

// 取得意見列表 (管理員用)
export const getFeedbacks = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query
    const skip = (page - 1) * limit

    // 正規化輸入，將『全部』/ 'all' / 空字串 視為未篩選（參考 memeController.js 的做法）
    const normalizeAll = (val) => {
      if (val === undefined || val === null) return ''
      const v = String(val).trim()
      if (
        v === '' ||
        v.toLowerCase() === 'all' ||
        v === '全部' ||
        v === '全部狀態' ||
        v === '全部分類' ||
        v === '全部類型' ||
        v === '全部種類'
      )
        return ''
      return v
    }

    const statusVal = normalizeAll(status)
    const categoryVal = normalizeAll(category)

    let query = {}

    // 只有非空值才添加到查詢條件中
    if (statusVal !== '') {
      query.status = statusVal
    }
    if (categoryVal !== '') {
      query.category = categoryVal
    }

    const feedbacks = await Feedback.find(query)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await Feedback.countDocuments(query)

    res.json({
      success: true,
      data: feedbacks,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    logger.error('取得意見列表錯誤:', error)
    res.status(500).json({
      success: false,
      message: '取得意見列表時發生錯誤',
    })
  }
}

// 更新意見狀態 (管理員用)
export const updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, adminResponse } = req.body

    const feedback = await Feedback.findById(id)
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的意見',
      })
    }

    feedback.status = status
    if (adminResponse) {
      feedback.adminResponse = adminResponse
      feedback.respondedAt = new Date()
    }

    await feedback.save()

    res.json({
      success: true,
      message: '意見狀態已更新',
      data: feedback,
    })
  } catch (error) {
    logger.error('更新意見狀態錯誤:', error)
    res.status(500).json({
      success: false,
      message: '更新意見狀態時發生錯誤',
    })
  }
}
