import { Router } from 'express'
import * as product from '../controllers/productController.js'
import * as auth from '../middleware/authMiddleware.js'
import upload from '../middleware/uploadMiddleware.js'

const router = Router()

router.post('/', auth.token, auth.admin, upload, product.create)
router.get('/all', auth.token, product.getAll)
// 必須放在 /all 後面，因為 all 會被當作 id
router.get('/:id', product.getId)
router.get('/', product.get)
router.patch('/:id', auth.token, auth.admin, upload, product.update)

export default router
