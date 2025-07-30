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

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - email
 *       properties:
 *         _id:
 *           type: string
 *           description: 用戶唯一ID
 *         username:
 *           type: string
 *           description: 用戶名
 *         email:
 *           type: string
 *           format: email
 *           description: 電子郵件
 *         avatar:
 *           type: string
 *           description: 頭像URL
 *         bio:
 *           type: string
 *           description: 個人簡介
 *         role:
 *           type: string
 *           enum: [user, manager, admin]
 *           description: 用戶角色
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: 電子郵件
 *         password:
 *           type: string
 *           description: 密碼
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: 用戶名
 *         email:
 *           type: string
 *           format: email
 *           description: 電子郵件
 *         password:
 *           type: string
 *           description: 密碼
 *         bio:
 *           type: string
 *           description: 個人簡介
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: 用戶名
 *         bio:
 *           type: string
 *           description: 個人簡介
 *         avatar:
 *           type: string
 *           format: binary
 *           description: 頭像文件
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: 註冊新用戶
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: 用戶創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: 取得所有用戶 (管理員專用)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每頁數量
 *     responses:
 *       200:
 *         description: 成功取得用戶列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */
router.post('/', createUser)
router.get('/', token, isManager, getUsers)

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: 取得當前用戶資料
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得用戶資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: 未授權
 *   put:
 *     summary: 更新當前用戶資料
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: 用戶資料更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *   delete:
 *     summary: 刪除當前用戶帳號
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 用戶帳號刪除成功
 *       401:
 *         description: 未授權
 */
/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: 取得指定用戶資料
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     responses:
 *       200:
 *         description: 成功取得用戶資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: 用戶不存在
 *   put:
 *     summary: 更新指定用戶資料 (管理員專用)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: 用戶資料更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 用戶不存在
 *   delete:
 *     summary: 刪除指定用戶 (管理員專用)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用戶ID
 *     responses:
 *       200:
 *         description: 用戶刪除成功
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 用戶不存在
 */

// 用戶個人資料相關路由（必須在 /:id 之前）
router.get('/me', token, isUser, getMe)
router.put('/me', token, isUser, singleUpload('avatar'), updateMe)
router.delete('/me', token, isUser, deleteMe)

// 基本 CRUD 操作（必須在最後）
router.get('/:id', getUser)
router.put('/:id', token, isManager, singleUpload('avatar'), updateUser)
router.delete('/:id', token, isManager, deleteUser)

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: 用戶登入
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT Token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 登入失敗
 * /api/users/logout:
 *   post:
 *     summary: 用戶登出
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 登出成功
 *       401:
 *         description: 未授權
 * /api/users/refresh:
 *   post:
 *     summary: 刷新JWT Token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token刷新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: 新的JWT Token
 *       401:
 *         description: Token無效
 */
router.post('/login', login)
router.post('/logout', token, logout)
router.post('/refresh', token, refresh)

// 綁定社群帳號
router.post('/bind/:provider', token, bindSocialAccount)

// 觸發 Google OAuth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
// Google OAuth callback
router.get(
  '/auth/google/callback',
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
  '/auth/facebook/callback',
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
  '/auth/discord/callback',
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

// 觸發 Twitter OAuth
router.get('/auth/twitter', passport.authenticate('twitter-oauth2'))
// Twitter OAuth callback
router.get(
  '/auth/twitter/callback',
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
