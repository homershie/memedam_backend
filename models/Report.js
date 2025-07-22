import mongoose from 'mongoose'

const ReportSchema = new mongoose.Schema(
  {
    // 檢舉人 user id
    reporter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '檢舉人ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '檢舉人ID必須是有效的ObjectId',
      },
    },
    // 被處罰的用戶 id（如果檢舉成立）
    punished_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: (v) => !v || mongoose.Types.ObjectId.isValid(v),
        message: '被處罰用戶ID必須是有效的ObjectId',
      },
    },
    // 是否匿名檢舉
    is_anonymous: {
      type: Boolean,
      default: false,
    },
    // 檢舉對象類型（meme/comment...）
    target_type: {
      type: String,
      required: [true, '檢舉對象類型為必填'],
      enum: {
        values: ['user', 'meme', 'comment', 'other'],
        message: '檢舉對象類型必須是 user、meme、comment 或 other',
      },
    },
    // 檢舉目標的 id
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, '檢舉目標ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '檢舉目標ID必須是有效的ObjectId',
      },
    },
    // 檢舉理由
    reason: {
      type: String,
      required: [true, '檢舉理由為必填'],
      trim: true,
      minlength: [1, '檢舉理由不能為空'],
      maxlength: [1000, '檢舉理由長度不能超過1000字'],
    },
    // 附加證據（如圖片網址、json、敘述等）
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (v) => typeof v === 'object' && v !== null,
        message: '證據欄位必須是物件',
      },
    },
    // 檢舉狀態（pending:待處理, resolved:已處理, rejected:不成立）
    status: {
      type: String,
      default: 'pending',
      enum: {
        values: ['pending', 'resolved', 'rejected'],
        message: '狀態必須是 pending、resolved、rejected',
      },
    },
    // 管理員處理方式（如刪除/保留/封鎖）
    action: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '處理方式長度不能超過100字'],
    },
    // 處理時間
    handled_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '處理時間必須是有效日期',
      },
    },
    // 處理人員 user id
    handler_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: (v) => !v || mongoose.Types.ObjectId.isValid(v),
        message: '處理人員ID必須是有效的ObjectId',
      },
    },
    // 處理結果/備註
    result: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, '處理結果長度不能超過1000字'],
    },
  },
  {
    collection: 'reports',
    timestamps: true,
  },
)

export default mongoose.model('Report', ReportSchema)
