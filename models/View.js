import mongoose from 'mongoose'
import validator from 'validator'

const ViewSchema = new mongoose.Schema(
  {
    // 瀏覽的迷因ID
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
    // 瀏覽的用戶ID（可選，未登入用戶為空）
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '用戶ID必須是有效的ObjectId',
      },
    },
    // 用戶當時的IP（防刷、統計）
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
    // 操作裝置資訊（統計、異常偵測）
    user_agent: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'User Agent長度不能超過500個字元'],
    },
    // 來源平台細節（web/android/ios/小程式…）
    platform_detail: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '平台細節長度不能超過100個字元'],
      enum: {
        values: ['web', 'android', 'ios', 'miniprogram', ''],
        message: '平台細節必須是 web、android、ios、miniprogram 或空值',
      },
    },
    // 瀏覽來源（direct/search/social/referral）
    referrer: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, '來源網址長度不能超過500個字元'],
    },
    // 瀏覽時間長度（秒）
    duration: {
      type: Number,
      default: 0,
      min: [0, '瀏覽時間不能為負數'],
    },
    // 是否為重複瀏覽（同一用戶短時間內）
    is_duplicate: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'views',
    timestamps: true,
    versionKey: false,
  },
)

// 複合索引：防止同一用戶短時間內重複瀏覽同一迷因
ViewSchema.index({ meme_id: 1, user_id: 1, ip: 1 }, { unique: false })

// 複合索引：用於統計查詢
ViewSchema.index({ meme_id: 1, createdAt: -1 })
ViewSchema.index({ user_id: 1, createdAt: -1 })

// 自動更新 updated_at 欄位
ViewSchema.pre('save', function (next) {
  this.updated_at = new Date()
  next()
})

export default mongoose.model('View', ViewSchema)
