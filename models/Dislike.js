import mongoose from 'mongoose'
import validator from 'validator'

const DislikeSchema = new mongoose.Schema(
  {
    // 按噓的用戶ID
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
    // 按噓的迷因ID
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
    user_agent: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'User Agent長度不能超過500個字元'],
    },
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
  },
  {
    collection: 'dislikes',
    timestamps: true,
    versionKey: false,
  },
)

DislikeSchema.pre('save', function (next) {
  this.updated_at = new Date()
  next()
})

// 自定義驗證：確保用戶不能重複按噓同一個迷因
DislikeSchema.pre('validate', function (next) {
  if (this.isNew) {
    // 檢查是否已存在相同的 user_id 和 meme_id 組合
    this.constructor
      .findOne({
        user_id: this.user_id,
        meme_id: this.meme_id,
      })
      .then((existingDislike) => {
        if (existingDislike) {
          return next(new Error('用戶已經按噓過這個迷因'))
        }
        next()
      })
      .catch((err) => next(err))
  } else {
    next()
  }
})

export default mongoose.models.Dislike || mongoose.model('Dislike', DislikeSchema)
