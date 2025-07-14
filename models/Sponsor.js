import mongoose from 'mongoose'
import validator from 'validator'

const SponsorSchema = new mongoose.Schema(
  {
    // 贊助用戶ID
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '用戶ID為必填'],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '用戶ID必須是有效的ObjectId',
      },
    },
    // 贊助狀態（pending: 待支付, success: 完成, failed: 失敗, refunded: 已退款）
    status: {
      type: String,
      default: 'pending',
      enum: {
        values: ['pending', 'success', 'failed', 'refunded'],
        message: '狀態必須是 pending、success、failed、refunded',
      },
    },
    // 金額
    amount: {
      type: Number,
      required: [true, '金額為必填'],
      min: [1, '金額必須大於0'],
      max: [1000000, '金額過大'],
    },
    // 留言給站方/留言給被贊助人
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, '留言長度不能超過1000字'],
    },
    // 支付方式（如linepay, credit_card, paypal等）
    payment_method: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, '支付方式長度不能超過50字'],
    },
    // 第三方金流訂單號
    transaction_id: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '訂單號長度不能超過100字'],
    },
    // 下單時IP
    created_ip: {
      type: String,
      default: '',
      trim: true,
      maxlength: [45, 'IP位址長度不能超過45字'],
      validate: {
        validator: (v) => !v || validator.isIP(v, 4) || validator.isIP(v, 6),
        message: 'IP位址格式不正確',
      },
    },
  },
  {
    collection: 'sponsors',
    timestamps: true,
    versionKey: false,
  },
)

export default mongoose.model('Sponsor', SponsorSchema)
