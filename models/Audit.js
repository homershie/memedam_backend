import mongoose from 'mongoose'
import validator from 'validator'

const AuditSchema = new mongoose.Schema(
  {
    // 被審核的迷因ID
    meme_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      required: [true, '迷因ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '迷因ID必須是有效的ObjectId',
      },
    },
    // 審核人員ID
    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '審核人員ID為必填'],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '審核人員ID必須是有效的ObjectId',
      },
    },
    // 審核狀態（approved:通過, rejected:退回, pending:待審, deleted:刪除）
    status: {
      type: String,
      required: [true, '審核狀態為必填'],
      enum: {
        values: ['pending', 'approved', 'rejected', 'deleted'],
        message: '審核狀態必須是 pending、approved、rejected、deleted',
      },
      default: 'pending',
    },
    // 前一個狀態（如自動記錄審核流程）
    previous_status: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, '前一個狀態長度不能超過50字'],
    },
    // 審核備註／理由
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, '審核備註長度不能超過1000字'],
    },
    // 完成審核時間
    audit_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '審核時間必須是有效日期',
      },
    },
    // 操作時IP
    audit_ip: {
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
    collection: 'audits',
    timestamps: true,
    versionKey: false,
  },
)

export default mongoose.model('Audit', AuditSchema)
