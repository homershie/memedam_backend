import express from 'express'
import * as user from '../controllers/userController.js'
import * as auth from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/', user.create)
router.post('/login', auth.login, user.login)
router.delete('/logout', auth.token, user.logout)
router.get('/profile', auth.token, user.profile)
router.patch('/refresh', auth.token, user.refresh)
router.patch('/cart', auth.token, user.cart)
router.get('/cart', auth.token, user.getCart)

export default router
