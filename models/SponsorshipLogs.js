import mongoose from 'mongoose'

const SponsorshipLogsSchema = new mongoose.Schema(
  {
    sponsor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sponsor',
      required: [true, '贊助記錄ID為必填'],
    },
    message_id: {
      type: String,
      default: '',
      comment: 'Ko-fi message_id (防重複處理)',
    },
    transaction_id: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '交易ID長度不能超過100字'],
    },
    direct_link_code: {
      type: String,
      default: '',
      comment: '用於追蹤商品類型',
    },
    amount: {
      type: Number,
      required: [true, '金額為必填'],
      min: [1, '金額必須大於0'],
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: [10, '貨幣代碼長度不能超過10字'],
    },
    type: {
      type: String,
      default: 'Shop Order',
      trim: true,
      maxlength: [50, '類型長度不能超過50字'],
    },
    status: {
      type: String,
      default: 'pending',
      enum: {
        values: ['pending', 'processed', 'failed'],
        message: '狀態必須是 pending、processed、failed',
      },
    },
    webhook_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      comment: '完整的 webhook 數據',
    },
    processed_at: {
      type: Date,
      default: null,
    },
    retry_count: {
      type: Number,
      default: 0,
      comment: '重試次數',
    },
    error_message: {
      type: String,
      default: '',
      maxlength: [500, '錯誤訊息長度不能超過500字'],
    },
  },
  {
    collection: 'sponsorship_logs',
    timestamps: true,
    versionKey: false,
  },
)

// 資料庫索引
SponsorshipLogsSchema.index({ message_id: 1 }, { unique: true }) // 防重複處理
SponsorshipLogsSchema.index({ sponsor_id: 1 }) // 贊助記錄關聯查詢
SponsorshipLogsSchema.index({ transaction_id: 1 }) // 交易ID查詢
SponsorshipLogsSchema.index({ direct_link_code: 1 }) // 商品類型查詢
SponsorshipLogsSchema.index({ status: 1, createdAt: -1 }) // 狀態查詢
SponsorshipLogsSchema.index({ processed_at: 1 }) // 處理時間查詢

export default mongoose.models.SponsorshipLogs ||
  mongoose.model('SponsorshipLogs', SponsorshipLogsSchema)
