import mongoose from 'mongoose'
import validator from 'validator'

const SponsorSchema = new mongoose.Schema(
  {
    // 贊助用戶ID（修改為非必填，支援匿名贊助）
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // 移除 required，因為匿名贊助不需要用戶ID
      validate: {
        validator: (v) => !v || mongoose.Types.ObjectId.isValid(v),
        message: '用戶ID必須是有效的ObjectId',
      },
    },
    // 贊助狀態（pending: 待支付, success: 完成, failed: 失敗, refunded: 已退款）
    status: {
      type: String,
      default: 'pending',
      enum: {
        values: ['pending', 'success', 'failed', 'refunded'],
        message: '狀態必須是',
      },
    },
    // 金額
    amount: {
      type: Number,
      required: [true, '金額為必填'],
      min: [1, '金額必須大於0'],
      max: [1000000, '金額過大'],
    },
    // 留言給站方/留言給被贊助人
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, '留言長度不能超過1000字'],
    },
    // 支付方式（預設為 ko-fi）
    payment_method: {
      type: String,
      default: 'ko-fi',
      trim: true,
      maxlength: [50, '支付方式長度不能超過50字'],
    },
    // 第三方金流訂單號
    transaction_id: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '訂單號長度不能超過100字'],
    },
    // 下單時IP
    created_ip: {
      type: String,
      default: '',
      trim: true,
      maxlength: [45, 'IP位址長度不能超過45字'],
      validate: {
        validator: (v) => !v || validator.isIP(v, 4) || validator.isIP(v, 6),
        message: 'IP位址格式不正確',
      },
    },

    // Ko-fi Shop Order 新增字段
    kofi_transaction_id: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Ko-fi 交易ID長度不能超過100字'],
    },
    from_name: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '姓名長度不能超過100字'],
    },
    display_name: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, '顯示名稱長度不能超過100字'],
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: [255, '信箱長度不能超過255字'],
      validate: {
        validator: (v) => !v || validator.isEmail(v),
        message: '信箱格式不正確',
      },
    },
    discord_username: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Discord 用戶名長度不能超過100字'],
    },
    discord_userid: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, 'Discord 用戶ID長度不能超過50字'],
    },
    currency: {
      type: String,
      default: 'USD',
      trim: true,
      maxlength: [10, '貨幣代碼長度不能超過10字'],
    },
    type: {
      type: String,
      default: 'Shop Order',
      trim: true,
      maxlength: [50, '類型長度不能超過50字'],
    },
    direct_link_code: {
      type: String,
      default: '',
      trim: true,
      maxlength: [50, '商品代碼長度不能超過50字'],
    },
    shop_items: [
      {
        direct_link_code: String,
        variation_name: String,
        quantity: Number,
      },
    ],
    shipping: {
      full_name: String,
      street_address: String,
      city: String,
      state_or_province: String,
      postal_code: String,
      country: String,
      country_code: String,
      telephone: String,
    },
    is_public: {
      type: Boolean,
      default: true,
    },
    sponsor_level: {
      type: String,
      default: 'soy',
      enum: {
        values: ['soy', 'chicken', 'coffee'],
        message: '贊助等級必須是',
      },
    },
    badge_earned: {
      type: Boolean,
      default: false,
    },

    // 退款處理
    refunded_at: {
      type: Date,
      default: null,
    },
    refund_reason: {
      type: String,
      default: '',
      maxlength: [200, '退款原因長度不能超過200字'],
    },
    refund_amount: {
      type: Number,
      default: null,
    },

    // 認領機制（用於匿名贊助後綁定）
    claimed_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claim_token: {
      type: String,
      default: '',
    },
    claim_token_expires: {
      type: Date,
      default: null,
    },

    // 訊息審核
    message_reviewed: {
      type: Boolean,
      default: false,
    },
    message_auto_filtered: {
      type: Boolean,
      default: false,
    },
    message_original: {
      type: String,
      default: '',
      maxlength: [2000, '原始訊息長度不能超過2000字'],
      comment: '原始訊息內容（過濾前）',
    },
    message_filter_reason: {
      type: String,
      default: null,
      enum: {
        values: [
          'message_too_long',
          'inappropriate_content',
          'advertisement_content',
          'repeated_content',
          'too_many_special_chars',
          'review_error',
          null,
        ],
        message: '無效的過濾原因',
      },
      validate: {
        validator: function (v) {
          if (v === null) return true
          return [
            'message_too_long',
            'inappropriate_content',
            'advertisement_content',
            'repeated_content',
            'too_many_special_chars',
            'review_error',
          ].includes(v)
        },
        message: '無效的過濾原因',
      },
      comment: '訊息過濾原因',
    },
    message_filter_severity: {
      type: String,
      default: 'low',
      enum: {
        values: ['low', 'medium', 'high'],
        message: '無效的過濾嚴重程度',
      },
      validate: {
        validator: function (v) {
          return ['low', 'medium', 'high'].includes(v)
        },
        message: '無效的過濾嚴重程度',
      },
      comment: '訊息過濾嚴重程度',
    },
    requires_manual_review: {
      type: Boolean,
      default: false,
      comment: '是否需要人工審核',
    },

    // Shop Items 處理資訊
    shop_items_parsed: {
      type: Boolean,
      default: false,
      comment: '是否已解析 Shop Items 數據',
    },
    shop_items_merged: {
      type: Boolean,
      default: false,
      comment: '是否合併了多個 Shop Items',
    },
    shop_items_quantity: {
      type: Number,
      default: 1,
      comment: 'Shop Items 總數量',
    },
    shop_items_total_amount: {
      type: Number,
      default: null,
      comment: 'Shop Items 總金額（合併後）',
    },
    shop_items_raw_total_amount: {
      type: Number,
      default: null,
      comment: 'Shop Items 原始總金額（合併前）',
    },
    shop_items_merge_rule: {
      type: String,
      default: null,
      enum: {
        values: ['highest', 'sum', 'average', null],
        message: '無效的合併規則',
      },
      validate: {
        validator: function (v) {
          if (v === null) return true
          return ['highest', 'sum', 'average'].includes(v)
        },
        message: '無效的合併規則',
      },
      comment: 'Shop Items 合併規則',
    },

    // 多幣別支援
    amount_twd: {
      type: Number,
      default: null,
      comment: '台幣金額',
    },
    amount_usd: {
      type: Number,
      default: null,
      comment: '美元金額（統一基準）',
    },
    amount_original: {
      type: Number,
      default: null,
      comment: '原始金額（原始幣別）',
    },
    currency_original: {
      type: String,
      default: '',
      maxlength: [10, '原始幣別代碼長度不能超過10字'],
      comment: '原始幣別代碼',
    },
    exchange_rate: {
      type: Number,
      default: null,
      comment: '換匯匯率（相對於USD）',
    },
    exchange_rate_used: {
      type: String,
      default: '',
      comment: '使用的匯率資訊',
    },

    // 統計與分析欄位
    processed_at: {
      type: Date,
      default: null,
    },
    retry_count: {
      type: Number,
      default: 0,
    },
    error_message: {
      type: String,
      default: '',
      maxlength: [500, '錯誤訊息長度不能超過500字'],
    },
  },
  {
    collection: 'sponsors',
    timestamps: true,
    versionKey: false,
  },
)

// 資料庫索引
SponsorSchema.index({ kofi_transaction_id: 1 }, { unique: true }) // 防重複交易
SponsorSchema.index({ email: 1 }) // 用戶查詢
SponsorSchema.index({ user_id: 1 }) // 用戶關聯查詢
SponsorSchema.index({ claimed_by_user_id: 1 }) // 認領用戶查詢
SponsorSchema.index({ claim_token: 1 }) // 認領token查詢
SponsorSchema.index({ is_public: 1, sponsor_level: 1, createdAt: -1 }) // 前端顯示查詢
SponsorSchema.index({ status: 1, createdAt: -1 }) // 管理後台查詢
SponsorSchema.index({ refunded_at: 1 }) // 退款查詢
SponsorSchema.index({ message_reviewed: 1, message_auto_filtered: 1 }) // 審核狀態查詢
SponsorSchema.index({ direct_link_code: 1 }) // 商品統計查詢

export default mongoose.models.Sponsor || mongoose.model('Sponsor', SponsorSchema)
