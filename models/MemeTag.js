import mongoose from 'mongoose'

const MemeTagSchema = new mongoose.Schema(
  {
    // 關聯的 Meme ID
    meme_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      required: [true, 'Meme ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: 'Meme ID必須是有效的ObjectId',
      },
    },
    // 關聯的 Tag ID
    tag_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tag',
      required: [true, 'Tag ID為必填'],
      index: true,
      validate: {
        validator: (v) => mongoose.Types.ObjectId.isValid(v),
        message: 'Tag ID必須是有效的ObjectId',
      },
    },
    // 標籤語言
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
    collection: 'meme_tags',
    timestamps: true,
    versionKey: false,
  },
)

export default mongoose.models.MemeTag || mongoose.model('MemeTag', MemeTagSchema)
