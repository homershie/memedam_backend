import mongoose from 'mongoose'

const RecommendationMetricsSchema = new mongoose.Schema(
  {
    // 基本資訊
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    meme_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      required: true,
      index: true,
    },

    // 推薦演算法資訊
    algorithm: {
      type: String,
      required: true,
      enum: [
        'hot',
        'latest',
        'content-based',
        'collaborative-filtering',
        'social-collaborative-filtering',
        'mixed',
        'tag-based',
        'similar',
        'user-interest',
      ],
      index: true,
    },

    // A/B 測試資訊
    ab_test_id: {
      type: String,
      default: null,
      index: true,
    },
    ab_test_variant: {
      type: String,
      enum: ['A', 'B', 'control'],
      default: null,
    },

    // 推薦分數和排名
    recommendation_score: {
      type: Number,
      required: true,
    },
    recommendation_rank: {
      type: Number,
      required: true,
    },

    // 用戶互動指標
    is_clicked: {
      type: Boolean,
      default: false,
    },
    is_liked: {
      type: Boolean,
      default: false,
    },
    is_shared: {
      type: Boolean,
      default: false,
    },
    is_commented: {
      type: Boolean,
      default: false,
    },
    is_collected: {
      type: Boolean,
      default: false,
    },
    is_disliked: {
      type: Boolean,
      default: false,
    },

    // 時間指標
    view_duration: {
      type: Number, // 秒數
      default: 0,
    },
    time_to_interact: {
      type: Number, // 從推薦到互動的秒數
      default: null,
    },

    // 用戶滿意度
    user_rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },

    // 推薦上下文
    recommendation_context: {
      page: {
        type: String,
        enum: ['home', 'explore', 'search', 'profile', 'collection'],
        default: 'home',
      },
      position: {
        type: Number, // 在推薦列表中的位置
        required: true,
      },
      session_id: {
        type: String,
        default: null,
      },
    },

    // 用戶特徵
    user_features: {
      is_new_user: {
        type: Boolean,
        default: false,
      },
      user_activity_level: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low',
      },
      user_preferences: {
        type: Map,
        of: Number, // 標籤偏好分數
        default: {},
      },
    },

    // 迷因特徵
    meme_features: {
      type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio'],
        required: true,
      },
      tags: [
        {
          type: String,
        },
      ],
      hot_score: {
        type: Number,
        required: true,
      },
      age_hours: {
        type: Number, // 迷因發布後的小時數
        required: true,
      },
    },

    // 時間戳記
    recommended_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    interacted_at: {
      type: Date,
      default: null,
    },

    // 計算指標
    calculated_metrics: {
      ctr: {
        type: Number, // Click-through rate
        default: null,
      },
      engagement_rate: {
        type: Number,
        default: null,
      },
      satisfaction_score: {
        type: Number,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
)

// 索引優化
RecommendationMetricsSchema.index({ user_id: 1, recommended_at: -1 })
RecommendationMetricsSchema.index({ algorithm: 1, recommended_at: -1 })
RecommendationMetricsSchema.index({ ab_test_id: 1, ab_test_variant: 1 })
RecommendationMetricsSchema.index({ is_clicked: 1, recommended_at: -1 })
RecommendationMetricsSchema.index({ is_liked: 1, recommended_at: -1 })

// 虛擬欄位：計算互動率
RecommendationMetricsSchema.virtual('interaction_rate').get(function () {
  const interactions = [
    this.is_clicked,
    this.is_liked,
    this.is_shared,
    this.is_commented,
    this.is_collected,
  ].filter(Boolean).length

  return interactions / 5 // 總共5種互動類型
})

// 虛擬欄位：計算滿意度分數
RecommendationMetricsSchema.virtual('satisfaction_score').get(function () {
  if (this.user_rating) {
    return this.user_rating / 5
  }

  // 基於互動計算滿意度
  const positiveInteractions = [
    this.is_liked,
    this.is_shared,
    this.is_commented,
    this.is_collected,
  ].filter(Boolean).length

  const negativeInteractions = this.is_disliked ? 1 : 0

  if (positiveInteractions === 0 && negativeInteractions === 0) {
    return null
  }

  return Math.max(0, (positiveInteractions - negativeInteractions) / 4)
})

// 中間件：自動計算指標
RecommendationMetricsSchema.pre('save', function (next) {
  // 計算 CTR
  if (this.is_clicked !== null) {
    this.calculated_metrics.ctr = this.is_clicked ? 1 : 0
  }

  // 計算互動率
  const interactions = [this.is_liked, this.is_shared, this.is_commented, this.is_collected].filter(
    Boolean,
  ).length

  this.calculated_metrics.engagement_rate = interactions / 4

  // 計算滿意度分數
  this.calculated_metrics.satisfaction_score = this.satisfaction_score

  next()
})

// 靜態方法：取得演算法統計
RecommendationMetricsSchema.statics.getAlgorithmStats = async function (
  algorithm,
  startDate,
  endDate,
) {
  const matchStage = {
    algorithm,
    recommended_at: {
      $gte: startDate,
      $lte: endDate,
    },
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total_recommendations: { $sum: 1 },
        total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
        total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
        total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
        total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
        total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
        total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
        avg_view_duration: { $avg: '$view_duration' },
        avg_rating: { $avg: '$user_rating' },
        avg_engagement_rate: { $avg: '$calculated_metrics.engagement_rate' },
      },
    },
  ])

  if (stats.length === 0) {
    return {
      total_recommendations: 0,
      ctr: 0,
      engagement_rate: 0,
      avg_view_duration: 0,
      avg_rating: 0,
    }
  }

  const result = stats[0]
  return {
    total_recommendations: result.total_recommendations,
    ctr: result.total_recommendations > 0 ? result.total_clicks / result.total_recommendations : 0,
    engagement_rate: result.avg_engagement_rate || 0,
    avg_view_duration: result.avg_view_duration || 0,
    avg_rating: result.avg_rating || 0,
    total_likes: result.total_likes,
    total_shares: result.total_shares,
    total_comments: result.total_comments,
    total_collections: result.total_collections,
    total_dislikes: result.total_dislikes,
  }
}

// 靜態方法：取得 A/B 測試結果
RecommendationMetricsSchema.statics.getABTestResults = async function (testId, startDate, endDate) {
  const matchStage = {
    ab_test_id: testId,
    recommended_at: {
      $gte: startDate,
      $lte: endDate,
    },
  }

  const results = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$ab_test_variant',
        total_recommendations: { $sum: 1 },
        total_clicks: { $sum: { $cond: ['$is_clicked', 1, 0] } },
        total_likes: { $sum: { $cond: ['$is_liked', 1, 0] } },
        total_shares: { $sum: { $cond: ['$is_shared', 1, 0] } },
        total_comments: { $sum: { $cond: ['$is_commented', 1, 0] } },
        total_collections: { $sum: { $cond: ['$is_collected', 1, 0] } },
        total_dislikes: { $sum: { $cond: ['$is_disliked', 1, 0] } },
        avg_view_duration: { $avg: '$view_duration' },
        avg_rating: { $avg: '$user_rating' },
        avg_engagement_rate: { $avg: '$calculated_metrics.engagement_rate' },
      },
    },
  ])

  return results.map((variant) => ({
    variant: variant._id,
    total_recommendations: variant.total_recommendations,
    ctr:
      variant.total_recommendations > 0 ? variant.total_clicks / variant.total_recommendations : 0,
    engagement_rate: variant.avg_engagement_rate || 0,
    avg_view_duration: variant.avg_view_duration || 0,
    avg_rating: variant.avg_rating || 0,
    total_likes: variant.total_likes,
    total_shares: variant.total_shares,
    total_comments: variant.total_comments,
    total_collections: variant.total_collections,
    total_dislikes: variant.total_dislikes,
  }))
}

export default mongoose.model('RecommendationMetrics', RecommendationMetricsSchema)
