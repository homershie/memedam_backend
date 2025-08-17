import mongoose from 'mongoose'
import validator from 'validator'

const ShareSchema = new mongoose.Schema(
  {
    // 分享的用戶ID
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
    // 分享的迷因ID
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
    // 分享的來源平台（如 facebook/line/copylink…）
    platform_detail: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '平台細節長度不能超過100個字元'],
      enum: {
        values: [
          'facebook',
          'line',
          'twitter',
          'instagram',
          'threads',
          'copylink',
          'whatsapp',
          'telegram',
          '',
        ],
        message:
          '平台細節必須是 facebook、line、twitter、instagram、threads、copylink、whatsapp、telegram 或空值',
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
  },
  {
    collection: 'shares',
    timestamps: true,
    versionKey: false,
  },
)

export default mongoose.models.Share || mongoose.model('Share', ShareSchema)
