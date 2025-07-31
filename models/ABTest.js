import mongoose from 'mongoose'

const ABTestSchema = new mongoose.Schema(
  {
    // 基本資訊
    test_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },

    // 測試配置
    test_type: {
      type: String,
      required: true,
      enum: [
        'algorithm_comparison', // 演算法比較
        'parameter_tuning', // 參數調優
        'feature_testing', // 功能測試
        'ui_variation', // UI 變體
        'content_variation', // 內容變體
      ],
    },

    // 測試目標
    primary_metric: {
      type: String,
      required: true,
      enum: [
        'ctr', // Click-through rate
        'engagement_rate', // 互動率
        'satisfaction_score', // 滿意度分數
        'retention_rate', // 留存率
        'conversion_rate', // 轉換率
        'revenue_per_user', // 每用戶收入
      ],
    },
    secondary_metrics: [
      {
        type: String,
        enum: [
          'ctr',
          'engagement_rate',
          'satisfaction_score',
          'retention_rate',
          'conversion_rate',
          'revenue_per_user',
          'avg_view_duration',
          'time_to_interact',
          'bounce_rate',
        ],
      },
    ],

    // 變體配置
    variants: [
      {
        variant_id: {
          type: String,
          required: true,
          enum: ['A', 'B', 'control'],
        },
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          default: '',
        },
        configuration: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
          required: true,
        },
        traffic_percentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
      },
    ],

    // 測試範圍
    target_audience: {
      user_segments: [
        {
          type: String,
          enum: [
            'all_users',
            'new_users',
            'active_users',
            'inactive_users',
            'premium_users',
            'free_users',
          ],
        },
      ],
      user_activity_levels: [
        {
          type: String,
          enum: ['low', 'medium', 'high'],
        },
      ],
      geographic_regions: [
        {
          type: String,
        },
      ],
      device_types: [
        {
          type: String,
          enum: ['mobile', 'desktop', 'tablet'],
        },
      ],
    },

    // 測試時間
    start_date: {
      type: Date,
      required: true,
      index: true,
    },
    end_date: {
      type: Date,
      required: true,
      index: true,
    },

    // 統計顯著性設定
    statistical_settings: {
      confidence_level: {
        type: Number,
        default: 0.95,
        min: 0.8,
        max: 0.99,
      },
      minimum_sample_size: {
        type: Number,
        default: 1000,
        min: 100,
      },
      minimum_duration_days: {
        type: Number,
        default: 7,
        min: 1,
      },
    },

    // 測試狀態
    status: {
      type: String,
      required: true,
      enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    // 結果分析
    results: {
      winner_variant: {
        type: String,
        enum: ['A', 'B', 'control', 'none'],
        default: null,
      },
      statistical_significance: {
        type: Boolean,
        default: null,
      },
      p_value: {
        type: Number,
        default: null,
      },
      effect_size: {
        type: Number,
        default: null,
      },
      confidence_interval: {
        lower: { type: Number, default: null },
        upper: { type: Number, default: null },
      },
      sample_sizes: {
        A: { type: Number, default: 0 },
        B: { type: Number, default: 0 },
        control: { type: Number, default: 0 },
      },
      metric_results: {
        A: {
          ctr: { type: Number, default: 0 },
          engagement_rate: { type: Number, default: 0 },
          satisfaction_score: { type: Number, default: 0 },
          avg_view_duration: { type: Number, default: 0 },
        },
        B: {
          ctr: { type: Number, default: 0 },
          engagement_rate: { type: Number, default: 0 },
          satisfaction_score: { type: Number, default: 0 },
          avg_view_duration: { type: Number, default: 0 },
        },
        control: {
          ctr: { type: Number, default: 0 },
          engagement_rate: { type: Number, default: 0 },
          satisfaction_score: { type: Number, default: 0 },
          avg_view_duration: { type: Number, default: 0 },
        },
      },
    },

    // 自動化設定
    automation: {
      auto_stop: {
        type: Boolean,
        default: true,
      },
      auto_winner_selection: {
        type: Boolean,
        default: false,
      },
      minimum_improvement: {
        type: Number,
        default: 0.05, // 5% 改善
        min: 0,
      },
    },

    // 通知設定
    notifications: {
      on_start: {
        type: Boolean,
        default: true,
      },
      on_completion: {
        type: Boolean,
        default: true,
      },
      on_significant_result: {
        type: Boolean,
        default: true,
      },
      recipients: [
        {
          type: String, // email addresses
        },
      ],
    },

    // 元數據
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  },
)

// 索引優化
ABTestSchema.index({ status: 1, start_date: 1 })
ABTestSchema.index({ test_type: 1, status: 1 })
ABTestSchema.index({ created_by: 1, created_at: -1 })

// 虛擬欄位：測試是否活躍
ABTestSchema.virtual('is_active').get(function () {
  const now = new Date()
  return this.status === 'active' && this.start_date <= now && this.end_date >= now
})

// 虛擬欄位：測試是否完成
ABTestSchema.virtual('is_completed').get(function () {
  return this.status === 'completed' || new Date() > this.end_date
})

// 虛擬欄位：測試持續時間
ABTestSchema.virtual('duration_days').get(function () {
  return Math.ceil((this.end_date - this.start_date) / (1000 * 60 * 60 * 24))
})

// 中間件：驗證變體配置
ABTestSchema.pre('save', function (next) {
  // 驗證流量分配總和為 100%
  const totalTraffic = this.variants.reduce((sum, variant) => sum + variant.traffic_percentage, 0)
  if (Math.abs(totalTraffic - 100) > 0.01) {
    return next(new Error('變體流量分配總和必須為 100%'))
  }

  // 驗證至少有一個變體
  if (this.variants.length < 2) {
    return next(new Error('至少需要兩個變體進行 A/B 測試'))
  }

  // 驗證結束日期在開始日期之後
  if (this.end_date <= this.start_date) {
    return next(new Error('結束日期必須在開始日期之後'))
  }

  // 新增/更新時加強日期驗證
  if (!(this.start_date instanceof Date) || isNaN(this.start_date)) {
    return next(new Error('start_date 必須是有效的日期'))
  }
  if (!(this.end_date instanceof Date) || isNaN(this.end_date)) {
    return next(new Error('end_date 必須是有效的日期'))
  }

  next()
})

// 靜態方法：取得活躍的測試
ABTestSchema.statics.getActiveTests = async function () {
  const now = new Date()
  try {
    // 使用最簡單的查詢方法，避免複雜的查詢運算子
    const tests = await this.find({ status: 'active' }).lean()

    // 在記憶體中過濾日期
    return tests.filter((test) => {
      const startDate = new Date(test.start_date)
      const endDate = new Date(test.end_date)
      return startDate <= now && endDate >= now
    })
  } catch (error) {
    console.error('[ABTest] 取得活躍測試失敗:', error.message, error)
    return []
  }
}

// 靜態方法：取得測試統計
ABTestSchema.statics.getTestStats = async function (testId) {
  const test = await this.findOne({ test_id: testId })
  if (!test) {
    throw new Error('測試不存在')
  }

  // 這裡可以整合 RecommendationMetrics 的統計數據
  // 暫時返回基本資訊
  return {
    test_id: test.test_id,
    name: test.name,
    status: test.status,
    is_active: test.is_active,
    duration_days: test.duration_days,
    total_variants: test.variants.length,
    primary_metric: test.primary_metric,
    results: test.results,
  }
}

// 實例方法：檢查統計顯著性
ABTestSchema.methods.checkStatisticalSignificance = function () {
  // 這裡實作統計顯著性檢定
  // 可以使用 t-test, chi-square test 等
  // 暫時返回基本邏輯
  const { metric_results } = this.results

  if (!metric_results.A || !metric_results.B) {
    return false
  }

  // 簡單的顯著性檢查（實際應該使用正式的統計檢定）
  const aMetric = metric_results.A[this.primary_metric] || 0
  const bMetric = metric_results.B[this.primary_metric] || 0
  const improvement = (bMetric - aMetric) / aMetric

  return Math.abs(improvement) > this.automation.minimum_improvement
}

// 實例方法：選擇獲勝變體
ABTestSchema.methods.selectWinner = function () {
  if (!this.checkStatisticalSignificance()) {
    this.results.winner_variant = 'none'
    return 'none'
  }

  const { metric_results } = this.results
  const aMetric = metric_results.A[this.primary_metric] || 0
  const bMetric = metric_results.B[this.primary_metric] || 0

  if (bMetric > aMetric) {
    this.results.winner_variant = 'B'
    return 'B'
  } else {
    this.results.winner_variant = 'A'
    return 'A'
  }
}

export default mongoose.model('ABTest', ABTestSchema)
