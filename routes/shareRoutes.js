import express from 'express'
import {
  createShare,
  getShares,
  getShareById,
  updateShare,
  deleteShare,
} from '../controllers/shareController.js'

const router = express.Router()

// 建立分享
router.post('/', createShare)
// 取得所有分享
router.get('/', getShares)
// 取得單一分享
router.get('/:id', getShareById)
// 更新分享
router.put('/:id', updateShare)
// 刪除分享
router.delete('/:id', deleteShare)

export default router
