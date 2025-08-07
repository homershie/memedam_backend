import express from 'express'
import {
  createNotification,
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
  getUnreadCount,
} from '../controllers/notificationController.js'
import { token, isUser, isManager } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - user_id
 *         - title
 *         - type
 *         - content
 *       properties:
 *         _id:
 *           type: string
 *           description: 通知唯一ID
 *         user_id:
 *           type: string
 *           description: 接收者ID
 *         title:
 *           type: string
 *           description: 通知標題
 *         sender_id:
 *           type: string
 *           description: 發送者ID（可選）
 *         type:
 *           type: string
 *           enum: [like, comment, follow, mention, system, announcement]
 *           description: 通知類型
 *         status:
 *           type: string
 *           enum: [unread, read, deleted]
 *           default: unread
 *           description: 通知狀態
 *         content:
 *           type: string
 *           description: 通知內容
 *         url:
 *           type: string
 *           description: 點擊跳轉連結
 *         action_text:
 *           type: string
 *           default: 查看
 *           description: 操作按鈕文字
 *         priority:
 *           type: integer
 *           default: 0
 *           description: 通知重要性（0-10）
 *         is_read:
 *           type: boolean
 *           default: false
 *           description: 是否已讀
 *         expire_at:
 *           type: string
 *           format: date-time
 *           description: 過期時間
 *         meta:
 *           type: object
 *           description: 額外數據
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateNotificationRequest:
 *       type: object
 *       required:
 *         - user_id
 *         - title
 *         - type
 *         - content
 *       properties:
 *         user_id:
 *           type: string
 *           description: 接收者ID
 *         title:
 *           type: string
 *           description: 通知標題
 *         sender_id:
 *           type: string
 *           description: 發送者ID（可選）
 *         type:
 *           type: string
 *           enum: [like, comment, follow, mention, system, announcement]
 *           description: 通知類型
 *         content:
 *           type: string
 *           description: 通知內容
 *         url:
 *           type: string
 *           description: 點擊跳轉連結
 *         action_text:
 *           type: string
 *           description: 操作按鈕文字
 *         priority:
 *           type: integer
 *           description: 通知重要性（0-10）
 *         meta:
 *           type: object
 *           description: 額外數據
 *     UpdateNotificationRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: 通知標題
 *         content:
 *           type: string
 *           description: 通知內容
 *         url:
 *           type: string
 *           description: 點擊跳轉連結
 *         action_text:
 *           type: string
 *           description: 操作按鈕文字
 *         priority:
 *           type: integer
 *           description: 通知重要性（0-10）
 *         status:
 *           type: string
 *           enum: [unread, read, deleted]
 *           description: 通知狀態
 *         is_read:
 *           type: boolean
 *           description: 是否已讀
 *         meta:
 *           type: object
 *           description: 額外數據
 */

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: 建立通知（管理員功能）
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationRequest'
 *     responses:
 *       201:
 *         description: 通知創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 notification:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *   get:
 *     summary: 取得用戶的通知列表
 *     tags: [Notifications]
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
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [like, comment, follow, mention, system, announcement]
 *         description: 篩選通知類型
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *         description: 只顯示未讀通知
 *     responses:
 *       200:
 *         description: 成功取得通知列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                 unreadCount:
 *                   type: integer
 *                   description: 未讀通知數量
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/notifications/read/all:
 *   patch:
 *     summary: 標記所有通知為已讀
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 標記成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 updatedCount:
 *                   type: integer
 *                   description: 更新的通知數量
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/notifications/batch:
 *   delete:
 *     summary: 批量刪除通知
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notification_ids
 *             properties:
 *               notification_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 要刪除的通知ID陣列
 *     responses:
 *       200:
 *         description: 批量刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *                   description: 刪除的通知數量
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/notifications/unread/count:
 *   get:
 *     summary: 取得未讀通知數量
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功取得未讀通知數量
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *                   description: 未讀通知數量
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: 標記單一通知為已讀
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 通知ID
 *     responses:
 *       200:
 *         description: 標記成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 notification:
 *                   $ref: '#/components/schemas/Notification'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 通知不存在
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: 取得單一通知
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 通知ID
 *     responses:
 *       200:
 *         description: 成功取得通知
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       401:
 *         description: 未授權
 *       404:
 *         description: 通知不存在
 *   put:
 *     summary: 更新通知（管理員功能）
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 通知ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNotificationRequest'
 *     responses:
 *       200:
 *         description: 通知更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 notification:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 通知不存在
 *   delete:
 *     summary: 刪除通知（管理員功能）
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 通知ID
 *     responses:
 *       200:
 *         description: 通知刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 通知不存在
 */

// 建立通知
router.post('/', token, isManager, createNotification)
// 取得所有通知
router.get('/', token, isUser, getNotifications)
// 批次標記全部通知為已讀（必須在 /:id 之前）
router.patch('/read/all', token, isUser, markAllNotificationsRead)
// 批次刪除通知
router.delete('/batch', token, isUser, deleteNotifications)

// 取得未讀通知數量（必須在 /:id 之前）
router.get('/unread/count', token, isUser, getUnreadCount)

// 標記單一通知為已讀（必須在 /:id 之前）
router.patch('/:id/read', token, isUser, markNotificationRead)

// 基本 CRUD 操作（必須在最後）
// 取得單一通知
router.get('/:id', token, isUser, getNotificationById)
// 更新通知
router.put('/:id', token, isManager, updateNotification)
// 刪除通知
router.delete('/:id', token, isManager, deleteNotification)

export default router
