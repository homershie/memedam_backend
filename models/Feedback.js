import mongoose from 'mongoose'

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '使用者 ID 為必填欄位'],
    },
    email: {
      type: String,
      required: [true, '電子郵件為必填欄位'],
      trim: true,
      lowercase: true,
      maxlength: [255, '電子郵件不能超過 255 個字元'],
    },
    title: {
      type: String,
      required: [true, '標題為必填欄位'],
      trim: true,
      minlength: [5, '標題至少需要 5 個字元'],
      maxlength: [200, '標題不能超過 200 個字元'],
    },
    message: {
      type: String,
      required: [true, '訊息內容為必填欄位'],
      trim: true,
      minlength: [10, '訊息內容至少需要 10 個字元'],
      maxlength: [2000, '訊息內容不能超過 2000 個字元'],
    },
    category: {
      type: String,
      required: [true, '分類為必填欄位'],
      enum: ['suggestion', 'bug', 'content', 'feature', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'closed'],
      default: 'pending',
    },
    adminResponse: {
      type: String,
      trim: true,
      maxlength: [2000, '管理員回覆不能超過 2000 個字元'],
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipHash: {
      type: String,
      trim: true,
    },
    respondedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

// 建立索引
feedbackSchema.index({ userId: 1, createdAt: -1 })
feedbackSchema.index({ status: 1, createdAt: -1 })
feedbackSchema.index({ category: 1, createdAt: -1 })
feedbackSchema.index({ createdAt: -1 })

// 虛擬欄位：狀態中文名稱
feedbackSchema.virtual('statusText').get(function () {
  const statusMap = {
    pending: '待處理',
    in_progress: '處理中',
    resolved: '已解決',
    closed: '已關閉',
  }
  return statusMap[this.status] || this.status
})

// 虛擬欄位：分類中文名稱
feedbackSchema.virtual('categoryText').get(function () {
  const categoryMap = {
    suggestion: '建議',
    bug: '錯誤回報',
    content: '內容問題',
    feature: '功能請求',
    other: '其他',
  }
  return categoryMap[this.category] || this.category
})

// 確保虛擬欄位在 JSON 序列化時包含
feedbackSchema.set('toJSON', { virtuals: true })
feedbackSchema.set('toObject', { virtuals: true })

export default mongoose.model('Feedback', feedbackSchema)
