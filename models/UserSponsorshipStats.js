import mongoose from 'mongoose'

const UserSponsorshipStatsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '用戶ID為必填'],
      unique: true, // 每個用戶只能有一條統計記錄
    },
    total_amount: {
      type: Number,
      default: 0,
      min: [0, '總金額不能為負數'],
    },
    total_count: {
      type: Number,
      default: 0,
      min: [0, '總次數不能為負數'],
    },
    sponsor_level: {
      type: String,
      default: 'soy',
      enum: {
        values: ['soy', 'chicken', 'coffee'],
        message: '贊助等級必須是 soy、chicken、coffee',
      },
      comment: '最高贊助等級',
    },
    badge_earned: {
      type: Boolean,
      default: false,
    },
    last_sponsorship_at: {
      type: Date,
      default: null,
    },
    // 按等級統計
    level_stats: {
      soy: {
        count: { type: Number, default: 0 },
        total_amount: { type: Number, default: 0 },
        last_at: { type: Date, default: null },
      },
      chicken: {
        count: { type: Number, default: 0 },
        total_amount: { type: Number, default: 0 },
        last_at: { type: Date, default: null },
      },
      coffee: {
        count: { type: Number, default: 0 },
        total_amount: { type: Number, default: 0 },
        last_at: { type: Date, default: null },
      },
    },
    // 按貨幣統計
    currency_stats: {
      type: Map,
      of: {
        total_amount: { type: Number, default: 0 },
        count: { type: Number, default: 0 },
      },
      default: {},
      comment: '按貨幣類型的統計數據',
    },
  },
  {
    collection: 'user_sponsorship_stats',
    timestamps: true,
    versionKey: false,
  },
)

// 資料庫索引
UserSponsorshipStatsSchema.index({ user_id: 1 }, { unique: true }) // 用戶唯一索引
UserSponsorshipStatsSchema.index({ sponsor_level: 1 }) // 等級查詢索引
UserSponsorshipStatsSchema.index({ badge_earned: 1 }) // 徽章狀態查詢索引
UserSponsorshipStatsSchema.index({ last_sponsorship_at: -1 }) // 最後贊助時間查詢索引
UserSponsorshipStatsSchema.index({ total_amount: -1 }) // 總金額排序索引
UserSponsorshipStatsSchema.index({ total_count: -1 }) // 總次數排序索引

export default mongoose.models.UserSponsorshipStats ||
  mongoose.model('UserSponsorshipStats', UserSponsorshipStatsSchema)
