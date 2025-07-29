import express from 'express'
import {
  createMeme,
  getMemes,
  getMemeById,
  updateMeme,
  deleteMeme,
  addEditor,
  removeEditor,
  getMemesByTags,
  getSearchSuggestions,
  validateUpdateMeme,
} from '../controllers/memeController.js'
import {
  proposeEdit,
  listProposals,
  approveProposal,
  rejectProposal,
} from '../controllers/memeEditProposalController.js'
import { token, canEditMeme, isUser } from '../middleware/auth.js'
import { validateCreateMeme } from '../controllers/memeController.js'
import { arrayUpload } from '../middleware/upload.js'

const router = express.Router()

// 建立迷因
router.post('/', token, isUser, arrayUpload('images', 5), validateCreateMeme, createMeme)
// 取得所有迷因
router.get('/', getMemes)
// 搜尋建議
router.get('/search-suggestions', getSearchSuggestions)
// 進階標籤篩選
router.get('/by-tags', getMemesByTags)
// 取得單一迷因
router.get('/:id', getMemeById)
// 更新迷因
router.put('/:id', token, canEditMeme, arrayUpload('images', 5), validateUpdateMeme, updateMeme)
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
