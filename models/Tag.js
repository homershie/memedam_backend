import mongoose from 'mongoose'

const TagSchema = new mongoose.Schema(
  {
    // 標籤名稱
    name: {
      type: String,
      required: [true, '標籤名稱為必填'],
      index: true,
      unique: true,
      trim: true,
      minlength: [1, '標籤名稱不能為空'],
      maxlength: [50, '標籤名稱長度不能超過50字'],
    },
    // 語言（如zh, en…）
    lang: {
      type: String,
      default: 'zh',
      enum: {
        values: ['zh', 'en', 'ja', 'ko'],
        message: '語言必須是 zh、en、ja、ko',
      },
    },
  },
  {
    collection: 'tags',
    timestamps: true,
    versionKey: false,
  },
)

export default mongoose.model('Tag', TagSchema)
