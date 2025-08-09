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
  getActiveUsers, // 新增 getActiveUsers
  changePassword, // 新增密碼變更
  changeEmail, // 新增電子信箱變更
  unbindSocialAccount, // 新增社群帳號解除綁定
  searchUsers, // 新增用戶搜索
  sendDeletionReminders, // 新增刪除提醒任務
  deleteUnverifiedUsers, // 新增刪除未驗證用戶任務
  getUnverifiedUsersStats, // 新增未驗證用戶統計
  forgotPassword, // 新增忘記密碼
  resetPassword, // 新增重設密碼
  initBindAuth, // 新增 OAuth 綁定初始化
  handleBindAuthCallback, // 新增 OAuth 綁定回調處理
  getBindStatus, // 新增獲取綁定狀態
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
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: 錯誤訊息
 *         status:
 *           type: integer
 *           description: HTTP 狀態碼
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 錯誤發生時間
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
 * /api/users/active:
 *   get:
 *     summary: 取得活躍用戶排行榜
 *     tags: [Users]
 *     description: 根據用戶創作的迷因數量排序，取得前幾名的活躍用戶
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *         description: 要取得的活躍用戶數量 (1-50)
 *     responses:
 *       200:
 *         description: 成功取得活躍用戶列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activeUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: 用戶ID
 *                       username:
 *                         type: string
 *                         description: 用戶名
 *                       display_name:
 *                         type: string
 *                         description: 顯示名稱
 *                       avatar:
 *                         type: string
 *                         description: 頭像URL
 *                       bio:
 *                         type: string
 *                         description: 個人簡介
 *                       meme_count:
 *                         type: integer
 *                         description: 創作的迷因數量
 *                       total_likes_received:
 *                         type: integer
 *                         description: 獲得的總讚數
 *                       follower_count:
 *                         type: integer
 *                         description: 追隨者數量
 *                 count:
 *                   type: integer
 *                   description: 實際返回的用戶數量
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/active', getActiveUsers)

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: 搜索用戶
 *     tags: [Users]
 *     description: 根據用戶名和顯示名稱搜索用戶
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 搜索關鍵字
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *         description: 返回結果數量限制 (1-50)
 *     responses:
 *       200:
 *         description: 成功獲取搜索結果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: 用戶ID
 *                       username:
 *                         type: string
 *                         description: 用戶名
 *                       display_name:
 *                         type: string
 *                         description: 顯示名稱
 *                       avatar:
 *                         type: string
 *                         description: 頭像URL
 *                       bio:
 *                         type: string
 *                         description: 個人簡介
 *                       follower_count:
 *                         type: integer
 *                         description: 追蹤者數量
 *                       meme_count:
 *                         type: integer
 *                         description: 迷因數量
 *                 count:
 *                   type: integer
 *                   description: 返回的用戶數量
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search', searchUsers)

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

// OAuth 綁定相關路由（必須在 /:id 之前）
router.get('/bind-status', token, getBindStatus)

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
 * /api/users/bind/{provider}:
 *   post:
 *     summary: 綁定社群帳號
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, facebook, discord, twitter]
 *         description: 社群平台提供商
 *     responses:
 *       200:
 *         description: 社群帳號綁定成功
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
 *       401:
 *         description: 未授權
 *       409:
 *         description: 帳號已綁定
 * /api/users/unbind/{provider}:
 *   delete:
 *     summary: 解除綁定社群帳號
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, facebook, discord, twitter]
 *         description: 社群平台提供商
 *     responses:
 *       200:
 *         description: 社群帳號解除綁定成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤或尚未綁定該社群帳號
 *       401:
 *         description: 未授權
 *       409:
 *         description: 無法解除綁定主要登入方式
 * /api/users/forgot-password:
 *   post:
 *     summary: 忘記密碼
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用戶的 email 地址
 *     responses:
 *       200:
 *         description: 密碼重設 email 發送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *       400:
 *         description: 請求參數錯誤
 *       404:
 *         description: 找不到用戶
 *       429:
 *         description: 請求頻率過高
 *       500:
 *         description: 伺服器錯誤
 * /api/users/reset-password:
 *   post:
 *     summary: 重設密碼
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: 密碼重設 token
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 description: 新密碼
 *     responses:
 *       200:
 *         description: 密碼重設成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤或無效的 token
 *       404:
 *         description: 找不到用戶
 *       500:
 *         description: 伺服器錯誤
 * /api/users/change-password:
 *   post:
 *     summary: 變更密碼
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: 目前密碼
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 description: 新密碼
 *     responses:
 *       200:
 *         description: 密碼變更成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤或新密碼與目前密碼相同
 *       401:
 *         description: 目前密碼不正確
 * /api/users/change-email:
 *   post:
 *     summary: 變更電子信箱
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *               - currentPassword
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *                 description: 新電子信箱
 *               currentPassword:
 *                 type: string
 *                 description: 目前密碼
 *     responses:
 *       200:
 *         description: 電子信箱變更成功，驗證信已發送
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   description: 成功訊息，包含驗證信發送提示
 *                 emailSent:
 *                   type: boolean
 *                   description: 驗證信是否成功發送
 *       400:
 *         description: 請求參數錯誤或新電子信箱與目前相同
 *       401:
 *         description: 目前密碼不正確
 *       409:
 *         description: 此電子信箱已被其他使用者註冊
 * /api/users/auth/google:
 *   get:
 *     summary: Google OAuth 登入
 *     tags: [OAuth]
 *     description: 重定向到 Google 授權頁面
 *     responses:
 *       302:
 *         description: 重定向到 Google 授權頁面
 * /api/users/auth/google/callback:
 *   get:
 *     summary: Google OAuth 回調
 *     tags: [OAuth]
 *     description: 處理 Google OAuth 授權回調
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Google 授權碼
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 狀態參數
 *     responses:
 *       302:
 *         description: 重定向到前端並帶上 token
 *       401:
 *         description: OAuth 認證失敗
 * /api/users/auth/facebook:
 *   get:
 *     summary: Facebook OAuth 登入
 *     tags: [OAuth]
 *     description: 重定向到 Facebook 授權頁面
 *     responses:
 *       302:
 *         description: 重定向到 Facebook 授權頁面
 * /api/users/auth/facebook/callback:
 *   get:
 *     summary: Facebook OAuth 回調
 *     tags: [OAuth]
 *     description: 處理 Facebook OAuth 授權回調
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Facebook 授權碼
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 狀態參數
 *     responses:
 *       302:
 *         description: 重定向到前端並帶上 token
 *       401:
 *         description: OAuth 認證失敗
 * /api/users/auth/discord:
 *   get:
 *     summary: Discord OAuth 登入
 *     tags: [OAuth]
 *     description: 重定向到 Discord 授權頁面
 *     responses:
 *       302:
 *         description: 重定向到 Discord 授權頁面
 * /api/users/auth/discord/callback:
 *   get:
 *     summary: Discord OAuth 回調
 *     tags: [OAuth]
 *     description: 處理 Discord OAuth 授權回調
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Discord 授權碼
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 狀態參數
 *     responses:
 *       302:
 *         description: 重定向到前端並帶上 token
 *       401:
 *         description: OAuth 認證失敗
 * /api/users/auth/twitter:
 *   get:
 *     summary: Twitter OAuth 登入
 *     tags: [OAuth]
 *     description: 重定向到 Twitter 授權頁面
 *     responses:
 *       302:
 *         description: 重定向到 Twitter 授權頁面
 * /api/users/auth/twitter/callback:
 *   get:
 *     summary: Twitter OAuth 回調
 *     tags: [OAuth]
 *     description: 處理 Twitter OAuth 授權回調
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Twitter 授權碼
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 狀態參數
 *     responses:
 *       302:
 *         description: 重定向到前端並帶上 token
 *       401:
 *         description: OAuth 認證失敗
 */
router.post('/login', login)
router.post('/logout', token, logout)
router.post('/refresh', token, refresh)

// 綁定社群帳號
router.post('/bind/:provider', token, bindSocialAccount)

// 解除綁定社群帳號
router.delete('/unbind/:provider', token, unbindSocialAccount)

// 忘記密碼
router.post('/forgot-password', forgotPassword)

// 重設密碼
router.post('/reset-password', resetPassword)

// 密碼變更
router.post('/change-password', token, changePassword)

// 電子信箱變更
router.post('/change-email', token, changeEmail)

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

// ========== OAuth 綁定專用端點 ==========

// 初始化 OAuth 綁定流程
router.get('/bind-auth/:provider', token, initBindAuth)

// OAuth 授權初始化（重定向到社群平台）
router.get('/bind-auth/:provider/init', (req, res) => {
  const { provider } = req.params
  const { state } = req.query

  // 驗證必要參數
  if (!state) {
    return res.status(400).json({
      success: false,
      message: '缺少 state 參數'
    })
  }

  // 驗證 provider
  const validProviders = ['google', 'facebook', 'discord', 'twitter']
  if (!validProviders.includes(provider)) {
    return res.status(400).json({
      success: false,
      message: '不支援的社群平台'
    })
  }

  // 檢查環境變數
  const envVars = {
    google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
    facebook: { id: 'FACEBOOK_CLIENT_ID', secret: 'FACEBOOK_CLIENT_SECRET' },
    discord: { id: 'DISCORD_CLIENT_ID', secret: 'DISCORD_CLIENT_SECRET' },
    twitter: { id: 'TWITTER_CLIENT_ID', secret: 'TWITTER_CLIENT_SECRET' }
  }

  const { id: clientIdEnv, secret: clientSecretEnv } = envVars[provider]
  if (!process.env[clientIdEnv] || !process.env[clientSecretEnv]) {
    console.error(`${provider} OAuth 環境變數未設定: ${clientIdEnv}, ${clientSecretEnv}`)
    return res.status(500).json({
      success: false,
      message: `${provider} OAuth 配置錯誤`
    })
  }

  try {
    // 根據不同的 provider 設定不同的 scope
    let scope = []
    switch (provider) {
      case 'google':
        scope = ['profile', 'email']
        break
      case 'facebook':
        scope = ['email']
        break
      case 'discord':
        scope = ['identify', 'email']
        break
      case 'twitter':
        scope = ['tweet.read', 'users.read']
        break
    }

    // 重定向到對應的 OAuth 策略
    const strategyName = `${provider}-bind`
    passport.authenticate(strategyName, {
      scope,
      state,
    })(req, res, (error) => {
      if (error) {
        console.error(`${provider} OAuth 認證錯誤:`, error)
        return res.status(500).json({
          success: false,
          message: 'OAuth 認證失敗',
          error: error.message
        })
      }
    })
  } catch (error) {
    console.error(`${provider} OAuth 初始化錯誤:`, error)
    return res.status(500).json({
      success: false,
      message: 'OAuth 初始化失敗',
      error: error.message
    })
  }
})

// Google OAuth 綁定
router.get(
  '/bind-auth/google/callback',
  passport.authenticate('google-bind', {
    scope: ['profile', 'email'],
    state: (req) => req.query.state,
  }),
  handleBindAuthCallback,
)

// Facebook OAuth 綁定
router.get(
  '/bind-auth/facebook/callback',
  passport.authenticate('facebook-bind', {
    scope: ['email'],
    state: (req) => req.query.state,
  }),
  handleBindAuthCallback,
)

// Discord OAuth 綁定
router.get(
  '/bind-auth/discord/callback',
  passport.authenticate('discord-bind', {
    state: (req) => req.query.state,
  }),
  handleBindAuthCallback,
)

// Twitter OAuth 綁定
router.get(
  '/bind-auth/twitter/callback',
  passport.authenticate('twitter-oauth2-bind', {
    state: (req) => req.query.state,
  }),
  handleBindAuthCallback,
)

// 管理員專用路由 - 用戶清理相關
/**
 * @swagger
 * /api/users/admin/send-deletion-reminders:
 *   post:
 *     summary: 手動執行刪除提醒任務 (管理員專用)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: 發送提醒 email 給註冊超過11個月但未驗證的用戶
 *     responses:
 *       200:
 *         description: 刪除提醒任務執行成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 * /api/users/admin/delete-unverified-users:
 *   post:
 *     summary: 手動執行刪除未驗證用戶任務 (管理員專用)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: 刪除註冊超過一年但未驗證的用戶
 *     responses:
 *       200:
 *         description: 刪除未驗證用戶任務執行成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 * /api/users/admin/unverified-stats:
 *   get:
 *     summary: 獲取未驗證用戶統計資訊 (管理員專用)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     description: 獲取未驗證用戶的統計資訊，包括需要提醒和刪除的用戶數量
 *     responses:
 *       200:
 *         description: 成功獲取統計資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUnverified:
 *                       type: integer
 *                       description: 總未驗證用戶數量
 *                     usersNeedingReminder:
 *                       type: integer
 *                       description: 需要發送提醒的用戶數量
 *                     usersToDelete:
 *                       type: integer
 *                       description: 需要刪除的用戶數量
 *                     nextReminderDate:
 *                       type: string
 *                       format: date-time
 *                       description: 下次提醒執行時間
 *                     nextDeletionDate:
 *                       type: string
 *                       format: date-time
 *                       description: 下次刪除執行時間
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */
router.post('/admin/send-deletion-reminders', token, sendDeletionReminders)
router.post('/admin/delete-unverified-users', token, deleteUnverifiedUsers)
router.get('/admin/unverified-stats', token, getUnverifiedUsersStats)

// 基本 CRUD 操作（必須在最後）
router.get('/:id', getUser)
router.put('/:id', token, isManager, singleUpload('avatar'), updateUser)
router.delete('/:id', token, isManager, deleteUser)

export default router
