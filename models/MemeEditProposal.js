import mongoose from 'mongoose'

const MemeEditProposalSchema = new mongoose.Schema(
  {
    meme_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meme',
      required: true,
      index: true,
    },
    proposer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: String,
    content: String,
    images: [String],
    reason: { type: String, default: '' }, // 建議理由
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewed_at: Date,
    review_comment: String,
  },
  {
    timestamps: true,
    collection: 'meme_edit_proposals',
  },
)

export default mongoose.model('MemeEditProposal', MemeEditProposalSchema)
