import mongoose from 'mongoose'

const NotificationReceiptSchema = new mongoose.Schema(
  {
    // 對應的通知事件ID
    notification_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: [true, '通知事件ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '通知事件ID必須是有效的ObjectId',
      },
    },
    // 收件者ID
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '收件者ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '收件者ID必須是有效的ObjectId',
      },
    },
    // 已讀時間
    read_at: {
      type: Date,
      default: null,
    },
    // 使用者刪除/隱藏時間（軟刪）
    deleted_at: {
      type: Date,
      default: null,
    },
    // 封存時間
    archived_at: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'notification_receipts',
    timestamps: true,
    versionKey: false,
  },
)

// 複合索引優化查詢
NotificationReceiptSchema.index({ user_id: 1, deleted_at: 1, createdAt: -1 })
NotificationReceiptSchema.index({ notification_id: 1, user_id: 1 }, { unique: true })
NotificationReceiptSchema.index({ user_id: 1, read_at: 1 })
NotificationReceiptSchema.index({ user_id: 1, archived_at: 1 })

// 虛擬欄位：是否已讀
NotificationReceiptSchema.virtual('isRead').get(function () {
  return this.read_at !== null
})

// 虛擬欄位：是否已刪除
NotificationReceiptSchema.virtual('isDeleted').get(function () {
  return this.deleted_at !== null
})

// 虛擬欄位：是否已封存
NotificationReceiptSchema.virtual('isArchived').get(function () {
  return this.archived_at !== null
})

// 確保虛擬欄位在 JSON 序列化時包含
NotificationReceiptSchema.set('toJSON', { virtuals: true })
NotificationReceiptSchema.set('toObject', { virtuals: true })

export default mongoose.models.NotificationReceipt ||
  mongoose.model('NotificationReceipt', NotificationReceiptSchema)
