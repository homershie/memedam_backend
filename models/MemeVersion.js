import mongoose from 'mongoose'
import validator from 'validator'

const MemeVersionSchema = new mongoose.Schema(
  {
    meme: {
      // 對應到主 Meme 條目的 _id
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      required: [true, '必須指定所屬的 Meme 條目'],
      index: true,
      comment: '所屬的 Meme 條目',
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '無效的 Meme ID 格式',
      },
    },
    proposal_id: {
      // 若此版本來自協作提案，記錄 proposal id
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MemeEditProposal',
      default: null,
      validate: {
        validator: function (v) {
          return v === null || mongoose.Types.ObjectId.isValid(v)
        },
        message: '無效的提案 ID 格式',
      },
      comment: '協作提案 id（如有）',
    },
    version_number: {
      // 此版本的編號（建議從 1 累增）
      type: Number,
      required: [true, '版本號為必填欄位'],
      min: [1, '版本號必須大於 0'],
      comment: '迷因版本號',
      validate: {
        validator: Number.isInteger,
        message: '版本號必須為整數',
      },
    },
    title: {
      // 此版本的迷因標題
      type: String,
      required: [true, '標題為必填欄位'],
      trim: true,
      minlength: [1, '標題不能為空'],
      maxlength: [200, '標題長度不能超過 200 個字元'],
      comment: '迷因標題',
      validate: {
        validator: function (v) {
          return v.trim().length > 0
        },
        message: '標題不能只包含空白字元',
      },
    },
    content: {
      // 迷因說明內容，支援 Markdown 或純文字
      type: String,
      required: [true, '內容為必填欄位'],
      minlength: [1, '內容不能為空'],
      maxlength: [10000, '內容長度不能超過 10000 個字元'],
      comment: '迷因內容',
      validate: {
        validator: function (v) {
          return v.trim().length > 0
        },
        message: '內容不能只包含空白字元',
      },
    },
    images: [
      {
        // 迷因圖片，可以存 cloud 路徑或 URL
        type: String,
        comment: '相關圖片網址',
        validate: {
          validator: function (v) {
            // 檢查是否為有效的 URL 或檔案路徑
            return validator.isURL(v) || v.startsWith('/') || v.startsWith('./')
          },
          message: '圖片路徑格式無效，必須為有效的 URL 或檔案路徑',
        },
      },
    ],
    created_by: {
      // 創建此版本的使用者
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '必須指定建立者'],
      comment: '建立者',
      validate: {
        validator: function (v) {
          return mongoose.Types.ObjectId.isValid(v)
        },
        message: '無效的使用者 ID 格式',
      },
    },
    changelog: {
      // 版本差異說明（如有更動內容可記錄）
      type: String,
      default: '',
      maxlength: [1000, '變更記錄長度不能超過 1000 個字元'],
      comment: '本次變更記錄',
      validate: {
        validator: function (v) {
          return v.length <= 1000
        },
        message: '變更記錄過長',
      },
    },
    status: {
      // 狀態：'active', 'pending', 'rejected'等
      type: String,
      default: 'active',
      enum: {
        values: ['active', 'pending', 'rejected'],
        message: '狀態必須為 active、pending 或 rejected',
      },
      comment: '審核狀態',
      validate: {
        validator: function (v) {
          return ['active', 'pending', 'rejected'].includes(v)
        },
        message: '無效的狀態值',
      },
    },
  },
  {
    collection: 'meme_versions',
    timestamps: true,
    versionKey: false,
  },
)

// 自定義驗證：確保版本號在同一 Meme 下是唯一的
MemeVersionSchema.index({ meme: 1, version_number: 1 }, { unique: true })

// 預儲存中間件：自動更新 updated_at
MemeVersionSchema.pre('save', function (next) {
  this.updated_at = new Date()
  next()
})

// 自定義驗證：檢查版本號是否重複
MemeVersionSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('version_number') || this.isModified('meme')) {
    const existingVersion = await this.constructor.findOne({
      meme: this.meme,
      version_number: this.version_number,
      _id: { $ne: this._id },
    })

    if (existingVersion) {
      const error = new Error('此 Meme 下已存在相同版本號')
      error.name = 'ValidationError'
      return next(error)
    }
  }
  next()
})

// 虛擬欄位：完整版本資訊
MemeVersionSchema.virtual('fullVersion').get(function () {
  return `${this.title} v${this.version_number}`
})

// 確保虛擬欄位在 JSON 序列化時被包含
MemeVersionSchema.set('toJSON', { virtuals: true })
MemeVersionSchema.set('toObject', { virtuals: true })

export default mongoose.models.MemeVersion || mongoose.model('MemeVersion', MemeVersionSchema)
