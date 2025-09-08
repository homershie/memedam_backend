import mongoose from 'mongoose'

const AnnouncementSchema = new mongoose.Schema(
  {
    // 公告標題
    title: {
      type: String,
      required: [true, '公告標題為必填'],
      trim: true,
      minlength: [1, '公告標題不能為空'],
      maxlength: [200, '公告標題長度不能超過200字'],
    },
    // 公告內容（支援純文字或結構化JSON）
    content: {
      type: mongoose.Schema.Types.Mixed, // 支援純文字或JSON物件
      required: [true, '公告內容為必填'],
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return false
          if (typeof v === 'string') {
            return v.trim().length >= 1 && v.length <= 10000 // 純文字長度限制
          }
          if (typeof v === 'object') {
            return v && typeof v === 'object' // JSON格式驗證
          }
          return false
        },
        message: '公告內容格式不正確',
      },
    },

    // 內容格式類型（用於區分純文字或JSON）
    content_format: {
      type: String,
      enum: ['plain', 'json'],
      default: 'plain',
      required: true,
    },
    // 發布者 user id
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '發布者ID為必填'],
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: '發布者ID必須是有效的ObjectId',
      },
    },
    // 公告狀態（draft: 草稿, public: 已發佈, hidden: 隱藏, deleted: 已刪除）
    status: {
      type: String,
      default: 'draft',
      enum: {
        values: ['draft', 'public', 'hidden', 'deleted'],
        message: '公告狀態必須是 draft、public、hidden、deleted',
      },
    },
    // 是否置頂
    pinned: {
      type: Boolean,
      default: false,
    },
    // 預約上架時間
    visible_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '上架時間必須是有效日期',
      },
    },
    // 自動下架時間
    expired_at: {
      type: Date,
      validate: {
        validator: (v) => !v || (v instanceof Date && !isNaN(v)),
        message: '下架時間必須是有效日期',
      },
    },
    // 分類（如系統、活動、更新…）
    category: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, '分類長度不能超過50字'],
      enum: {
        values: ['system', 'activity', 'update', 'other'],
        message: '分類必須是 system、activity、update、other',
      },
    },
    // 公告主圖
    image: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true // 允許空值
          // 允許 Cloudinary URL 或一般圖片 URL（支援各種格式）
          const cloudinaryPattern = /^https:\/\/res\.cloudinary\.com\/.*\/image\/upload\/.*$/
          const imagePatterns = [
            // 有副檔名的圖片URL
            /^https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico|avif)(\?.*)?$/i,
            // Unsplash等服務的URL（沒有副檔名但有圖片參數）
            /^https?:\/\/[^\s]+\/[^\s]*\?(.*&)?auto=format(&.*)?$/i,
            // 其他圖片服務的URL（檢查常見圖片相關關鍵字）
            /^https?:\/\/[^\s]+\/[^\s]*(format|image|photo|picture|img)[^\s]*$/i,
            // 允許沒有副檔名的圖片URL（只要是圖片服務域名）
            /^https?:\/\/(images\.unsplash\.com|plus\.unsplash\.com|i\.imgur\.com|cdn\.pixabay\.com|images\.pexels\.com)[^\s]*$/i,
          ]
          return cloudinaryPattern.test(v) || imagePatterns.some((pattern) => pattern.test(v))
        },
        message: '圖片必須是有效的 Cloudinary URL 或圖片連結',
      },
    },
    // 內容中使用的圖片URL列表（用於清理和管理）
    content_images: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          if (!Array.isArray(v)) return false
          // 驗證每個URL的格式
          return v.every((url) => {
            if (!url || typeof url !== 'string') return false
            // 允許 Cloudinary URL 或一般圖片 URL
            const cloudinaryPattern = /^https:\/\/res\.cloudinary\.com\/.*\/image\/upload\/.*$/
            const imagePatterns = [
              /^https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico|avif)(\?.*)?$/i,
              /^https?:\/\/[^\s]+\/[^\s]*\?(.*&)?auto=format(&.*)?$/i,
              /^https?:\/\/[^\s]+\/[^\s]*(format|image|photo|picture|img)[^\s]*$/i,
              /^https?:\/\/(images\.unsplash\.com|plus\.unsplash\.com|i\.imgur\.com|cdn\.pixabay\.com|images\.pexels\.com)[^\s]*$/i,
            ]
            return cloudinaryPattern.test(url) || imagePatterns.some((pattern) => pattern.test(url))
          })
        },
        message: 'content_images 必須是有效的圖片URL陣列',
      },
    },
  },
  {
    collection: 'announcements',
    timestamps: true,
  },
)

export default mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema)
