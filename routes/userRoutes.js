import express from 'express'
import {
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
} from '../controllers/userController.js'
import {
  login,
  logout,
  refresh,
  googleLogin,
  facebookLogin,
  discordLogin,
  twitterLogin,
} from '../controllers/authController.js'
import { token, isUser, isManager } from '../middleware/auth.js'
import { singleUpload } from '../middleware/upload.js'

const router = express.Router()

// 使用者 CRUD
router.post('/', createUser)
router.get('/', token, isManager, getUsers)
router.get('/:id', token, isManager, getUser)
router.put('/:id', token, isManager, singleUpload('avatar'), updateUser)
router.delete('/:id', token, isManager, deleteUser)
router.get('/me', token, isUser, getUser)
router.put('/me', token, isUser, singleUpload('avatar'), updateUser)
router.delete('/me', token, isUser, deleteUser)

// 認證與社群登入
router.post('/login', login)
router.post('/logout', token, logout)
router.post('/refresh', token, refresh)
router.get('/auth/google/callback', googleLogin)
router.get('/auth/facebook/callback', facebookLogin)
router.get('/auth/discord/callback', discordLogin)
router.get('/auth/twitter/callback', twitterLogin)

export default router
