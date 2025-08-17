import mongoose from 'mongoose'
import validator from 'validator'

const CommentSchema = new mongoose.Schema(
  {
    // 所屬迷因ID
    meme_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      required: [true, '迷因ID為必填欄位'],
      index: true,
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '迷因ID必須是有效的ObjectId',
      },
    },
    // 留言者用戶ID
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '用戶ID為必填欄位'],
      index: true,
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '用戶ID必須是有效的ObjectId',
      },
    },
    // 留言內容
    content: {
      type: String,
      required: [true, '留言內容為必填欄位'],
      trim: true,
      minlength: [1, '留言內容不能為空'],
      maxlength: [2000, '留言內容長度不能超過2000個字元'],
    },
    // 樓中樓回覆目標留言ID（若為主留言則為 null）
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許 null
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '父留言ID必須是有效的ObjectId',
      },
    },
    // 留言狀態（normal/hidden/deleted/banned…）
    status: {
      type: String,
      default: 'normal',
      enum: {
        values: ['normal', 'hidden', 'deleted', 'banned'],
        message: '留言狀態必須是 normal、hidden、deleted 或 banned',
      },
    },
    // 按讚數（快取用）
    like_count: {
      type: Number,
      default: 0,
      min: [0, '按讚數不能為負數'],
    },
    // 噓數（快取用）
    dislike_count: {
      type: Number,
      default: 0,
      min: [0, '噓數不能為負數'],
    },
    // 樓中樓回覆數（快取用）
    reply_count: {
      type: Number,
      default: 0,
      min: [0, '回覆數不能為負數'],
    },
    // 是否軟刪除
    is_deleted: {
      type: Boolean,
      default: false,
    },
    // 軟刪除時間
    deleted_at: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return v instanceof Date && !isNaN(v)
        },
        message: '刪除時間必須是有效的日期',
      },
    },
    // 留言時的IP
    ip: {
      type: String,
      default: '',
      trim: true,
      maxlength: [45, 'IP位址長度不能超過45個字元'],
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isIP(v, 4) || validator.isIP(v, 6)
        },
        message: 'IP位址格式不正確',
      },
    },
    // 彈性資料備用
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          return typeof v === 'object' && v !== null
        },
        message: 'Meta欄位必須是物件',
      },
    },
    // 被提及的用戶名列表
    mentioned_users: [
      {
        type: String,
        trim: true,
        maxlength: [50, '用戶名長度不能超過50字元'],
        validate: {
          validator: function (v) {
            if (!v) return true
            // 驗證用戶名格式（只允許字母、數字、下劃線）
            return /^[a-zA-Z0-9_]+$/.test(v)
          },
          message: '用戶名只能包含字母、數字和下劃線',
        },
      },
    ],
  },
  {
    collection: 'comments',
    timestamps: true,
  },
)

CommentSchema.pre('save', function (next) {
  this.updated_at = new Date()
  next()
})

// 自定義驗證：檢查業務邏輯
CommentSchema.pre('validate', function (next) {
  const errors = []

  // 檢查刪除邏輯
  if (this.is_deleted && !this.deleted_at) {
    errors.push('軟刪除時必須設定刪除時間')
  }

  if (!this.is_deleted && this.deleted_at) {
    errors.push('未刪除時不能設定刪除時間')
  }

  // 檢查時間邏輯
  if (this.deleted_at && this.created_at && this.deleted_at < this.created_at) {
    errors.push('刪除時間不能早於創建時間')
  }

  // 檢查狀態邏輯
  if (this.status === 'deleted' && !this.is_deleted) {
    errors.push('狀態為deleted時，is_deleted必須為true')
  }

  if (errors.length > 0) {
    return next(new Error(errors.join(', ')))
  }

  next()
})

export default mongoose.models.Comment || mongoose.model('Comment', CommentSchema)
