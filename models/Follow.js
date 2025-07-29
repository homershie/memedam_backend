import mongoose from 'mongoose'
import validator from 'validator'

const FollowSchema = new mongoose.Schema(
  {
    // 追隨者的用戶ID
    follower_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '追隨者ID為必填欄位'],
      index: true,
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '追隨者ID必須是有效的ObjectId',
      },
    },
    // 被追隨者的用戶ID
    following_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '被追隨者ID為必填欄位'],
      index: true,
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '被追隨者ID必須是有效的ObjectId',
      },
    },
    // 追隨時的IP地址（防刷、統計用）
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
    // 操作裝置資訊
    user_agent: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'User Agent長度不能超過500個字元'],
    },
    // 來源平台細節
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
    // 追隨狀態（預留給未來功能，如靜音追隨等）
    status: {
      type: String,
      default: 'active',
      enum: {
        values: ['active', 'muted', 'blocked'],
        message: '追隨狀態必須是 active、muted 或 blocked',
      },
    },
  },
  {
    collection: 'follows',
    timestamps: true,
    versionKey: false,
  },
)

// 建立複合索引，確保每對用戶只能有一個追隨關係
FollowSchema.index({ follower_id: 1, following_id: 1 }, { unique: true })

// 自動維護 updated_at
FollowSchema.pre('save', function (next) {
  this.updated_at = new Date()
  next()
})

// 自定義驗證：確保用戶不能追隨自己
FollowSchema.pre('validate', function (next) {
  if (this.follower_id && this.following_id && this.follower_id.equals(this.following_id)) {
    return next(new Error('用戶不能追隨自己'))
  }

  // 檢查是否已存在相同的追隨關係（僅在新建時檢查）
  if (this.isNew) {
    this.constructor
      .findOne({
        follower_id: this.follower_id,
        following_id: this.following_id,
      })
      .then((existingFollow) => {
        if (existingFollow) {
          return next(new Error('已經追隨過這個用戶'))
        }
        next()
      })
      .catch((err) => next(err))
  } else {
    next()
  }
})

export default mongoose.model('Follow', FollowSchema)
