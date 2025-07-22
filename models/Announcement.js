import mongoose from 'mongoose'

const AnnouncementSchema = new mongoose.Schema(
  {
    // 公告標題
    title: {
      type: String,
      required: [true, '公告標題為必填'],
      trim: true,
      minlength: [1, '公告標題不能為空'],
      maxlength: [200, '公告標題長度不能超過200字'],
    },
    // 公告內容（可存文字或HTML）
    content: {
      type: String,
      required: [true, '公告內容為必填'],
      trim: true,
      minlength: [1, '公告內容不能為空'],
      maxlength: [5000, '公告內容長度不能超過5000字'],
    },
    // 發布者 user id
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '發布者ID為必填'],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '發布者ID必須是有效的ObjectId',
      },
    },
    // 公告狀態（draft: 草稿, public: 已發佈, hidden: 隱藏, deleted: 已刪除）
    status: {
      type: String,
      default: 'draft',
      enum: {
        values: ['draft', 'public', 'hidden', 'deleted'],
        message: '公告狀態必須是 draft、public、hidden、deleted',
      },
    },
    // 是否置頂
    pinned: {
      type: Boolean,
      default: false,
    },
    // 預約上架時間
    visible_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '上架時間必須是有效日期',
      },
    },
    // 自動下架時間
    expired_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '下架時間必須是有效日期',
      },
    },
    // 分類（如系統、活動、更新…）
    category: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, '分類長度不能超過50字'],
      enum: {
        values: ['system', 'activity', 'update', 'other'],
        message: '分類必須是 system、activity、update、other',
      },
    },
  },
  {
    collection: 'announcements',
    timestamps: true,
  },
)

export default mongoose.model('Announcement', AnnouncementSchema)
