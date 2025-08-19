import mongoose from 'mongoose'
import validator from 'validator'

const NotificationSchema = new mongoose.Schema(
  {
    // 觸發者ID（誰做了這個動作）
    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '觸發者ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '觸發者ID必須是有效的ObjectId',
      },
    },
    // 動作類型（follow, like, comment, mention, system, announcement）
    verb: {
      type: String,
      required: [true, '動作類型為必填'],
      trim: true,
      maxlength: [50, '動作類型長度不能超過50字'],
      enum: {
        values: [
          'follow',
          'like',
          'comment',
          'mention',
          'system',
          'announcement',
          'share',
          'report',
        ],
        message: '動作類型必須是有效的類型',
      },
    },
    // 物件類型（post, comment, user, meme）
    object_type: {
      type: String,
      required: [true, '物件類型為必填'],
      trim: true,
      maxlength: [50, '物件類型長度不能超過50字'],
      enum: {
        values: ['post', 'comment', 'user', 'meme', 'collection'],
        message: '物件類型必須是有效的類型',
      },
    },
    // 物件ID
    object_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, '物件ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '物件ID必須是有效的ObjectId',
      },
    },
    // 額外資料（彈性結構）
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (v) => typeof v === 'object' && v !== null,
        message: 'Payload欄位必須是物件',
      },
    },
    // 系統通知標題（用於顯示）
    title: {
      type: String,
      trim: true,
      maxlength: [100, '通知標題長度不能超過100字'],
    },
    // 系統通知內容
    content: {
      type: String,
      trim: true,
      maxlength: [2000, '通知內容長度不能超過2000字'],
    },
    // 點擊跳轉連結
    url: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, '連結長度不能超過500字'],
      validate: {
        validator: (v) => {
          if (!v) return true
          // 允許 localhost URL
          if (v.includes('localhost')) {
            return /^https?:\/\/localhost(:\d+)?(\/.*)?$/.test(v)
          }
          // 其他 URL 使用標準驗證
          return validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true })
        },
        message: '連結必須是有效的URL',
      },
    },
    // 操作按鈕文字
    action_text: {
      type: String,
      default: '查看',
      trim: true,
      maxlength: [20, '操作按鈕文字不能超過20字'],
    },
    // 過期時間，超過後前端可自動隱藏
    expire_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '過期時間必須是有效日期',
      },
    },
  },
  {
    collection: 'notifications',
    timestamps: true,
    versionKey: false,
  },
)

// 複合索引優化查詢
NotificationSchema.index({ actor_id: 1, verb: 1, object_type: 1, object_id: 1 })
NotificationSchema.index({ createdAt: -1 })

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema)
