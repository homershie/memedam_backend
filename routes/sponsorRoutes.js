import express from 'express'
import {
  createSponsor,
  getSponsors,
  getSponsorById,
  updateSponsor,
  deleteSponsor,
} from '../controllers/sponsorController.js'

const router = express.Router()

// 建立贊助
router.post('/', createSponsor)
// 取得所有贊助
router.get('/', getSponsors)
// 取得單一贊助
router.get('/:id', getSponsorById)
// 更新贊助
router.put('/:id', updateSponsor)
// 刪除贊助
router.delete('/:id', deleteSponsor)

export default router
