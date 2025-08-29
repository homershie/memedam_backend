import mongoose from 'mongoose'
import validator from 'validator'

const SourceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['video', 'film', 'tv', 'ad', 'web', 'article', 'other'],
        message: '來源類型必須是 video、film、tv、ad、web、article 或 other',
      },
      required: [true, '來源類型為必填欄位'],
      // 作品類型：影片、電影、電視、廣告、網路、文章、其他
    },
    title: {
      type: String,
      required: [true, '標題為必填欄位'],
      trim: true,
      minlength: [1, '標題不能為空'],
      maxlength: [200, '標題長度不能超過200個字元'],
      index: true,
      // 作品標題（必填）
    },
    alt_titles: [
      {
        type: String,
        trim: true,
        maxlength: [200, '別名長度不能超過200個字元'],
        // 別名、其他譯名
      },
    ],
    year: {
      type: Number,
      min: [1800, '年份不能早於1800年'],
      max: [new Date().getFullYear() + 10, '年份不能超過未來10年'],
      // 發行/發表年份
    },
    origin_country: {
      type: String,
      trim: true,
      maxlength: [100, '國家名稱長度不能超過100個字元'],
      // 來源國家/地區
    },
    creators: [
      {
        role: {
          type: String,
          trim: true,
          maxlength: [50, '角色名稱長度不能超過50個字元'],
          // 創作者角色：導演、編劇、演員等
        },
        name: {
          type: String,
          trim: true,
          maxlength: [100, '姓名長度不能超過100個字元'],
          // 創作者姓名
        },
      },
    ],
    synopsis: {
      type: String,
      trim: true,
      maxlength: [5000, '簡介長度不能超過5000個字元'],
      // 作品簡介（長文）
    },
    context: {
      type: String,
      trim: true,
      maxlength: [5000, '背景說明長度不能超過5000個字元'],
      // 背景/爭議/影響
    },
    license: {
      type: {
        type: String,
        enum: {
          values: ['copyright', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa', 'cc0', 'public-domain', 'other'],
          message: '授權類型必須是有效的授權方式',
        },
        // 授權類型
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, '授權說明長度不能超過500個字元'],
        // 授權說明
      },
    },
    links: [
      {
        label: {
          type: String,
          trim: true,
          maxlength: [100, '連結標籤長度不能超過100個字元'],
          // 連結標籤
        },
        url: {
          type: String,
          trim: true,
          validate: {
            validator: function (v) {
              if (!v) return false
              return validator.isURL(v, { protocols: ['http', 'https'] })
            },
            message: '連結必須是有效的URL',
          },
          // 外部連結
        },
      },
    ],
    thumbnails: [
      {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
            if (!v) return false
            // 允許 Cloudinary URL 或其他圖片 URL
            return validator.isURL(v, { protocols: ['http', 'https'] })
          },
          message: '縮圖必須是有效的URL',
        },
        // 海報/主視覺圖片
      },
    ],
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      maxlength: [100, 'Slug長度不能超過100個字元'],
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return /^[a-z0-9-]+$/.test(v)
        },
        message: 'Slug只能包含小寫字母、數字和連字號',
      },
      index: true,
      // SEO友善網址
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [50, '標籤長度不能超過50個字元'],
        // 分類標籤
      },
    ],
    // 彙總統計（供列表/快取）
    counts: {
      memes: {
        type: Number,
        default: 0,
        min: [0, '迷因數量不能為負數'],
        // 相關迷因總數
      },
      scenes: {
        type: Number,
        default: 0,
        min: [0, '片段數量不能為負數'],
        // 相關片段總數
      },
      views: {
        type: Number,
        default: 0,
        min: [0, '瀏覽次數不能為負數'],
        // 總瀏覽次數
      },
      likes: {
        type: Number,
        default: 0,
        min: [0, '按讚數不能為負數'],
        // 總按讚數
      },
      comments: {
        type: Number,
        default: 0,
        min: [0, '留言數不能為負數'],
        // 總留言數
      },
    },
    // 狀態管理
    status: {
      type: String,
      default: 'active',
      enum: {
        values: ['active', 'inactive', 'deleted'],
        message: '狀態必須是 active、inactive 或 deleted',
      },
      // 狀態：active(啟用)、inactive(停用)、deleted(刪除)
    },
    // 額外的元資料
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          return typeof v === 'object' && v !== null
        },
        message: 'Meta欄位必須是物件',
      },
      // 彈性補充欄位
    },
  },
  {
    collection: 'sources',
    timestamps: true,
  },
)

// 索引設定
SourceSchema.index({ slug: 1 })
SourceSchema.index({ title: 1 })
SourceSchema.index({ type: 1, status: 1 })
SourceSchema.index({ 'counts.memes': -1 })
SourceSchema.index({ createdAt: -1 })

// 自動生成 slug
SourceSchema.pre('validate', function (next) {
  if (!this.slug && this.title) {
    // 簡單的 slug 生成，實際應用可能需要更複雜的邏輯
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // 移除特殊字元
      .replace(/\s+/g, '-') // 空格改為連字號
      .replace(/-+/g, '-') // 多個連字號合併
      .substring(0, 100)
  }
  next()
})

// 實例方法：更新統計數據
SourceSchema.methods.updateCounts = async function () {
  const Scene = mongoose.model('Scene')
  const Meme = mongoose.model('Meme')

  // 計算相關片段數
  const sceneCount = await Scene.countDocuments({
    source_id: this._id,
  })

  // 計算相關迷因數
  const memeCount = await Meme.countDocuments({
    source_id: this._id,
    status: { $ne: 'deleted' },
  })

  // 計算總瀏覽、按讚、留言數
  const memeStats = await Meme.aggregate([
    {
      $match: {
        source_id: this._id,
        status: { $ne: 'deleted' },
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: '$views' },
        totalLikes: { $sum: '$like_count' },
        totalComments: { $sum: '$comment_count' },
      },
    },
  ])

  const stats = memeStats[0] || { totalViews: 0, totalLikes: 0, totalComments: 0 }

  this.counts = {
    scenes: sceneCount,
    memes: memeCount,
    views: stats.totalViews,
    likes: stats.totalLikes,
    comments: stats.totalComments,
  }

  return this.save()
}

// 靜態方法：批次更新所有來源的統計數據
SourceSchema.statics.batchUpdateCounts = async function () {
  const sources = await this.find({ status: { $ne: 'deleted' } })

  const updatePromises = sources.map((source) => source.updateCounts())

  return Promise.all(updatePromises)
}

// 靜態方法：取得熱門來源
SourceSchema.statics.getPopularSources = async function (limit = 50) {
  return this.find({ status: 'active' })
    .sort({ 'counts.memes': -1, 'counts.views': -1 })
    .limit(limit)
    .select('title slug type thumbnails counts tags')
}

// 靜態方法：搜尋來源
SourceSchema.statics.searchSources = async function (query, options = {}) {
  const {
    type = null,
    tags = [],
    limit = 20,
    skip = 0,
    sortBy = 'relevance',
  } = options

  const searchQuery = { status: 'active' }

  // 文字搜尋
  if (query) {
    searchQuery.$or = [
      { title: { $regex: query, $options: 'i' } },
      { alt_titles: { $regex: query, $options: 'i' } },
      { synopsis: { $regex: query, $options: 'i' } },
    ]
  }

  // 類型篩選
  if (type) {
    searchQuery.type = type
  }

  // 標籤篩選
  if (tags.length > 0) {
    searchQuery.tags = { $in: tags }
  }

  // 排序選項
  let sortOption = {}
  switch (sortBy) {
    case 'newest':
      sortOption = { createdAt: -1 }
      break
    case 'popular':
      sortOption = { 'counts.memes': -1, 'counts.views': -1 }
      break
    case 'relevance':
    default:
      if (query) {
        // 相關性排序（簡單實作，可以用文字索引優化）
        sortOption = { score: { $meta: 'textScore' } }
      } else {
        sortOption = { 'counts.memes': -1 }
      }
  }

  return this.find(searchQuery)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .select('title slug type year origin_country thumbnails counts tags createdAt')
}

export default mongoose.models.Source || mongoose.model('Source', SourceSchema)