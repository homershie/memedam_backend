import express from 'express'
import {
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  bindSocialAccount,
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
import passport from 'passport'

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

// 綁定社群帳號
router.post('/bind/:provider', token, bindSocialAccount)

// 觸發 Google OAuth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// Google OAuth callback
router.get(
  '/users/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // 登入成功，導向前端或回傳 token
    res.redirect('/') // 或自訂 callback 處理
  },
)

// 觸發 Facebook OAuth
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }))

// Facebook OAuth callback
router.get(
  '/users/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    // 登入成功，導向前端或回傳 token
    res.redirect('/') // 或自訂 callback 處理
  },
)

// 觸發 Discord OAuth
router.get('/auth/discord', passport.authenticate('discord'))

// Discord OAuth callback
router.get(
  '/users/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login', successRedirect: '/' }),
  (req, res) => {
    // 登入成功，導向前端或回傳 token
    res.redirect('/') // 或自訂 callback 處理
  },
)
// Twitter OAuth callback

// 觸發 Twitter OAuth
router.get('/auth/twitter', passport.authenticate('twitter-oauth2'))

// Twitter OAuth callback
router.get(
  '/users/auth/twitter/callback',
  passport.authenticate('twitter-oauth2', { failureRedirect: '/login' }),
  function (req, res) {
    // 登入成功，導向前端或回傳 token
    res.redirect('/') // 或自訂 callback 處理
  },
)

export default router
