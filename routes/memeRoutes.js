import express from 'express'
import {
  createMeme,
  getMemes,
  getMemeById,
  updateMeme,
  deleteMeme,
  addEditor,
  removeEditor,
} from '../controllers/memeController.js'
import {
  proposeEdit,
  listProposals,
  approveProposal,
  rejectProposal,
} from '../controllers/memeEditProposalController.js'
import { token, canEditMeme, isUser } from '../middleware/auth.js'
import { validateCreateMeme } from '../controllers/memeController.js'

const router = express.Router()

// 建立迷因
router.post('/', token, isUser, validateCreateMeme, createMeme)
// 取得所有迷因
router.get('/', getMemes)
// 取得單一迷因
router.get('/:id', getMemeById)
// 更新迷因
router.put('/:id', token, canEditMeme, updateMeme)
// 刪除迷因
router.delete('/:id', token, canEditMeme, deleteMeme)
// 新增協作者
router.post('/:id/editors', token, addEditor)
// 移除協作者
router.delete('/:id/editors', token, removeEditor)
// 提交修改提案
router.post('/:id/proposals', token, proposeEdit)
// 查詢所有提案（僅作者/協作者/管理員）
router.get('/:id/proposals', token, canEditMeme, listProposals)
// 審核通過
router.post('/:id/proposals/:proposalId/approve', token, canEditMeme, approveProposal)
// 駁回提案
router.post('/:id/proposals/:proposalId/reject', token, canEditMeme, rejectProposal)

export default router
