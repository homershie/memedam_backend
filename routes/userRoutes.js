import express from 'express'
import {
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  bindSocialAccount,
  getMe, // 新增 getMe
  updateMe, // 新增
  deleteMe, // 新增
} from '../controllers/userController.js'
import { login, logout, refresh } from '../controllers/authController.js'
import { token, isUser, isManager } from '../middleware/auth.js'
import { singleUpload } from '../middleware/upload.js'
import passport from 'passport'
import { signToken } from '../utils/jwt.js'

const router = express.Router()

// 使用者 CRUD
router.post('/', createUser)
router.get('/', token, isManager, getUsers)
router.get('/me', token, isUser, getMe)
router.put('/me', token, isUser, singleUpload('avatar'), updateMe)
router.delete('/me', token, isUser, deleteMe)
router.get('/:id', getUser)
router.put('/:id', token, isManager, singleUpload('avatar'), updateUser)
router.delete('/:id', token, isManager, deleteUser)

// 認證與社群登入
router.post('/login', login)
router.post('/logout', token, logout)
router.post('/refresh', token, refresh)

// 綁定社群帳號
router.post('/bind/:provider', token, bindSocialAccount)

// 觸發 Google OAuth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// Google OAuth callback
router.get(
  '/users/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // 登入成功，產生 JWT token
      const token = signToken({ _id: req.user._id })
      req.user.tokens = req.user.tokens || []
      req.user.tokens.push(token)
      await req.user.save()

      // 可以導向前端並帶上 token，或直接回傳 JSON
      res.redirect(`/?token=${token}`) // 或改為 res.json({ success: true, token, user: req.user })
    } catch (error) {
      console.error('Google OAuth callback 錯誤:', error)
      res.redirect('/login?error=server_error')
    }
  },
)

// 觸發 Facebook OAuth
router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }))

// Facebook OAuth callback
router.get(
  '/users/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const token = signToken({ _id: req.user._id })
      req.user.tokens = req.user.tokens || []
      req.user.tokens.push(token)
      await req.user.save()

      res.redirect(`/?token=${token}`)
    } catch (error) {
      console.error('Facebook OAuth callback 錯誤:', error)
      res.redirect('/login?error=server_error')
    }
  },
)

// 觸發 Discord OAuth
router.get('/auth/discord', passport.authenticate('discord'))

// Discord OAuth callback
router.get(
  '/users/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const token = signToken({ _id: req.user._id })
      req.user.tokens = req.user.tokens || []
      req.user.tokens.push(token)
      await req.user.save()

      res.redirect(`/?token=${token}`)
    } catch (error) {
      console.error('Discord OAuth callback 錯誤:', error)
      res.redirect('/login?error=server_error')
    }
  },
)
// Twitter OAuth callback

// 觸發 Twitter OAuth
router.get('/auth/twitter', passport.authenticate('twitter-oauth2'))

// Twitter OAuth callback
router.get(
  '/users/auth/twitter/callback',
  passport.authenticate('twitter-oauth2', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const token = signToken({ _id: req.user._id })
      req.user.tokens = req.user.tokens || []
      req.user.tokens.push(token)
      await req.user.save()

      res.redirect(`/?token=${token}`)
    } catch (error) {
      console.error('Twitter OAuth callback 錯誤:', error)
      res.redirect('/login?error=server_error')
    }
  },
)

export default router
