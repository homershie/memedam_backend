import mongoose from 'mongoose'
import validator from 'validator'
import { toSlug } from '../utils/slugify.js'

const SceneSchema = new mongoose.Schema(
  {
    source_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      required: [true, '來源ID為必填欄位'],
      index: true,
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '來源ID必須是有效的ObjectId',
      },
      // 所屬作品ID
    },
    title: {
      type: String,
      required: [true, '場景標題為必填欄位'],
      trim: true,
      maxlength: [200, '標題長度不能超過200個字元'],
      // 場景標題（必填）
    },
    episode: {
      type: String,
      trim: true,
      maxlength: [50, '集數標示長度不能超過50個字元'],
      // 集數/章節（如 S01E05）
    },
    start_time: {
      type: Number,
      min: [0, '開始時間不能為負數'],
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true
          return Number.isInteger(v) || Number.isFinite(v)
        },
        message: '開始時間必須是有效的數字',
      },
      // 開始時間（秒）
    },
    end_time: {
      type: Number,
      min: [0, '結束時間不能為負數'],
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true
          if (!Number.isInteger(v) && !Number.isFinite(v)) return false
          // 確保結束時間大於開始時間
          if (this.start_time !== null && this.start_time !== undefined) {
            return v > this.start_time
          }
          return true
        },
        message: '結束時間必須是有效的數字且大於開始時間',
      },
      // 結束時間（秒）
    },
    quote: {
      type: String,
      trim: true,
      maxlength: [1000, '關鍵台詞長度不能超過1000個字元'],
      // 關鍵台詞/名言
    },
    transcript: {
      type: String,
      trim: true,
      maxlength: [5000, '逐字稿長度不能超過5000個字元'],
      // 場景逐字稿（短）
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, '描述長度不能超過2000個字元'],
      // 場景描述/場景說明
    },
    images: [
      {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
            if (!v) return false
            return validator.isURL(v, { protocols: ['http', 'https'] })
          },
          message: '圖片連結必須是有效的URL',
        },
        // 截圖連結
      },
    ],
    video_url: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isURL(v, { protocols: ['http', 'https'] })
        },
        message: '影片連結必須是有效的URL',
      },
      // 可含 timecode 的外部連結
    },
    audio_url: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isURL(v, { protocols: ['http', 'https'] })
        },
        message: '音訊連結必須是有效的URL',
      },
      // 音訊場景連結
    },
    slug: {
      type: String,
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
    // 彙總統計
    counts: {
      memes: {
        type: Number,
        default: 0,
        min: [0, '迷因數量不能為負數'],
        // 使用此場景的迷因數
      },
      views: {
        type: Number,
        default: 0,
        min: [0, '瀏覽次數不能為負數'],
        // 總瀏覽次數
      },
      uses: {
        type: Number,
        default: 0,
        min: [0, '使用次數不能為負數'],
        // 被引用次數
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
      // 狀態
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
    // 建立者資訊
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '建立者ID為必填欄位'],
      index: true,
      // 建立此場景的使用者ID
    },
  },
  {
    collection: 'scenes',
    timestamps: true,
  },
)

// 索引設定
SceneSchema.index({ source_id: 1, start_time: 1 })
SceneSchema.index({ source_id: 1, status: 1 })
SceneSchema.index({ slug: 1 })
SceneSchema.index({ 'counts.memes': -1 })

// 自動生成 slug
SceneSchema.pre('validate', function (next) {
  if (!this.slug && this.title) {
    this.slug = toSlug(this.title).substring(0, 100)
  }
  next()
})

// 格式化時間為 MM:SS 或 HH:MM:SS
SceneSchema.methods.formatTime = function (seconds) {
  if (!seconds && seconds !== 0) return ''

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 取得時間範圍字串
SceneSchema.methods.getTimeRange = function () {
  if (this.start_time === null || this.start_time === undefined) return ''

  const start = this.formatTime(this.start_time)
  const end = this.end_time ? this.formatTime(this.end_time) : ''

  return end ? `${start} - ${end}` : start
}

// 實例方法：更新統計數據
SceneSchema.methods.updateCounts = async function () {
  const Meme = mongoose.model('Meme')

  // 計算使用此場景的迷因數
  const memeCount = await Meme.countDocuments({
    scene_id: this._id,
    status: { $ne: 'deleted' },
  })

  // 計算總瀏覽數
  const memeStats = await Meme.aggregate([
    {
      $match: {
        scene_id: this._id,
        status: { $ne: 'deleted' },
      },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: '$views' },
      },
    },
  ])

  const stats = memeStats[0] || { totalViews: 0 }

  this.counts = {
    memes: memeCount,
    views: stats.totalViews,
    uses: memeCount, // 使用次數等於迷因數
  }

  return this.save()
}

// 靜態方法：批次更新所有場景的統計數據
SceneSchema.statics.batchUpdateCounts = async function () {
  const scenes = await this.find({ status: { $ne: 'deleted' } })

  const updatePromises = scenes.map((scene) => scene.updateCounts())

  return Promise.all(updatePromises)
}

// 靜態方法：取得來源的所有場景
SceneSchema.statics.getSourceScenes = async function (sourceId, options = {}) {
  const { includeInactive = false, sortBy = 'time' } = options

  const query = { source_id: sourceId }
  if (!includeInactive) {
    query.status = 'active'
  }

  let sortOption = {}
  switch (sortBy) {
    case 'popular':
      sortOption = { 'counts.memes': -1, 'counts.views': -1 }
      break
    case 'time':
    default:
      sortOption = { start_time: 1, createdAt: 1 }
  }

  return this.find(query)
    .sort(sortOption)
    .select('title episode start_time end_time quote images counts slug')
}

// 靜態方法：取得熱門場景
SceneSchema.statics.getPopularScenes = async function (limit = 50, sourceId = null) {
  const query = { status: 'active' }
  if (sourceId) {
    query.source_id = sourceId
  }

  return this.find(query)
    .sort({ 'counts.memes': -1, 'counts.views': -1 })
    .limit(limit)
    .populate('source_id', 'title slug type')
    .select('title quote images start_time end_time counts slug')
}

// 靜態方法：搜尋場景
SceneSchema.statics.searchScenes = async function (query, options = {}) {
  const { sourceId = null, tags = [], limit = 20, page = 1, sortBy = 'popular' } = options

  const searchQuery = { status: 'active' }

  // 來源篩選
  if (sourceId) {
    searchQuery.source_id = sourceId
  }

  // 文字搜尋
  if (query) {
    const searchRegex = new RegExp(query, 'i')
    searchQuery.$or = [
      { title: searchRegex },
      { quote: searchRegex },
      { transcript: searchRegex },
      { description: searchRegex },
    ]
  }

  // 標籤篩選
  if (tags.length > 0) {
    searchQuery.tags = { $in: tags }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)

  // 排序選項
  let sortOption = {}
  switch (sortBy) {
    case 'time':
      sortOption = { start_time: 1, createdAt: 1 }
      break
    case 'popular':
    default:
      sortOption = { 'counts.memes': -1, 'counts.views': -1 }
  }

  const [scenes, total] = await Promise.all([
    this.find(searchQuery)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('source_id', 'title slug type')
      .select('title episode quote images start_time end_time counts slug')
      .lean(),
    this.countDocuments(searchQuery),
  ])

  return {
    data: scenes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  }
}

// 虛擬屬性：取得完整的時間碼 URL
SceneSchema.virtual('timecodedUrl').get(function () {
  if (!this.video_url || !this.start_time) return this.video_url

  // YouTube 時間碼範例
  if (this.video_url.includes('youtube.com') || this.video_url.includes('youtu.be')) {
    const url = new URL(this.video_url)
    url.searchParams.set('t', this.start_time.toString())
    if (this.end_time) {
      url.searchParams.set('end', this.end_time.toString())
    }
    return url.toString()
  }

  return this.video_url
})

export default mongoose.models.Scene || mongoose.model('Scene', SceneSchema)
