import mongoose from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcrypt'

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, '帳號必填'],
      unique: true,
      minlength: [8, '帳號至少8個字元'],
      maxlength: [20, '帳號最多20個字元'],
      trim: true,
      validate: {
        validator(value) {
          return validator.isAlphanumeric(value)
        },
        message: '帳號只能包含英文字母和數字',
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
    email: {
      type: String,
      required: [true, '電子郵件必填'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator(value) {
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
      required: [true, '密碼必填'],
      minlength: [8, '密碼至少8個字元'],
      maxlength: [20, '密碼最多20個字元'],
      validate: {
        validator(value) {
          // 密碼必須包含至少一個字母和一個數字
          const hasLetter = /[a-zA-Z]/.test(value)
          const hasNumber = /\d/.test(value)
          return hasLetter && hasNumber
        },
        message: '密碼必須包含至少一個字母和一個數字',
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
    email_verified: { type: Boolean, default: false },
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
  // 如果密碼欄位有修改，進行加密
  if (user.isModified('password')) {
    // 使用與 Schema 一致的驗證規則
    if (user.password.length < 8 || user.password.length > 20) {
      // 如果密碼長度不符合規定，拋出 mongoose 的驗證錯誤
      // 用跟 mongoose 的 schema 驗證錯誤一樣的錯誤格式
      // 可以跟其他驗證錯誤一起處理
      const error = new Error.ValidationError()
      // 設定密碼欄位錯誤
      error.addError(
        'password',
        new Error.ValidationError({ message: '密碼長度必須在8到20個字元之間' }),
      )
      // 繼續處理，把錯誤傳出去
      // mongoose 遇到錯誤就不會存入資料庫
      next(error)
      return
    } else {
      // 使用 bcrypt 加密
      user.password = bcrypt.hashSync(user.password, 10)
    }
  }
  // 限制有效 token 數量（修正：tokens 是簡單字串陣列）
  if (user.isModified('tokens') && user.tokens && user.tokens.length > 3) {
    // 保留最新的 3 個 token（移除最舊的）
    user.tokens = user.tokens.slice(-3)
  }
  // 繼續處理
  next()
})

// 虛擬的動態欄位
// 資料庫中不會儲存 cartTotal 欄位
// 自動計算購物車總數量
// 當 cart 內容改變時，cartTotal 會自動反映最新狀態
UserSchema.virtual('cartTotal').get(function () {
  // this = 現在的資料
  const user = this
  return user.cart.reduce((total, item) => {
    return total + item.quantity
  }, 0)
})

export default mongoose.model('User', UserSchema)
