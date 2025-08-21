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
  getBindStatus, // 新增獲取綁定狀態
  checkPasswordStatus, // 新增檢查密碼狀態
  banUserById, // 新增封禁
  unbanUserById, // 新增解除封禁
  batchSoftDeleteUsers, // 新增批次軟刪除
  exportUsersCsv, // 新增匯出 CSV
  updateNotificationSettings, // 新增通知設定更新
  getNotificationSettings, // 新增通知設定獲取
  // 功能 Cookie 相關偏好設定
  setTheme,
  setLanguage,
  setPersonalization,
  setSearchPreferences,
  getFunctionalPreferences,
  clearFunctionalPreferences,
  getPrivacyStatus,
} from '../controllers/userController.js'
import { login, logout, refresh } from '../controllers/authController.js'
import { token, isUser, isManager } from '../middleware/auth.js'
import { uploadAvatar } from '../services/uploadService.js'
import passport from 'passport'
import { signToken } from '../utils/jwt.js'
import { logger } from '../utils/logger.js'
import User from '../models/User.js' // 新增 User 模型導入
import jwt from 'jsonwebtoken'

const router = express.Router()

// 取得前端 URL 的輔助函數
const getFrontendUrl = () => {
  let frontendUrl =
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://memedam.com' : 'http://localhost:5173')

  // 在生產環境強制使用 HTTPS 以避免 Cloudflare 522 錯誤
  if (process.env.NODE_ENV === 'production' && frontendUrl.startsWith('http://')) {
    frontendUrl = frontendUrl.replace('http://', 'https://')
    console.warn(`生產環境強制將 HTTP 轉換為 HTTPS: ${frontendUrl}`)
  }

  return frontendUrl
}

// 生成 OAuth state 參數
const generateOAuthState = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// 注意：verifyOAuthState 函數已移除，新的 OAuth 路由使用不同的驗證邏輯

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
 *         username_changed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Username 最後變更時間（一個月只能變更一次）
 *         previous_usernames:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: 之前的 username
 *               changed_at:
 *                 type: string
 *                 format: date-time
 *                 description: 變更時間
 *           description: 最近的 username 變更歷史（最多保留10筆）
 *         needs_username_selection:
 *           type: boolean
 *           description: 是否需要選擇 username（社群登入用戶）
 *           example: false
 *     LoginRequest:
 *       type: object
 *       required:
 *         - login
 *         - password
 *       properties:
 *         login:
 *           type: string
 *           description: 帳號或電子郵件
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           description: 密碼
 *           example: "password123"
 *         recaptchaToken:
 *           type: string
 *           description: reCAPTCHA 驗證 token（如果已設定 reCAPTCHA）
 *           example: "03AFcWeA..."
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

// 匯出 CSV（需放在動態路由前）
router.get('/export', token, isManager, exportUsersCsv)

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
router.put('/me', token, isUser, uploadAvatar, updateMe)
router.delete('/me', token, isUser, deleteMe)

// 通知設定相關路由
router.get('/notification-settings', token, isUser, getNotificationSettings)
router.patch('/notification-settings', token, isUser, updateNotificationSettings)

// 功能 Cookie 相關偏好設定路由
router.post('/preferences/theme', token, isUser, setTheme)
router.post('/preferences/language', token, isUser, setLanguage)
router.post('/preferences/personalization', token, isUser, setPersonalization)
router.post('/preferences/search', token, isUser, setSearchPreferences)
router.get('/preferences', token, isUser, getFunctionalPreferences)
router.delete('/preferences', token, isUser, clearFunctionalPreferences)
router.get('/privacy-status', token, isUser, getPrivacyStatus)

// OAuth 綁定相關路由（必須在 /:id 之前）
router.get('/bind-status', token, getBindStatus)

// 密碼狀態相關路由
router.get('/password-status', token, isUser, checkPasswordStatus)

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: 用戶登入
 *     tags: [Authentication]
 *     description: 本地帳號密碼登入，支援 reCAPTCHA 驗證防護
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT Token
 *                 userId:
 *                   type: string
 *                   description: 用戶 ID
 *                 role:
 *                   type: string
 *                   description: 用戶角色
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 請求參數錯誤或 reCAPTCHA 驗證失敗
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "請完成 reCAPTCHA 驗證"
 *       401:
 *         description: 登入失敗（帳號密碼錯誤）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "帳號、信箱或密碼錯誤"
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
 * /api/users/validate-username/{username}:
 *   get:
 *     summary: 驗證 username 是否可用
 *     tags: [Users]
 *     description: 檢查指定的 username 是否可用，包括格式驗證、重複檢查和保留字檢查
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 8
 *           maxLength: 20
 *         description: 要驗證的 username（8-20字元，只允許英文字母、數字、點號、底線和連字號）
 *     responses:
 *       200:
 *         description: 驗證結果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 操作是否成功
 *                 available:
 *                   type: boolean
 *                   description: username 是否可用
 *                 message:
 *                   type: string
 *                   description: 詳細訊息
 *             examples:
 *               available:
 *                 summary: Username 可用
 *                 value:
 *                   success: true
 *                   available: true
 *                   message: "此 username 可以使用"
 *               unavailable:
 *                 summary: Username 不可用
 *                 value:
 *                   success: true
 *                   available: false
 *                   message: "此 username 已被使用"
 *               format_error:
 *                 summary: 格式錯誤
 *                 value:
 *                   success: false
 *                   available: false
 *                   message: "username 只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)"
 *               length_error:
 *                 summary: 長度錯誤
 *                 value:
 *                   success: false
 *                   available: false
 *                   message: "username 長度必須在 8 到 20 個字元之間"
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 * /api/users/change-username:
 *   post:
 *     summary: 變更 username
 *     tags: [Users]
 *     description: 變更用戶的 username，包含時間限制和完整驗證
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - currentPassword
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 20
 *                 description: 新的 username（8-20字元，只允許英文字母、數字、點號、底線和連字號）
 *                 example: "newusername123"
 *               currentPassword:
 *                 type: string
 *                 description: 目前密碼（用於驗證身份）
 *                 example: "your_current_password"
 *     responses:
 *       200:
 *         description: Username 變更成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: 用戶ID
 *                     username:
 *                       type: string
 *                       description: 新的 username
 *                     username_changed_at:
 *                       type: string
 *                       format: date-time
 *                       description: Username 變更時間
 *             example:
 *               success: true
 *               message: "username 已成功變更"
 *               user:
 *                 _id: "507f1f77bcf86cd799439011"
 *                 username: "newusername123"
 *                 username_changed_at: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: 請求參數錯誤或變更限制
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             examples:
 *               time_limit:
 *                 summary: 時間限制
 *                 value:
 *                   success: false
 *                   message: "username 一個月只能變更一次，還需要等待 25 天才能再次變更"
 *               format_error:
 *                 summary: 格式錯誤
 *                 value:
 *                   success: false
 *                   message: "username 只能包含英文字母、數字、點號(.)、底線(_)和連字號(-)"
 *               length_error:
 *                 summary: 長度錯誤
 *                 value:
 *                   success: false
 *                   message: "username 長度必須在 8 到 20 個字元之間"
 *               same_username:
 *                 summary: 相同 username
 *                 value:
 *                   success: false
 *                   message: "新 username 不能與目前 username 相同"
 *               reserved_username:
 *                 summary: 保留字
 *                 value:
 *                   success: false
 *                   message: "此 username 為系統保留，無法使用"
 *       401:
 *         description: 未授權或密碼錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             example:
 *               success: false
 *               message: "目前密碼不正確"
 *       409:
 *         description: Username 已被使用
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             example:
 *               success: false
 *               message: "此 username 已被其他使用者使用"
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string


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

/**
 * @swagger
 * /api/users/validate-username/{username}:
 *   get:
 *     summary: 驗證 username 可用性
 *     tags: [Authentication]
 *     description: 檢查 username 是否符合格式要求且未被使用
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: 要驗證的 username
 *         example: myusername
 *     responses:
 *       200:
 *         description: 驗證結果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 available:
 *                   type: boolean
 *                   description: username 是否可用
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: 驗證結果訊息
 *                   example: 此 username 可以使用
 *       400:
 *         description: Username 格式不符合要求
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 available:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: username 格式或長度不符合（5-30，小寫英數、_、.）
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 伺服器錯誤
 */
// ===== Username 驗證與變更 =====
// 驗證 username 是否可用（格式/長度/保留字/重複）
router.get('/validate-username/:username', async (req, res) => {
  try {
    const { username } = req.params
    const isValidFormat = /^[a-z0-9._]{5,30}$/.test(username)
    if (!isValidFormat) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'username 格式或長度不符合（5-30，小寫英數、_、.）',
      })
    }

    const reserved = new Set(['admin', 'root', 'system', 'support'])
    if (reserved.has(username)) {
      return res
        .status(200)
        .json({ success: true, available: false, message: '此 username 為保留字' })
    }

    const exists = await User.exists({ username })
    return res.status(200).json({
      success: true,
      available: !exists,
      message: exists ? '此 username 已被使用' : '此 username 可以使用',
    })
  } catch {
    return res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
})

/**
 * @swagger
 * /api/users/change-username:
 *   post:
 *     summary: 變更 username
 *     tags: [Authentication]
 *     description: 變更用戶的 username（需要提供當前密碼驗證）
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - currentPassword
 *             properties:
 *               username:
 *                 type: string
 *                 description: 新的 username
 *                 example: newusername
 *               currentPassword:
 *                 type: string
 *                 description: 當前密碼（用於驗證）
 *                 example: mypassword123
 *     responses:
 *       200:
 *         description: Username 變更成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: username 已成功變更
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: 用戶 ID
 *                     username:
 *                       type: string
 *                       description: 新的 username
 *                     username_changed_at:
 *                       type: string
 *                       format: date-time
 *                       description: Username 變更時間
 *       400:
 *         description: 參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 缺少必要參數
 *       401:
 *         description: 未授權或密碼錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 目前密碼不正確
 *       409:
 *         description: Username 已被使用
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 此 username 已被其他使用者使用
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 伺服器錯誤
 */
// 變更 username（需認證）
router.post('/change-username', token, isUser, async (req, res) => {
  try {
    const userId = req.user._id
    const { username: newUsername, currentPassword } = req.body || {}

    if (!newUsername || !currentPassword) {
      return res.status(400).json({ success: false, message: '缺少必要參數' })
    }
    if (!/^[a-z0-9._]{5,30}$/.test(newUsername)) {
      return res
        .status(400)
        .json({ success: false, message: 'username 格式或長度不符合（5-30，小寫英數、_、.）' })
    }
    const reserved = new Set(['admin', 'root', 'system', 'support'])
    if (reserved.has(newUsername)) {
      return res.status(400).json({ success: false, message: '此 username 為保留字，無法使用' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(401).json({ success: false, message: '未授權' })
    }
    if (user.username === newUsername) {
      return res
        .status(400)
        .json({ success: false, message: '新 username 不能與目前 username 相同' })
    }
    const ok = await user.comparePassword(currentPassword)
    if (!ok) {
      return res.status(401).json({ success: false, message: '目前密碼不正確' })
    }
    const dup = await User.exists({ username: newUsername })
    if (dup) {
      return res.status(409).json({ success: false, message: '此 username 已被其他使用者使用' })
    }

    user.previous_usernames = user.previous_usernames || []
    user.previous_usernames.unshift({ username: user.username, changed_at: new Date() })
    user.previous_usernames = user.previous_usernames.slice(0, 10)
    user.username = newUsername
    user.username_changed_at = new Date()
    await user.save()

    return res.status(200).json({
      success: true,
      message: 'username 已成功變更',
      user: {
        _id: user._id,
        username: user.username,
        username_changed_at: user.username_changed_at,
      },
    })
  } catch {
    return res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
})

// 注意：舊的特定 OAuth 路由已移除，請使用通用的 /auth/:provider 路由

// 觸發 Facebook OAuth
// 注意：舊的特定 OAuth 路由已移除，請使用通用的 /auth/:provider 路由

// 注意：舊的特定 OAuth 路由已移除，請使用通用的 /auth/:provider 路由

// ========== OAuth 綁定專用端點 ==========

// 初始化 OAuth 綁定流程
router.get('/bind-auth/:provider', token, initBindAuth)

// OAuth 授權初始化（重定向到社群平台）
router.get('/bind-auth/:provider/init', async (req, res) => {
  const { provider } = req.params
  const { state, token } = req.query

  // 驗證必要參數
  if (!state) {
    return res.status(400).json({
      success: false,
      message: '缺少 state 參數',
    })
  }

  let bindUserId = null

  // 優先使用 query token 通過資料庫查找，避免密鑰不一致或簽章問題
  if (token) {
    const user = await User.findOne({ tokens: token })
    if (!user) {
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=auth_failed&message=${encodeURIComponent('認證失敗，請重新登錄')}`,
      )
    }
    bindUserId = user._id.toString()
  } else if (req.session && req.session.bindUserId) {
    bindUserId = req.session.bindUserId
  } else {
    const frontendUrl = getFrontendUrl()
    return res.redirect(
      `${frontendUrl}/settings?error=auth_required&message=${encodeURIComponent('用戶認證失效，請重新登錄後綁定')}`,
    )
  }

  // 驗證 provider
  const validProviders = ['google', 'facebook', 'discord', 'twitter']
  if (!validProviders.includes(provider)) {
    return res.status(400).json({
      success: false,
      message: '不支援的社群平台',
    })
  }

  // 使用臨時存儲來保存綁定狀態
  if (bindUserId) {
    const { storeBindState } = await import('../utils/oauthTempStore.js')
    const stored = storeBindState(state, bindUserId, provider)

    if (!stored) {
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=storage_error&message=${encodeURIComponent('系統錯誤，請稍後再試')}`,
      )
    }

    // 僅對 Twitter 流程寫入 session（OAuth 1.0a 依賴 session）
    if (provider === 'twitter' && req.session) {
      req.session.bindUserId = bindUserId
      req.session.bindProvider = provider
      req.session.oauthState = state
      try {
        await new Promise((resolve, reject) => {
          req.session.save((err) => (err ? reject(err) : resolve()))
        })
      } catch {
        // 寫入/保存 session 失敗，但將繼續使用臨時存儲流程
      }
    }
  } else {
    const frontendUrl = getFrontendUrl()
    return res.redirect(
      `${frontendUrl}/settings?error=auth_required&message=${encodeURIComponent('用戶認證失效，請重新登錄後綁定')}`,
    )
  }

  // 為 Twitter OAuth 1.0a 特殊處理
  if (provider === 'twitter') {
    // 確保 Twitter OAuth session 存在
    if (!req.session['oauth:twitter:bind']) {
      req.session['oauth:twitter:bind'] = {}
    }

    // 設置綁定標記
    req.session.isBindingFlow = true
    req.session.bindProvider = provider

    // 在 Twitter OAuth session 中保存用戶 ID
    req.session['oauth:twitter:bind'].bindUserId = req.session.bindUserId
    req.session['oauth:twitter:bind'].bindProvider = provider

    // 強制保存會話
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  // 兼容性檢查：若 session 存在但資料不完整，只記錄警告，不中斷流程
  if (req.session && req.session.bindProvider && req.session.bindProvider !== provider) {
    // 記錄警告但不中斷流程
  }

  // 不再依賴 session state 嚴格驗證，主要以臨時存儲 state 為準（session 僅作最佳努力）
  if (req.session && req.session.oauthState !== state) {
    req.session.oauthState = state
  }

  // 檢查環境變數
  const envVars = {
    google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
    facebook: { id: 'FACEBOOK_CLIENT_ID', secret: 'FACEBOOK_CLIENT_SECRET' },
    discord: { id: 'DISCORD_CLIENT_ID', secret: 'DISCORD_CLIENT_SECRET' },
    twitter: { id: 'TWITTER_API_KEY', secret: 'TWITTER_API_SECRET' },
  }

  const { id: clientIdEnv, secret: clientSecretEnv } = envVars[provider]
  if (!process.env[clientIdEnv] || !process.env[clientSecretEnv]) {
    logger.error(`❌ ${provider} OAuth 環境變數未設定: ${clientIdEnv}, ${clientSecretEnv}`)
    const frontendUrl = getFrontendUrl()
    return res.redirect(
      `${frontendUrl}/settings?error=config_error&message=${encodeURIComponent('OAuth 配置錯誤，請聯繫管理員')}`,
    )
  }

  try {
    // 在會話中設置用戶 ID，供 OAuth 回調使用
    req.session.userId = req.session.bindUserId

    // 為 Twitter OAuth 1.0a 特殊處理
    if (provider === 'twitter') {
      // 確保 Twitter OAuth session 存在
      if (!req.session['oauth:twitter:bind']) {
        req.session['oauth:twitter:bind'] = {}
      }

      // 在 Twitter OAuth session 中保存用戶 ID
      req.session['oauth:twitter:bind'].bindUserId = req.session.bindUserId
      req.session['oauth:twitter:bind'].bindProvider = provider
    }

    // 強制保存會話狀態，確保在 OAuth 重定向前保存
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // 根據不同的 provider 設定不同的 scope
    let scope = []
    switch (provider) {
      case 'google':
        scope = ['openid', 'email', 'profile'] // 最小化 scopes，符合 Google OAuth 2.0 政策
        break
      case 'facebook':
        scope = ['email']
        break
      case 'discord':
        scope = ['identify', 'email']
        break
      case 'twitter': {
        // Twitter OAuth 1.0a 不需要額外的 scope
        scope = []
        break
      }
    }

    // 重定向到對應的 OAuth 策略
    const strategyName = `${provider}-bind`
    const authOptions = { scope }
    // Twitter OAuth 1.0a 不支援 state，將 state 夾帶在 callbackURL 上
    if (provider === 'twitter') {
      const baseCallback = process.env.TWITTER_BIND_REDIRECT_URI || process.env.TWITTER_REDIRECT_URI
      if (baseCallback) {
        authOptions.callbackURL = baseCallback.includes('?')
          ? `${baseCallback}&s=${state}`
          : `${baseCallback}?s=${state}`
      }
    } else {
      authOptions.state = state
    }

    passport.authenticate(strategyName, authOptions)(req, res, (error) => {
      if (error) {
        logger.error(`❌ ${provider} OAuth 認證錯誤:`, error)
        const frontendUrl = getFrontendUrl()
        return res.redirect(
          `${frontendUrl}/settings?error=oauth_error&message=${encodeURIComponent('OAuth 認證失敗')}`,
        )
      }
      // 如果沒有錯誤，passport.authenticate 會自動處理重定向
    })
  } catch (error) {
    logger.error(`❌ ${provider} OAuth 初始化錯誤:`, error)
    const frontendUrl = getFrontendUrl()
    return res.redirect(
      `${frontendUrl}/settings?error=init_failed&message=${encodeURIComponent('OAuth 初始化失敗')}`,
    )
  }
})

// Google OAuth 綁定
router.get(
  '/bind-auth/google/callback',
  passport.authenticate('google-bind', {
    scope: ['openid', 'email', 'profile'],
    state: (req) => req.query.state,
  }),
  async (req, res) => {
    try {
      // google-bind 策略已完成綁定與臨時狀態清理，這裡僅回前端成功訊息
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?success=bind_success&provider=google&message=${encodeURIComponent('Google 帳號綁定成功')}`,
      )
    } catch (error) {
      console.error('Google OAuth 綁定回調錯誤:', error)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&message=${encodeURIComponent('綁定失敗，請稍後再試')}`,
      )
    }
  },
)

// Facebook OAuth 綁定
router.get(
  '/bind-auth/facebook/callback',
  passport.authenticate('facebook-bind', {
    state: (req) => req.query.state,
    failureRedirect: `${getFrontendUrl()}/settings?error=bind_failed&provider=facebook`,
  }),
  async (req, res) => {
    try {
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?success=bind_success&provider=facebook&message=${encodeURIComponent('Facebook 帳號綁定成功')}`,
      )
    } catch (error) {
      console.error('Facebook OAuth 綁定回調錯誤:', error)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&provider=facebook&message=${encodeURIComponent('綁定失敗，請稍後再試')}`,
      )
    }
  },
)

// Discord OAuth 綁定
router.get(
  '/bind-auth/discord/callback',
  passport.authenticate('discord-bind', {
    state: (req) => req.query.state,
    failureRedirect: `${getFrontendUrl()}/settings?error=bind_failed&provider=discord`,
  }),
  async (req, res) => {
    try {
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?success=bind_success&provider=discord&message=${encodeURIComponent('Discord 帳號綁定成功')}`,
      )
    } catch (error) {
      console.error('Discord OAuth 綁定回調錯誤:', error)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&provider=discord&message=${encodeURIComponent('綁定失敗，請稍後再試')}`,
      )
    }
  },
)

// Twitter OAuth 綁定
router.get(
  '/bind-auth/twitter/callback',
  passport.authenticate('twitter-bind', {
    failureRedirect: `${getFrontendUrl()}/settings?error=auth_failed&provider=twitter`,
  }),
  async (req, res) => {
    try {
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?success=bind_success&provider=twitter&message=${encodeURIComponent('Twitter 帳號綁定成功')}`,
      )
    } catch (error) {
      logger.error('❌ Twitter OAuth 綁定回調錯誤:', error)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/settings?error=bind_failed&provider=twitter&message=${encodeURIComponent('綁定失敗，請稍後再試')}`,
      )
    }
  },
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
router.put('/:id', token, isManager, uploadAvatar, updateUser)
router.delete('/:id', token, isManager, deleteUser)

// 管理端：封禁/解封/批次軟刪除（放在最後通用路由下方，避免與 /:id 衝突）
router.put('/:id/ban', token, isManager, banUserById)
router.put('/:id/unban', token, isManager, unbanUserById)
router.delete('/batch-delete', token, isManager, batchSoftDeleteUsers)

// 檢查使用者是否已設定密碼狀態
router.get('/password-status', token, checkPasswordStatus)

/**
 * @swagger
 * /api/users/auth/{provider}:
 *   get:
 *     summary: 社群登入 (OAuth)
 *     tags: [Authentication]
 *     description: 開始社群平台 OAuth 登入流程
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, facebook, discord, twitter]
 *         description: 社群平台名稱
 *     responses:
 *       302:
 *         description: 重定向到社群平台的授權頁面
 *       400:
 *         description: 不支援的社群平台
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 不支援的社群平台
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Session 保存失敗
 */
// OAuth 社群登入路由
router.get('/auth/:provider', (req, res, next) => {
  const { provider } = req.params
  const validProviders = ['google', 'facebook', 'discord', 'twitter']

  if (!validProviders.includes(provider)) {
    return res.status(400).json({ success: false, message: '不支援的社群平台' })
  }

  // 生成 OAuth state
  const state = generateOAuthState()

  // 使用 Passport 進行 OAuth 認證
  const authOptions = { state }

  // 為不同平台設定適當的授權範圍
  if (provider === 'google') {
    authOptions.scope = ['openid', 'email', 'profile']
    authOptions.accessType = 'offline'
    authOptions.prompt = 'consent'
  } else if (provider === 'facebook') {
    authOptions.scope = ['email']
  } else if (provider === 'discord') {
    authOptions.scope = ['identify', 'email']
  }

  passport.authenticate(provider, authOptions)(req, res, next)
})

/**
 * @swagger
 * /api/users/auth/{provider}/callback:
 *   get:
 *     summary: OAuth 回調處理
 *     tags: [Authentication]
 *     description: 處理社群平台 OAuth 授權回調，完成登入或重定向到 username 選擇頁面
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, facebook, discord, twitter]
 *         description: 社群平台名稱
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: OAuth 授權碼
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: OAuth state 參數
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: OAuth 錯誤訊息
 *     responses:
 *       302:
 *         description: 重定向到前端頁面
 *         headers:
 *           Location:
 *             description: 重定向 URL
 *             schema:
 *               type: string
 *               example: https://memedam.com/oauth-callback?token=xxx&user=xxx
 *       400:
 *         description: 不支援的社群平台
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 不支援的社群平台
 */
// OAuth 回調處理
router.get('/auth/:provider/callback', (req, res, next) => {
  const { provider } = req.params
  const validProviders = ['google', 'facebook', 'discord', 'twitter']

  if (!validProviders.includes(provider)) {
    return res.status(400).json({ success: false, message: '不支援的社群平台' })
  }

  passport.authenticate(provider, { session: false }, async (err, user, info) => {
    try {
      if (err) {
        logger.error(`${provider} OAuth 回調錯誤:`, err)
        const frontendUrl = getFrontendUrl()
        return res.redirect(
          `${frontendUrl}/oauth-callback?error=${encodeURIComponent(err.message)}`,
        )
      }

      if (!user) {
        logger.error(`${provider} OAuth 認證失敗:`, info)
        const frontendUrl = getFrontendUrl()
        return res.redirect(
          `${frontendUrl}/oauth-callback?error=${encodeURIComponent(info?.message || '認證失敗')}`,
        )
      }

      // 檢查是否需要選擇 username
      const needsUsername = await checkIfNeedsUsername(user)

      if (needsUsername) {
        // 需要選擇 username，生成臨時 token 並重定向到前端選擇頁面
        const token = signToken({ _id: user._id })

        // 更新用戶的 tokens
        user.tokens = user.tokens || []
        if (user.tokens.length >= 3) {
          user.tokens.shift()
        }
        user.tokens.push(token)
        user.last_login_at = new Date()
        await user.save()

        const frontendUrl = getFrontendUrl()
        const userData = encodeURIComponent(JSON.stringify(user))

        // 從 Passport 策略中獲取 profile 資料
        let profileData = {}
        if (req.user && req.user.profile) {
          profileData = req.user.profile
        } else if (req.session && req.session.oauthProfile) {
          profileData = req.session.oauthProfile
        }

        const profile = encodeURIComponent(JSON.stringify(profileData))

        return res.redirect(
          `${frontendUrl}/oauth-callback?needsUsername=true&provider=${provider}&user=${userData}&profile=${profile}&token=${token}`,
        )
      } else {
        // 用戶已存在或不需要選擇 username，直接登入
        const token = signToken({ _id: user._id })

        // 更新用戶的 tokens
        user.tokens = user.tokens || []
        if (user.tokens.length >= 3) {
          user.tokens.shift()
        }
        user.tokens.push(token)
        user.last_login_at = new Date()

        // 如果用戶之前需要選擇 username，現在已經完成，清除標記
        if (user.needs_username_selection) {
          user.needs_username_selection = false
        }

        await user.save()

        const frontendUrl = getFrontendUrl()
        const userData = encodeURIComponent(JSON.stringify(user))

        return res.redirect(`${frontendUrl}/oauth-callback?token=${token}&user=${userData}`)
      }
    } catch (error) {
      logger.error(`${provider} OAuth 回調處理錯誤:`, error)
      const frontendUrl = getFrontendUrl()
      return res.redirect(
        `${frontendUrl}/oauth-callback?error=${encodeURIComponent('處理授權時發生錯誤')}`,
      )
    }
  })(req, res, next)
})

// 檢查是否需要選擇 username 的輔助函數
const checkIfNeedsUsername = async (user) => {
  // 檢查用戶是否需要選擇 username（優先級最高）
  if (user.needs_username_selection) {
    return true
  }

  // 如果用戶已經完成了 username 選擇（needs_username_selection = false），
  // 則不再檢查其他條件，直接返回 false
  return false
}

/**
 * @swagger
 * /api/users/complete-social-registration:
 *   post:
 *     summary: 完成社群註冊
 *     tags: [Authentication]
 *     description: 完成社群登入用戶的 username 選擇，完成註冊流程
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - username
 *             properties:
 *               token:
 *                 type: string
 *                 description: JWT token
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               username:
 *                 type: string
 *                 description: 選擇的 username
 *                 example: myusername
 *               provider:
 *                 type: string
 *                 enum: [google, facebook, discord, twitter]
 *                 description: 社群平台名稱
 *                 example: google
 *               profile:
 *                 type: object
 *                 description: 社群平台用戶資料
 *     responses:
 *       200:
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: 新的 JWT token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 userId:
 *                   type: string
 *                   description: 用戶 ID
 *                   example: 507f1f77bcf86cd799439011
 *                 role:
 *                   type: string
 *                   description: 用戶角色
 *                   example: user
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 缺少必要參數
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 缺少必要參數
 *       404:
 *         description: 用戶不存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 用戶不存在
 *       409:
 *         description: Username 已被使用
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 此使用者名稱已被使用
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 完成註冊時發生錯誤
 */
// 完成社群註冊（選擇 username 後）
router.post('/complete-social-registration', async (req, res) => {
  try {
    const { token, username } = req.body

    if (!token || !username) {
      return res.status(400).json({ success: false, message: '缺少必要參數' })
    }

    // 驗證 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded._id)

    if (!user) {
      return res.status(404).json({ success: false, message: '用戶不存在' })
    }

    // 檢查 username 是否可用
    const existingUser = await User.findOne({ username })
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(409).json({ success: false, message: '此使用者名稱已被使用' })
    }

    // 更新用戶的 username 和清除需要選擇 username 的標記
    user.username = username
    user.needs_username_selection = false
    await user.save()

    // 生成新的 token
    const newToken = signToken({ _id: user._id })

    // 更新用戶的 tokens
    user.tokens = user.tokens || []
    if (user.tokens.length >= 3) {
      user.tokens.shift()
    }
    user.tokens.push(newToken)
    user.last_login_at = new Date()
    await user.save()

    res.json({
      success: true,
      token: newToken,
      userId: user._id,
      role: user.role,
      user: user.toJSON(),
    })
  } catch (error) {
    logger.error('完成社群註冊錯誤:', error)
    res.status(500).json({ success: false, message: '完成註冊時發生錯誤' })
  }
})

/**
 * @swagger
 * /api/users/username-suggestions/{provider}:
 *   get:
 *     summary: 獲取 username 建議
 *     tags: [Authentication]
 *     description: 根據社群平台用戶資料生成 username 建議列表
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, facebook, discord, twitter]
 *         description: 社群平台名稱
 *       - in: query
 *         name: profile
 *         required: true
 *         schema:
 *           type: string
 *         description: 編碼後的社群平台用戶資料 JSON
 *         example: %7B%22id%22%3A%22123456789%22%2C%22displayName%22%3A%22John%20Doe%22%7D
 *     responses:
 *       200:
 *         description: 成功獲取 username 建議
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Username 建議列表
 *                       example: ["johndoe", "john_doe", "johndoe123", "john_doe_2024", "johndoe_user"]
 *       400:
 *         description: 缺少 profile 參數
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 缺少 profile 參數
 *       500:
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 獲取建議時發生錯誤
 */
// 獲取 username 建議
router.get('/username-suggestions/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const { profile } = req.query

    if (!profile) {
      return res.status(400).json({ success: false, message: '缺少 profile 參數' })
    }

    let profileData = {}
    try {
      profileData = JSON.parse(decodeURIComponent(profile))
    } catch (parseError) {
      logger.warn('Profile 參數解析失敗，使用空物件:', parseError)
      profileData = {}
    }

    // 如果 profile 為空，生成基於 provider 的通用建議
    if (!profileData || Object.keys(profileData).length === 0) {
      const suggestions = [
        `user_${Date.now()}`,
        `user_${Math.random().toString(36).substring(2, 8)}`,
        `${provider}_user_${Date.now()}`,
        `newuser_${Math.random().toString(36).substring(2, 6)}`,
        `user_${Math.floor(Math.random() * 10000)}`,
      ]

      return res.json({
        success: true,
        data: { suggestions },
      })
    }

    const { generateUsernameSuggestions } = await import('../utils/usernameGenerator.js')
    const suggestions = await generateUsernameSuggestions(profileData, provider, 5)

    res.json({
      success: true,
      data: { suggestions },
    })
  } catch (error) {
    logger.error('獲取 username 建議錯誤:', error)
    res.status(500).json({ success: false, message: '獲取建議時發生錯誤' })
  }
})

export default router
