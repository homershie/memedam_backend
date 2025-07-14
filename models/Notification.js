import mongoose from 'mongoose'
import validator from 'validator'

const NotificationSchema = new mongoose.Schema(
  {
    // 被通知的用戶ID
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '用戶ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '用戶ID必須是有效的ObjectId',
      },
    },
    // 通知重要性（數字越大越重要，預設0）
    priority: {
      type: Number,
      default: 0,
      min: [0, '通知重要性不能為負數'],
      max: [10, '通知重要性不能超過10'],
    },
    // 通知類型（如：system, comment, audit, mention, like...）
    type: {
      type: String,
      required: [true, '通知類型為必填'],
      trim: true,
      maxlength: [50, '通知類型長度不能超過50字'],
    },
    // 狀態（unread: 未讀, read: 已讀, deleted: 已刪除）
    status: {
      type: String,
      default: 'unread',
      enum: {
        values: ['unread', 'read', 'deleted'],
        message: '狀態必須是 unread、read、deleted',
      },
    },
    // 通知內容（可為文字、HTML 或 JSON 字串）
    content: {
      type: String,
      required: [true, '通知內容為必填'],
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
        validator: (v) =>
          !v || validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }),
        message: '連結必須是有效的URL',
      },
    },
    // 是否已讀
    is_read: {
      type: Boolean,
      default: false,
    },
    // 過期時間，超過後前端可自動隱藏
    expire_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '過期時間必須是有效日期',
      },
    },
    // 彈性結構，如附帶的參數
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: (v) => typeof v === 'object' && v !== null,
        message: 'Meta欄位必須是物件',
      },
    },
  },
  {
    collection: 'notifications',
    timestamps: true,
    versionKey: false,
  },
)

export default mongoose.model('Notification', NotificationSchema)
