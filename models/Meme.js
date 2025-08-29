import mongoose from 'mongoose'
import validator from 'validator'
import { calculateMemeHotScore, getHotScoreLevel } from '../utils/hotScore.js'

const MemeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, '迷因標題為必填欄位'],
      trim: true,
      minlength: [1, '標題不能為空'],
      maxlength: [200, '標題長度不能超過200個字元'],
      // 迷因標題（必填，用於列表、搜尋、SEO 等）
    },
    type: {
      type: String,
      required: [true, '迷因型態為必填欄位'],
      enum: {
        values: ['text', 'image', 'video', 'audio'],
        message: '迷因型態必須是 text、image、video 或 audio',
      },
      // 迷因型態（文字/圖片/影片/音樂），決定前端如何顯示內容
    },
    content: {
      type: String,
      default: '',
      required: [true, '內容為必填欄位'],
      trim: true,
      maxlength: [5000, '內容長度不能超過5000個字元'],
      // 主要內容簡介/摘要（文字內容或圖片/影片/音樂的補充說明）
    },
    image_url: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isURL(v, { protocols: ['http', 'https'] })
        },
        message: '圖片連結必須是有效的URL',
      },
      // 圖片迷因的圖片連結，僅 type 為 image 時用
    },
    video_url: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isURL(v, { protocols: ['http', 'https'] })
        },
        message: '影片連結必須是有效的URL',
      },
      // 影片迷因的影片連結，僅 type 為 video 時用
    },
    audio_url: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isURL(v, { protocols: ['http', 'https'] })
        },
        message: '音訊連結必須是有效的URL',
      },
      // 音樂/音效迷因的檔案連結，僅 type 為 audio 時用
    },
    // ===== 三層模型架構欄位 =====
    // 來源/片段關聯（B：三層模型的關鍵）
    source_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      index: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '來源ID必須是有效的ObjectId',
      },
      // 關聯的作品來源ID
    },
    scene_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scene',
      index: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '片段ID必須是有效的ObjectId',
      },
      // 關聯的片段ID（可選）
    },
    // 變體系譜（A：迷因對迷因的關係）
    variant_of: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      index: true,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '變體來源ID必須是有效的ObjectId',
      },
      // 此迷因是哪個迷因的變體
    },
    lineage: {
      root: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meme',
        index: true,
        validate: {
          validator: function (v) {
            if (!v) return true // 允許空值
            return mongoose.Types.ObjectId.isValid(v)
          },
          message: '系譜根源ID必須是有效的ObjectId',
        },
        // 變體系譜的根源迷因
      },
      depth: {
        type: Number,
        default: 0,
        min: [0, '系譜深度不能為負數'],
        // 在變體系譜中的深度（0表示是根源）
      },
    },
    // 笑點解析（獨特的迷因解釋）
    body: {
      type: String,
      trim: true,
      maxlength: [5000, '笑點解析長度不能超過5000個字元'],
      // 你的笑點解析（務必獨特）- 解釋這個迷因為什麼好笑/有趣
    },
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '作者ID為必填欄位'],
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '作者ID必須是有效的ObjectId',
      },
      // 迷因作者的用戶ID，對應 User 資料表
    },
    editors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: [],
        validate: {
          validator: function (v) {
            return mongoose.Types.ObjectId.isValid(v)
          },
          message: '編輯者ID必須是有效的ObjectId',
        },
      },
    ],
    status: {
      type: String,
      default: 'public',
      enum: {
        values: ['public', 'deleted', 'banned', 'hidden', 'draft'],
        message: '狀態必須是 public、deleted、banned、hidden 或 draft',
      },
      // 狀態：public(公開)、deleted(刪除)、banned(封鎖)、hidden(隱藏)、draft(草稿)
    },
    slug: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Slug長度不能超過100個字元'],
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return /^[a-z0-9-]+$/.test(v)
        },
        message: 'Slug只能包含小寫字母、數字和連字號',
      },
      // SEO/友善網址 slug，可選
    },
    nsfw: {
      type: Boolean,
      default: false,
      // 是否為成人/限制級（Not Safe For Work）
    },
    views: {
      type: Number,
      default: 0,
      min: [0, '瀏覽次數不能為負數'],
      // 瀏覽次數（快取用，方便熱門排序）
    },
    comment_count: {
      type: Number,
      default: 0,
      min: [0, '留言數不能為負數'],
      // 留言數（快取用）
    },
    like_count: {
      type: Number,
      default: 0,
      min: [0, '按讚數不能為負數'],
      // 按讚數（快取用）
    },
    dislike_count: {
      type: Number,
      default: 0,
      min: [0, '按噓數不能為負數'],
      // 按噓/不喜歡數（快取用）
    },
    collection_count: {
      type: Number,
      default: 0,
      min: [0, '收藏數不能為負數'],
      // 收藏數（快取用）
    },
    share_count: {
      type: Number,
      default: 0,
      min: [0, '分享數不能為負數'],
      // 分享數（快取用）
    },
    hot_score: {
      type: Number,
      default: 0,
      min: [0, '熱門分數不能為負數'],
      // 熱門分數，依照自訂算法計算，用於熱門榜單排序
    },
    tags_cache: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          if (!Array.isArray(v)) return false
          return v.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= 50)
        },
        message: '標籤必須是字串陣列，每個標籤長度在1-50個字元之間',
      },
      // 主要標籤名稱快取（正式標籤關聯請用 MemeTag 表）
    },
    source_url: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return validator.isURL(v, { protocols: ['http', 'https'] })
        },
        message: '來源網址必須是有效的URL',
      },
      // 來源網址或原圖連結（有引用時用）
    },

    last_report_at: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return v instanceof Date && !isNaN(v)
        },
        message: '檢舉時間必須是有效的日期',
      },
      // 最近一次被檢舉的時間
    },
    is_reported: {
      type: Boolean,
      default: false,
      // 是否曾被檢舉過（快取加速用）
    },
    pinned: {
      type: Boolean,
      default: false,
      // 是否為精選/置頂迷因
    },
    is_featured: {
      type: Boolean,
      default: false,
      // 是否為官方推薦內容
    },
    language: {
      type: String,
      default: 'zh',
      enum: {
        values: ['zh', 'en', 'ja', 'ko'],
        message: '語言必須是 zh、en、ja 或 ko',
      },
      // 內容語言（支援多語系時用）
    },
    deleted_at: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return v instanceof Date && !isNaN(v)
        },
        message: '刪除時間必須是有效的日期',
      },
      // 軟刪除用，刪除時紀錄時間
    },
    visible_at: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return v instanceof Date && !isNaN(v)
        },
        message: '上架時間必須是有效的日期',
      },
      // 預約上架時間（可做排程發佈）
    },
    expired_at: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return v instanceof Date && !isNaN(v)
        },
        message: '下架時間必須是有效的日期',
      },
      // 自動下架時間
    },
    modified_at: {
      type: Date,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return v instanceof Date && !isNaN(v)
        },
        message: '修改時間必須是有效的日期',
      },
      // 最後實質性修改時間（用於推薦系統優化）
    },
    hash: {
      type: String,
      default: '',
      trim: true,
      maxlength: [64, 'Hash值長度不能超過64個字元'],
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          return /^[a-fA-F0-9]+$/.test(v)
        },
        message: 'Hash值只能包含十六進位字元',
      },
      // 圖片或內容hash值，用於防止重複上傳
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          return typeof v === 'object' && v !== null
        },
        message: 'Meta欄位必須是物件',
      },
      // 彈性補充欄位，存未來特殊需求/備註
    },
    // 詳細介紹內容 (TipTap JSON 格式)
    detail_content: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: function (v) {
          if (v === null || v === '') return true // 允許空值
          return typeof v === 'object' && v !== null
        },
        message: '詳細介紹內容必須是有效的 JSON 物件',
      },
    },
    // 詳細介紹中使用的圖片連結陣列
    detail_images: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          if (!Array.isArray(v)) return false
          return v.every((url) => {
            if (typeof url !== 'string') return false
            if (!url) return false
            // 驗證是否為有效的 Cloudinary URL
            return /^https:\/\/res\.cloudinary\.com\/.*\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(
              url,
            )
          })
        },
        message: '詳細介紹圖片必須是有效的 Cloudinary URL 陣列',
      },
    },
    // 側邊欄模板系統
    sidebar_template: {
      type: String,
      default: 'default',
      enum: {
        values: ['default', 'custom', 'wiki', 'minimal'],
        message: '側邊欄模板必須是 default、custom、wiki 或 minimal',
      },
      // 側邊欄模板類型
    },
    sidebar_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          return typeof v === 'object' && v !== null
        },
        message: '側邊欄資料必須是物件',
      },
      // 側邊欄自定義資料（JSON格式）
    },
    sidebar_schema: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator: function (v) {
          return typeof v === 'object' && v !== null
        },
        message: '側邊欄結構定義必須是物件',
      },
      // 側邊欄結構定義（用於驗證和編輯器）
    },
  },
  {
    collection: 'memes',
    timestamps: true,
  },
)

// 自動更新 updated_at 欄位 & 處理三層模型資料一致性
MemeSchema.pre('save', async function (next) {
  this.updated_at = new Date()

  // 資料一致性：若 scene_id 存在，自動覆蓋 source_id = scene.source_id
  if (this.scene_id && (!this.source_id || this.isModified('scene_id'))) {
    try {
      const Scene = mongoose.model('Scene')
      const scene = await Scene.findById(this.scene_id).select('source_id').lean()
      if (scene) {
        this.source_id = scene.source_id
      }
    } catch (error) {
      console.error('Error fetching scene for source_id sync:', error)
    }
  }

  // lineage 自動計算
  if (this.isModified('variant_of')) {
    if (this.variant_of) {
      try {
        const Meme = mongoose.model('Meme')
        let root = this.variant_of
        let depth = 1
        const seen = new Set([String(this._id)])

        // 向上追溯找到根源
        while (root) {
          if (seen.has(String(root))) {
            // 避免循環引用
            console.warn('Circular reference detected in variant lineage')
            break
          }
          seen.add(String(root))

          const parent = await Meme.findById(root).select('variant_of lineage.root').lean()

          if (!parent) break

          // 如果父節點已有 lineage.root，直接使用
          if (parent.lineage?.root) {
            root = parent.lineage.root
            depth = (parent.lineage.depth || 0) + 1
            break
          }

          // 否則繼續向上追溯
          if (parent.variant_of) {
            root = parent.variant_of
            depth++
          } else {
            // parent 就是根源
            root = parent._id
            break
          }
        }

        this.lineage = {
          root: root || this.variant_of,
          depth: depth,
        }
      } catch (error) {
        console.error('Error calculating lineage:', error)
        // 發生錯誤時的預設值
        this.lineage = {
          root: this.variant_of,
          depth: 1,
        }
      }
    } else {
      // 沒有 variant_of，自己就是根源
      this.lineage = {
        root: this._id,
        depth: 0,
      }
    }
  }

  next()
})

// 自定義驗證：根據type檢查對應的URL欄位
MemeSchema.pre('validate', function (next) {
  const errors = []

  // 檢查type與URL欄位的對應關係
  if (this.type === 'image' && !this.image_url) {
    errors.push('圖片型態的迷因必須提供圖片連結')
  }

  if (this.type === 'video' && !this.video_url) {
    errors.push('影片型態的迷因必須提供影片連結')
  }

  if (this.type === 'audio' && !this.audio_url) {
    errors.push('音訊型態的迷因必須提供音訊連結')
  }

  // 檢查時間邏輯
  if (this.visible_at && this.expired_at && this.visible_at >= this.expired_at) {
    errors.push('上架時間必須早於下架時間')
  }

  if (this.deleted_at && this.created_at && this.deleted_at < this.created_at) {
    errors.push('刪除時間不能早於創建時間')
  }

  if (this.modified_at && this.created_at && this.modified_at < this.created_at) {
    errors.push('修改時間不能早於創建時間')
  }

  if (errors.length > 0) {
    return next(new Error(errors.join(', ')))
  }

  next()
})

// 添加實例方法：計算並更新熱門分數
MemeSchema.methods.updateHotScore = function () {
  const hotScore = calculateMemeHotScore(this)
  this.hot_score = hotScore
  return this.save()
}

// 添加實例方法：取得熱門等級
MemeSchema.methods.getHotLevel = function () {
  return getHotScoreLevel(this.hot_score)
}

// 添加實例方法：標記實質性修改
MemeSchema.methods.markAsModified = function (updateFields = {}) {
  // 檢查是否為實質性修改（排除統計數據更新）
  const substantialFields = [
    'title',
    'content',
    'tags_cache',
    'image_url',
    'video_url',
    'audio_url',
    'detail_content',
    'detail_images',
  ]
  const hasSubstantialChange = substantialFields.some((field) =>
    Object.prototype.hasOwnProperty.call(updateFields, field),
  )

  if (hasSubstantialChange) {
    this.modified_at = new Date()
  }

  return this
}

// 添加實例方法：取得有效的時間基準（優先使用修改時間）
MemeSchema.methods.getEffectiveDate = function () {
  return this.modified_at || this.createdAt
}

// 添加靜態方法：批次更新熱門分數
MemeSchema.statics.batchUpdateHotScores = async function () {
  const memes = await this.find({ status: { $ne: 'deleted' } })

  const updatePromises = memes.map(async (meme) => {
    const hotScore = calculateMemeHotScore(meme)
    return this.findByIdAndUpdate(meme._id, { hot_score: hotScore }, { new: true })
  })

  return Promise.all(updatePromises)
}

// 添加靜態方法：取得熱門迷因
MemeSchema.statics.getHotMemes = async function (limit = 50, days = 7) {
  const dateLimit = new Date()
  dateLimit.setDate(dateLimit.getDate() - days)

  return this.find({
    status: 'public',
    createdAt: mongoose.trusted({ $gte: dateLimit }),
  })
    .sort({ hot_score: -1 })
    .limit(limit)
    .populate('author_id', 'username display_name avatar')
}

// 添加靜態方法：取得趨勢迷因（基於熱門分數變化）
MemeSchema.statics.getTrendingMemes = async function (limit = 50, hours = 24) {
  const dateLimit = new Date()
  dateLimit.setHours(dateLimit.getHours() - hours)

  return this.find({
    status: 'public',
    createdAt: mongoose.trusted({ $gte: dateLimit }),
  })
    .sort({ hot_score: -1, views: -1 })
    .limit(limit)
    .populate('author_id', 'username display_name avatar')
}

// ===== 三層模型相關的靜態方法 =====

// 取得同一系譜的所有變體
MemeSchema.statics.getVariants = async function (memeId, options = {}) {
  const { limit = 60, excludeSelf = true } = options

  // 先找到這個迷因的 lineage.root
  const meme = await this.findById(memeId).select('lineage.root').lean()
  if (!meme) return []

  const rootId = meme.lineage?.root || memeId

  const query = {
    'lineage.root': rootId,
    status: 'public',
  }

  if (excludeSelf) {
    query._id = { $ne: memeId }
  }

  return this.find(query)
    .select('title slug image_url video_url variant_of lineage like_count view_count author_id')
    .sort({ 'lineage.depth': 1, like_count: -1, createdAt: -1 })
    .limit(limit)
    .populate('author_id', 'username display_name avatar')
}

// 取得同一來源的其他迷因
MemeSchema.statics.getMemesFromSameSource = async function (memeId, options = {}) {
  const { limit = 30, excludeSelf = true } = options

  // 先找到這個迷因的 source_id
  const meme = await this.findById(memeId).select('source_id scene_id').lean()
  if (!meme || !meme.source_id) return []

  const query = {
    source_id: meme.source_id,
    status: 'public',
  }

  if (excludeSelf) {
    query._id = { $ne: memeId }
  }

  return this.find(query)
    .select('title slug image_url video_url like_count view_count scene_id lineage author_id')
    .sort({ like_count: -1, createdAt: -1 })
    .limit(limit)
    .populate('author_id', 'username display_name avatar')
    .populate('scene_id', 'title quote start_time end_time')
}

// 批次更新來源的統計數據
MemeSchema.statics.updateSourceCounts = async function (sourceId) {
  const Source = mongoose.model('Source')
  const source = await Source.findById(sourceId)
  if (source) {
    await source.updateCounts()
  }
}

// 批次更新片段的統計數據
MemeSchema.statics.updateSceneCounts = async function (sceneId) {
  const Scene = mongoose.model('Scene')
  const scene = await Scene.findById(sceneId)
  if (scene) {
    await scene.updateCounts()
  }
}

export default mongoose.models.Meme || mongoose.model('Meme', MemeSchema)
