import express from 'express'
import {
  createSponsor,
  getSponsors,
  getSponsorById,
  updateSponsor,
  deleteSponsor,
} from '../controllers/sponsorController.js'
import { token, isUser, isManager } from '../middleware/auth.js'

const router = express.Router()

// 建立贊助
router.post('/', token, isUser, createSponsor)
// 取得所有贊助
router.get('/', token, isManager, getSponsors)
// 取得單一贊助
router.get('/:id', token, isUser, getSponsorById)
// 更新贊助
router.put('/:id', token, isUser, updateSponsor)
// 刪除贊助
router.delete('/:id', token, isManager, deleteSponsor)

export default router
