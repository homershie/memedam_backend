import mongoose from 'mongoose'

const VerificationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['email_verification', 'password_reset'],
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL 索引，自動刪除過期文檔
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'verification_tokens',
  },
)

// 確保 token 在過期後自動刪除
VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// 防止重複使用
VerificationTokenSchema.index({ token: 1, used: 1 })

export default mongoose.model('VerificationToken', VerificationTokenSchema)
