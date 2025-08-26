import mongoose from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcrypt'

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, '使用者名稱必填'],
      unique: true,
      minlength: [5, '使用者名稱至少5個字元'],
      maxlength: [30, '使用者名稱最多30個字元'],
      trim: true,
      validate: {
        validator(value) {
          // 僅允許小寫英文字母、數字、底線與句點
          return /^[a-z0-9._]+$/.test(value)
        },
        message: '使用者名稱只能包含小寫英文字母、數字、底線(_)與句點(.)，且不超過30個字元',
      },
    },
    display_name: {
      type: String,
      default: '',
      maxlength: [50, '顯示名稱最多50個字元'],
      trim: true,
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            return value.length <= 50
          }
          return true
        },
        message: '顯示名稱不能超過50個字元',
      },
    },
    // Privacy consent association
    privacyConsentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrivacyConsent',
    },
    lastConsentUpdate: {
      type: Date,
    },
    email: {
      type: String,
      required: function () {
        // 如果是社群登入用戶（有社群 ID），則email不是必需的
        return !(this.google_id || this.facebook_id || this.discord_id || this.twitter_id)
      },
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator(value) {
          // 如果是社群用戶且沒有email，跳過驗證
          if (
            (this.google_id || this.facebook_id || this.discord_id || this.twitter_id) &&
            !value
          ) {
            return true
          }
          return validator.isEmail(value)
        },
        message: '請輸入有效的電子郵件地址',
      },
    },
    phone: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            // 台灣手機號碼格式驗證 (09開頭，共10位數字)
            const phoneRegex = /^09\d{8}$/
            return phoneRegex.test(value.replace(/\s/g, ''))
          }
          return true
        },
        message: '請輸入有效的台灣手機號碼 (09開頭，共10位數字)',
      },
    },
    password: {
      type: String,
      required: function () {
        // 如果是社群登入用戶（有社群 ID），則密碼不是必需的
        return !(this.google_id || this.facebook_id || this.discord_id || this.twitter_id)
      },
      validate: {
        validator: function (value) {
          // 如果是社群用戶，跳過密碼驗證
          if (this.google_id || this.facebook_id || this.discord_id || this.twitter_id) {
            return true
          }
          // 對於本地用戶，密碼是必需的
          return value && value.length > 0
        },
        message: '密碼必填',
      },
    },
    has_password: {
      type: Boolean,
      default: false,
      validate: {
        validator(value) {
          return typeof value === 'boolean'
        },
        message: 'has_password 必須是布林值',
      },
    },
    tokens: {
      type: [String],
      validate: {
        validator(value) {
          if (Array.isArray(value)) {
            return value.length <= 3
          }
          return true
        },
        message: '最多只能有3個有效的登入token',
      },
    },
    google_id: { type: String, unique: true, sparse: true, default: undefined },
    facebook_id: { type: String, unique: true, sparse: true, default: undefined },
    discord_id: { type: String, unique: true, sparse: true, default: undefined },
    twitter_id: { type: String, unique: true, sparse: true, default: undefined },
    avatar: {
      type: String,
      default: '',
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            return validator.isURL(value, { protocols: ['http', 'https'] })
          }
          return true
        },
        message: '頭像必須是有效的URL地址',
      },
    },
    cover_image: {
      type: String,
      default: '',
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            return validator.isURL(value, { protocols: ['http', 'https'] })
          }
          return true
        },
        message: '封面圖片必須是有效的URL地址',
      },
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, '個人簡介最多500個字元'],
      trim: true,
    },
    gender: {
      type: String,
      default: '',
      enum: ['', 'male', 'female', 'other'],
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            return ['male', 'female', 'other'].includes(value)
          }
          return true
        },
        message: '性別只能是 male、female 或 other',
      },
    },
    location: {
      type: String,
      default: '',
      maxlength: [100, '位置資訊最多100個字元'],
      trim: true,
    },
    role: {
      type: String,
      default: 'user',
      enum: ['user', 'admin', 'auditor', 'manager'],
      validate: {
        validator(value) {
          return ['user', 'vip', 'admin', 'manager'].includes(value)
        },
        message: '角色只能是 user、vip、admin、manager',
      },
    },
    status: {
      type: String,
      default: 'active',
      enum: ['active', 'banned', 'pending', 'deleted', 'suspended'],
      validate: {
        validator(value) {
          return ['active', 'banned', 'pending', 'deleted', 'suspended'].includes(value)
        },
        message: '狀態只能是 active、banned、pending、deleted 或 suspended',
      },
    },
    ban_reason: {
      type: String,
      default: '',
      maxlength: [200, '封禁原因最多200個字元'],
      trim: true,
    },
    email_verified: {
      type: Boolean,
      default: false,
      validate: {
        validator(value) {
          return typeof value === 'boolean'
        },
        message: 'email_verified 必須是布林值',
      },
    },
    login_method: {
      type: String,
      default: 'local',
      enum: ['local', 'google', 'facebook', 'discord', 'twitter'],
      validate: {
        validator(value) {
          return ['local', 'google', 'facebook', 'discord', 'twitter'].includes(value)
        },
        message: '登入方式只能是 local、google、facebook、discord 或 twitter',
      },
    },
    needs_username_selection: {
      type: Boolean,
      default: false,
      validate: {
        validator(value) {
          return typeof value === 'boolean'
        },
        message: 'needs_username_selection 必須是布林值',
      },
    },
    birthday: {
      type: Date,
      validate: {
        validator(value) {
          if (value) {
            // 檢查生日不能是未來日期
            const today = new Date()
            return value <= today
          }
          return true
        },
        message: '生日不能是未來日期',
      },
    },

    last_login_at: {
      type: Date,
      validate: {
        validator(value) {
          if (value) {
            // 檢查最後登入時間不能是未來日期
            const today = new Date()
            return value <= today
          }
          return true
        },
        message: '最後登入時間不能是未來日期',
      },
    },
    last_ip: {
      type: String,
      default: '',
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            return validator.isIP(value, 4) || validator.isIP(value, 6)
          }
          return true
        },
        message: '請輸入有效的IP地址',
      },
    },
    join_ip: {
      type: String,
      default: '',
      validate: {
        validator(value) {
          if (value && value.trim().length > 0) {
            return validator.isIP(value, 4) || validator.isIP(value, 6)
          }
          return true
        },
        message: '請輸入有效的IP地址',
      },
    },
    user_agent: {
      type: String,
      default: '',
      maxlength: [500, 'User Agent 最多500個字元'],
      trim: true,
    },
    exp: {
      type: Number,
      default: 0,
      min: [0, '經驗值不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '經驗值必須是非負整數',
      },
    },
    verified_at: {
      type: Date,
      validate: {
        validator(value) {
          if (value) {
            // 檢查驗證時間不能是未來日期
            const today = new Date()
            return value <= today
          }
          return true
        },
        message: '驗證時間不能是未來日期',
      },
    },
    deactivate_at: {
      type: Date,
      validate: {
        validator(value) {
          if (value) {
            // 檢查停用時間不能是未來日期
            const today = new Date()
            return value <= today
          }
          return true
        },
        message: '停用時間不能是未來日期',
      },
    },
    register_from: {
      type: String,
      default: 'web',
      enum: ['web', 'mobile', 'api'],
      validate: {
        validator(value) {
          return ['web', 'mobile', 'api'].includes(value)
        },
        message: '註冊來源只能是 web、mobile 或 api',
      },
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator(value) {
          // 檢查 preferences 是否為物件
          return typeof value === 'object' && value !== null
        },
        message: '偏好設定必須是物件格式',
      },
    },
    // 功能 Cookie 相關偏好設定
    functionalPreferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
        validate: {
          validator(value) {
            return ['light', 'dark', 'auto'].includes(value)
          },
          message: '主題設定只能是 light、dark 或 auto',
        },
      },
      language: {
        type: String,
        enum: ['zh-TW', 'en-US', 'ja-JP'],
        default: 'zh-TW',
        validate: {
          validator(value) {
            return ['zh-TW', 'en-US', 'ja-JP'].includes(value)
          },
          message: '語言設定只能是 zh-TW、en-US 或 ja-JP',
        },
      },
      personalization: {
        autoPlay: { type: Boolean, default: true },
        showNSFW: { type: Boolean, default: false },
        compactMode: { type: Boolean, default: false },
        infiniteScroll: { type: Boolean, default: true },
        notificationPreferences: {
          email: { type: Boolean, default: true },
          push: { type: Boolean, default: true },
          mentions: { type: Boolean, default: true },
          likes: { type: Boolean, default: true },
          comments: { type: Boolean, default: true },
        },
      },
      searchPreferences: {
        searchHistory: { type: Boolean, default: true },
        searchSuggestions: { type: Boolean, default: true },
        defaultSort: {
          type: String,
          enum: ['hot', 'new', 'top', 'rising'],
          default: 'hot',
          validate: {
            validator(value) {
              return ['hot', 'new', 'top', 'rising'].includes(value)
            },
            message: '預設排序只能是 hot、new、top 或 rising',
          },
        },
        defaultFilter: {
          type: String,
          enum: ['all', 'sfw', 'nsfw'],
          default: 'all',
          validate: {
            validator(value) {
              return ['all', 'sfw', 'nsfw'].includes(value)
            },
            message: '預設篩選只能是 all、sfw 或 nsfw',
          },
        },
      },
    },
    // 追隨功能相關統計
    follower_count: {
      type: Number,
      default: 0,
      min: [0, '粉絲數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '粉絲數必須是非負整數',
      },
    },
    following_count: {
      type: Number,
      default: 0,
      min: [0, '追隨數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '追隨數必須是非負整數',
      },
    },
    // 用戶創作統計
    meme_count: {
      type: Number,
      default: 0,
      min: [0, '發布迷因數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '發布迷因數必須是非負整數',
      },
    },
    collection_count: {
      type: Number,
      default: 0,
      min: [0, '收藏數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '收藏數必須是非負整數',
      },
    },
    // 獲得的總互動統計
    total_likes_received: {
      type: Number,
      default: 0,
      min: [0, '獲得讚數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '獲得讚數必須是非負整數',
      },
    },
    // 用戶活動統計
    comment_count: {
      type: Number,
      default: 0,
      min: [0, '評論數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '評論數必須是非負整數',
      },
    },
    share_count: {
      type: Number,
      default: 0,
      min: [0, '分享數不能為負數'],
      validate: {
        validator(value) {
          return Number.isInteger(value) && value >= 0
        },
        message: '分享數必須是非負整數',
      },
    },
    // 通知設定
    notificationSettings: {
      browser: { type: Boolean, default: false },
      newFollower: { type: Boolean, default: true },
      newComment: { type: Boolean, default: true },
      newLike: { type: Boolean, default: true },
      newMention: { type: Boolean, default: true },
      trendingContent: { type: Boolean, default: false },
      weeklyDigest: { type: Boolean, default: true },
    },
    // Username 變更相關欄位
    username_changed_at: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          if (!value) return true
          return value instanceof Date && !isNaN(value)
        },
        message: 'username變更時間必須是有效的日期',
      },
    },
    previous_usernames: [
      {
        username: {
          type: String,
          trim: true,
          validate: {
            validator(value) {
              return /^[a-z0-9._]+$/.test(value)
            },
            message: '用戶名只能包含小寫英文字母、數字、底線(_)與句點(.)',
          },
        },
        changed_at: {
          type: Date,
          default: Date.now,
          validate: {
            validator(value) {
              return value instanceof Date && !isNaN(value)
            },
            message: '變更時間必須是有效的日期',
          },
        },
      },
    ],
  },
  {
    timestamps: true,
    collection: 'users',
  },
)

// 在保存前對密碼進行處理
// 盡量用 function 不要用箭頭
// 使用 next 來讓 mongoose 繼續處理
UserSchema.pre('save', function (next) {
  // this = 現在要保存的資料
  const user = this

  // 檢查是否為社群登入用戶（有社群 ID）
  const isSocialUser = !!(user.google_id || user.facebook_id || user.discord_id || user.twitter_id)

  // 如果是社群用戶且沒有密碼，生成一個隨機密碼
  if (isSocialUser && !user.password) {
    // 為社群用戶生成隨機密碼（12個字元，符合8-20的驗證要求）
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let randomPassword = ''
    for (let i = 0; i < 12; i++) {
      randomPassword += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    user.password = randomPassword
  }

  // 如果密碼欄位有修改，進行加密
  if (user.isModified('password')) {
    // 對於社群用戶，跳過密碼長度驗證
    if (!isSocialUser && (user.password.length < 8 || user.password.length > 20)) {
      // 直接回傳錯誤訊息，讓 Mongoose 包裝為 ValidationError
      next(new Error('密碼長度必須在8到20個字元之間'))
      return
    } else {
      // 使用 bcrypt 加密
      user.password = bcrypt.hashSync(user.password, 10)
      // 更新 has_password 欄位
      // 只有非社群用戶才設定 has_password 為 true
      // 社群用戶的 has_password 由外部邏輯控制（如 changePassword API）
      if (!isSocialUser) {
        user.has_password = true
      }
    }
  }

  // 限制有效 token 數量（修正：tokens 是簡單字串陣列）
  if (user.isModified('tokens') && user.tokens && user.tokens.length > 3) {
    // 保留最新的 3 個 token（移除最舊的）
    user.tokens = user.tokens.slice(-3)
  }

  // 處理 username 變更
  if (user.isModified('username') && !user.isNew) {
    // 檢查是否可以變更 username（一個月只能變更一次）
    if (user.username_changed_at) {
      const lastChangeTime = new Date(user.username_changed_at)
      const currentTime = new Date()
      const timeDiff = currentTime - lastChangeTime
      const oneMonthInMs = 30 * 24 * 60 * 60 * 1000 // 30天的毫秒數

      if (timeDiff < oneMonthInMs) {
        const remainingDays = Math.ceil((oneMonthInMs - timeDiff) / (24 * 60 * 60 * 1000))
        const error = new Error(
          `username 一個月只能變更一次，還需要等待 ${remainingDays} 天才能再次變更`,
        )
        error.name = 'ValidationError'
        next(error)
        return
      }
    }

    // 更新變更時間
    user.username_changed_at = new Date()
  }

  // 繼續處理
  next()
})

// 虛擬欄位：自動生成頭像
// 如果用戶沒有上傳 avatar，則使用 Dicebear API 生成
UserSchema.virtual('avatarUrl').get(function () {
  const user = this
  // 如果有自訂頭像，使用自訂頭像
  if (user.avatar && user.avatar.trim().length > 0) {
    return user.avatar
  }
  // 沒有頭像時，使用 Dicebear API 生成，以 username 作為 seed
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(user.username)}`
})

// 確保虛擬欄位在 JSON 序列化時包含進來
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    // 移除敏感資訊
    delete ret.password
    delete ret.tokens
    delete ret.__v
    return ret
  },
})

UserSchema.set('toObject', { virtuals: true })

// 避免在測試或多次載入時重複編譯模型
export default mongoose.models.User || mongoose.model('User', UserSchema)
