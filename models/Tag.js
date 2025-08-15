import mongoose from 'mongoose'

const TagSchema = new mongoose.Schema(
  {
    // 標籤名稱
    name: {
      type: String,
      required: [true, '標籤名稱為必填'],
      index: true,
      trim: true,
      minlength: [1, '標籤名稱不能為空'],
      maxlength: [50, '標籤名稱長度不能超過50字'],
    },
    // URL 友好的 slug
    slug: {
      type: String,
      trim: true,
      sparse: true, // 允許 null/undefined 值，但確保唯一性
    },
    // 語言（如zh, en…）
    lang: {
      type: String,
      default: 'zh',
      enum: {
        values: ['zh', 'en', 'ja', 'ko'],
        message: '語言必須是 zh、en、ja、ko',
      },
    },
    // 標籤狀態
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
    },
    // 別名（用於搜尋）
    aliases: [
      {
        type: String,
        trim: true,
      },
    ],
    // 使用次數統計
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: 'tags',
    timestamps: true,
    versionKey: false,
  },
)

// 建立複合唯一索引：同一語言下 slug 必須唯一
TagSchema.index(
  { lang: 1, slug: 1 },
  {
    unique: true,
    sparse: true, // 允許 null/undefined 值
    partialFilterExpression: { slug: { $exists: true, $ne: null } },
  },
)

// 在儲存前自動產生 slug（若未提供）
TagSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = String(this.name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')

    // 如果 slug 變成空字串，設為 undefined 讓 sparse index 忽略
    if (this.slug === '') {
      this.slug = undefined
    }
  }
  next()
})

export default mongoose.model('Tag', TagSchema)
