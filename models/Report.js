import mongoose from 'mongoose'

const ReportSchema = new mongoose.Schema(
  {
    // 檢舉者ID（必填）
    reporter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '檢舉者ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '檢舉者ID必須是有效的ObjectId',
      },
    },

    // 檢舉目標類型（必填）
    target_type: {
      type: String,
      required: [true, '檢舉目標類型為必填'],
      enum: {
        values: ['meme', 'comment', 'user'],
        message: '檢舉目標類型必須是 meme、comment 或 user',
      },
      default: 'meme',
    },

    // 檢舉目標ID（必填）
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, '檢舉目標ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '檢舉目標ID必須是有效的ObjectId',
      },
    },

    // 檢舉原因（必填）
    reason: {
      type: String,
      required: [true, '檢舉原因為必填'],
      enum: {
        values: ['inappropriate', 'hate_speech', 'spam', 'copyright', 'other'],
        message: '檢舉原因必須是 inappropriate、hate_speech、spam、copyright 或 other',
      },
    },

    // 詳細描述
    description: {
      type: String,
      maxlength: [1000, '詳細描述長度不能超過1000字'],
      trim: true,
    },

    // 檢舉狀態
    status: {
      type: String,
      default: 'pending',
      enum: {
        values: ['pending', 'processed', 'rejected'],
        message: '狀態必須是 pending、processed 或 rejected',
      },
    },

    // V2 新增：處理方式
    action: {
      type: String,
      enum: {
        values: [
          'none',
          'remove_content',
          'soft_hide',
          'age_gate',
          'mark_nsfw',
          'lock_comments',
          'issue_strike',
          'warn_author',
        ],
        message: '處理方式必須是有效的選項',
      },
      default: 'none',
    },

    // V2 新增：處理方式詳細資訊
    action_meta: {
      type: Object,
      default: {},
    },

    // 管理員處理備註
    admin_comment: {
      type: String,
      maxlength: [1000, '管理員備註長度不能超過1000字'],
      trim: true,
    },

    // 處理時間
    processed_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '處理時間必須是有效日期',
      },
    },

    // 處理人員ID
    handler_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: (v) => !v || mongoose.Types.ObjectId.isValid(v),
        message: '處理人員ID必須是有效的ObjectId',
      },
    },
  },
  {
    collection: 'reports',
    timestamps: true,
  },
)

// 防止重複檢舉的唯一索引
ReportSchema.index({ reporter_id: 1, target_type: 1, target_id: 1 }, { unique: true })

// 群組化查詢索引
ReportSchema.index({ target_type: 1, target_id: 1, status: 1, createdAt: -1 })

// 用戶檢舉歷史查詢
ReportSchema.index({ reporter_id: 1, createdAt: -1 })

// 管理員篩選查詢
ReportSchema.index({ status: 1, createdAt: -1 })

// 處理時間查詢
ReportSchema.index({ processed_at: -1 })

export default mongoose.models.Report || mongoose.model('Report', ReportSchema)
