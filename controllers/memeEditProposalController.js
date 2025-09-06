import MemeEditProposal from '../models/MemeEditProposal.js'
import Meme from '../models/Meme.js'
import { StatusCodes } from 'http-status-codes'
import { logger } from '../utils/logger.js'

// 提交修改提案
export const proposeEdit = async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    const { title, content, images, reason } = req.body
    if (!title && !content && !images) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '請提供修改內容' })
    }
    const proposal = await MemeEditProposal.create({
      meme_id: meme._id,
      proposer_id: req.user._id,
      title,
      content,
      images,
      reason,
    })
    res.status(201).json({ success: true, proposal })
  } catch (error) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        memeId: req.body.meme_id,
        userId: req.user?._id,
        event: 'create_edit_proposal_error',
      },
      '創建編輯提案時發生錯誤',
    )
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 查詢所有提案（僅作者/協作者/管理員）
export const listProposals = async (req, res) => {
  try {
    const proposals = await MemeEditProposal.find({ meme_id: req.params.id })
      .populate('proposer_id', 'username email')
      .sort({ createdAt: -1 })
    res.json({ success: true, proposals })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 審核通過
export const approveProposal = async (req, res) => {
  try {
    const proposal = await MemeEditProposal.findById(req.params.proposalId)
    if (!proposal)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到提案' })
    if (proposal.status !== 'pending') {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '提案已審核' })
    }
    // 將提案內容寫入 Meme
    const meme = await Meme.findById(proposal.meme_id)
    if (!meme)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到迷因' })
    if (proposal.title) meme.title = proposal.title
    if (proposal.content) meme.content = proposal.content
    if (proposal.images) meme.images = proposal.images
    await meme.save()
    // 更新提案狀態
    proposal.status = 'approved'
    proposal.reviewer_id = req.user._id
    proposal.reviewed_at = new Date()
    proposal.review_comment = req.body.review_comment || ''
    await proposal.save()
    res.json({ success: true, meme, proposal })
  } catch {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}

// 駁回提案
export const rejectProposal = async (req, res) => {
  try {
    const proposal = await MemeEditProposal.findById(req.params.proposalId)
    if (!proposal)
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: '找不到提案' })
    if (proposal.status !== 'pending') {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: '提案已審核' })
    }
    proposal.status = 'rejected'
    proposal.reviewer_id = req.user._id
    proposal.reviewed_at = new Date()
    proposal.review_comment = req.body.review_comment || ''
    await proposal.save()
    res.json({ success: true, proposal })
  } catch (error) {
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        proposalId: req.params.proposalId,
        userId: req.user?._id,
        event: 'reject_edit_proposal_error',
      },
      '拒絕編輯提案時發生錯誤',
    )
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: '伺服器錯誤' })
  }
}
