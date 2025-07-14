import { Router } from 'express'
import * as auth from '../middleware/authMiddleware.js'
import * as order from '../controllers/orderController.js'

const router = Router()

router.post('/', auth.token, order.create)
router.get('/my', auth.token, order.getMy)
router.get('/all', auth.token, auth.admin, order.getAll)

export default router
