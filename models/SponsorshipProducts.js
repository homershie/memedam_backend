import mongoose from 'mongoose'

const SponsorshipProductsSchema = new mongoose.Schema(
  {
    direct_link_code: {
      type: String,
      required: [true, '商品代碼為必填'],
      unique: true,
      trim: true,
      maxlength: [50, '商品代碼長度不能超過50字'],
    },
    name: {
      type: String,
      required: [true, '商品名稱為必填'],
      trim: true,
      maxlength: [100, '商品名稱長度不能超過100字'],
    },
    amount: {
      type: Number,
      required: [true, '商品價格為必填'],
      min: [1, '商品價格必須大於0'],
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: [10, '貨幣代碼長度不能超過10字'],
    },
    sponsor_level: {
      type: String,
      required: [true, '贊助等級為必填'],
      enum: {
        values: ['soy', 'chicken', 'coffee'],
        message: '贊助等級必須是 soy、chicken、coffee',
      },
    },
    badge_earned: {
      type: Boolean,
      default: false,
      comment: '是否獲得徽章',
    },
    is_active: {
      type: Boolean,
      default: true,
      comment: '是否啟用',
    },

    // 版本控制
    version: {
      type: Number,
      default: 1,
      comment: '配置版本號',
    },
    effective_from: {
      type: Date,
      default: Date.now,
      comment: '生效開始時間',
    },
    effective_until: {
      type: Date,
      default: null,
      comment: '生效結束時間（null 表示永久有效）',
    },

    // 多項目處理支援
    max_quantity: {
      type: Number,
      default: 1,
      min: [1, '最大數量至少為1'],
      comment: '單筆訂單最大數量限制',
    },
    combine_rule: {
      type: String,
      default: 'highest',
      enum: {
        values: ['highest', 'sum', 'average'],
        message: '合併規則必須是 highest、sum、average',
      },
      comment: '多項目合併規則：最高等級、總和、平均',
    },

    // 商品描述和分類
    description: {
      type: String,
      default: '',
      maxlength: [500, '商品描述長度不能超過500字'],
    },
    category: {
      type: String,
      default: 'sponsorship',
      enum: {
        values: ['sponsorship', 'donation', 'membership'],
        message: '分類必須是 sponsorship、donation、membership',
      },
    },

    // 排序和顯示
    sort_order: {
      type: Number,
      default: 0,
      comment: '排序順序',
    },
    display_name: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '顯示名稱長度不能超過100字'],
    },

    // 統計數據
    total_sold: {
      type: Number,
      default: 0,
      min: [0, '銷售總數不能為負數'],
    },
    total_revenue: {
      type: Number,
      default: 0,
      min: [0, '總營收不能為負數'],
    },

    // SEO 和元數據
    meta_title: {
      type: String,
      default: '',
      maxlength: [100, '元標題長度不能超過100字'],
    },
    meta_description: {
      type: String,
      default: '',
      maxlength: [200, '元描述長度不能超過200字'],
    },
  },
  {
    collection: 'sponsorship_products',
    timestamps: true,
    versionKey: false,
  },
)

// 資料庫索引
SponsorshipProductsSchema.index({ direct_link_code: 1 }, { unique: true }) // 商品代碼唯一索引
SponsorshipProductsSchema.index({ sponsor_level: 1 }) // 等級查詢索引
SponsorshipProductsSchema.index({ is_active: 1 }) // 啟用狀態查詢索引
SponsorshipProductsSchema.index({ category: 1 }) // 分類查詢索引
SponsorshipProductsSchema.index({ effective_from: 1, effective_until: 1 }) // 時間範圍查詢索引
SponsorshipProductsSchema.index({ sort_order: 1 }) // 排序索引
SponsorshipProductsSchema.index({ total_sold: -1 }) // 銷售統計排序索引
SponsorshipProductsSchema.index({ total_revenue: -1 }) // 營收統計排序索引

// 靜態方法：獲取活躍商品
SponsorshipProductsSchema.statics.getActiveProducts = function () {
  const now = new Date()
  return this.find({
    is_active: true,
    $or: [{ effective_until: null }, { effective_until: { $gte: now } }],
    effective_from: { $lte: now },
  }).sort({ sort_order: 1, createdAt: -1 })
}

// 靜態方法：根據 direct_link_code 獲取商品資訊
SponsorshipProductsSchema.statics.getByDirectLinkCode = function (directLinkCode) {
  const now = new Date()
  return this.findOne({
    direct_link_code: directLinkCode,
    is_active: true,
    $or: [{ effective_until: null }, { effective_until: { $gte: now } }],
    effective_from: { $lte: now },
  })
}

// 實例方法：增加銷售統計
SponsorshipProductsSchema.methods.incrementSales = function (quantity = 1, amount) {
  this.total_sold += quantity
  if (amount) {
    this.total_revenue += amount
  }
  return this.save()
}

export default mongoose.models.SponsorshipProducts ||
  mongoose.model('SponsorshipProducts', SponsorshipProductsSchema)
