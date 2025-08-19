import express from 'express'
import {
  // 使用者端 API
  getNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
  getUnreadCount,
  // 管理員端 API
  createNotification,
  hardDeleteNotification,
  cleanupOrphanReceiptsController,
  cleanupExpiredReceiptsController,
} from '../controllers/notificationController.js'
import { token, isUser, isManager } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationEvent:
 *       type: object
 *       required:
 *         - actorId
 *         - verb
 *         - objectType
 *         - objectId
 *       properties:
 *         _id:
 *           type: string
 *           description: 通知事件的唯一ID
 *         actor_id:
 *           type: string
 *           description: 觸發者ID
 *         verb:
 *           type: string
 *           enum: [follow, like, comment, mention, system, announcement, share, report]
 *           description: 動作類型
 *         object_type:
 *           type: string
 *           enum: [post, comment, user, meme, collection]
 *           description: 物件類型
 *         object_id:
 *           type: string
 *           description: 物件ID
 *         payload:
 *           type: object
 *           description: 額外資料
 *         title:
 *           type: string
 *           description: 系統通知標題
 *         content:
 *           type: string
 *           description: 系統通知內容
 *         url:
 *           type: string
 *           description: 點擊跳轉連結
 *         actionText:
 *           type: string
 *           description: 按鈕顯示文字
 *         expireAt:
 *           type: string
 *           format: date-time
 *           description: 過期時間
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 建立時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     NotificationReceipt:
 *       type: object
 *       required:
 *         - notificationId
 *         - userId
 *       properties:
 *         _id:
 *           type: string
 *           description: 收件項的唯一ID
 *         notification_id:
 *           type: string
 *           description: 對應的通知事件ID
 *         user_id:
 *           type: string
 *           description: 收件者ID
 *         read_at:
 *           type: string
 *           format: date-time
 *           description: 已讀時間
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           description: 使用者刪除時間
 *         archived_at:
 *           type: string
 *           format: date-time
 *           description: 封存時間
 *         isRead:
 *           type: boolean
 *           description: 是否已讀
 *         isDeleted:
 *           type: boolean
 *           description: 是否已刪除
 *         isArchived:
 *           type: boolean
 *           description: 是否已封存
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 建立時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     NotificationWithEvent:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: 收件項的ID
 *         notification_id:
 *           type: string
 *           description: 通知事件ID
 *         user_id:
 *           type: string
 *           description: 收件者ID
 *         read_at:
 *           type: string
 *           format: date-time
 *         deleted_at:
 *           type: string
 *           format: date-time
 *         archived_at:
 *           type: string
 *           format: date-time
 *         isRead:
 *           type: boolean
 *         isDeleted:
 *           type: boolean
 *         isArchived:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         # 通知事件資料
 *         actor_id:
 *           type: object
 *           description: 觸發者資料
 *         verb:
 *           type: string
 *         object_type:
 *           type: string
 *         object_id:
 *           type: string
 *         payload:
 *           type: object
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         url:
 *           type: string
 *         actionText:
 *           type: string
 *         expireAt:
 *           type: string
 *           format: date-time
 *         eventCreatedAt:
 *           type: string
 *           format: date-time
 *     CreateNotificationRequest:
 *       type: object
 *       required:
 *         - actorId
 *         - verb
 *         - objectType
 *         - objectId
 *       properties:
 *         actor_id:
 *           type: string
 *           description: 觸發者ID
 *         verb:
 *           type: string
 *           enum: [follow, like, comment, mention, system, announcement, share, report]
 *           description: 動作類型
 *         object_type:
 *           type: string
 *           enum: [post, comment, user, meme, collection]
 *           description: 物件類型
 *         object_id:
 *           type: string
 *           description: 物件ID
 *         payload:
 *           type: object
 *           description: 額外資料
 *         title:
 *           type: string
 *           description: 系統通知標題
 *         content:
 *           type: string
 *           description: 系統通知內容
 *         url:
 *           type: string
 *           description: 點擊跳轉連結
 *         actionText:
 *           type: string
 *           description: 按鈕顯示文字
 *         expireAt:
 *           type: string
 *           format: date-time
 *           description: 過期時間
 *     UpdateReceiptRequest:
 *       type: object
 *       properties:
 *         read:
 *           type: boolean
 *           description: 是否標記為已讀
 *         archived:
 *           type: boolean
 *           description: 是否標記為封存
 *     BatchDeleteRequest:
 *       type: object
 *       properties:
 *         ids:
 *           type: array
 *           items:
 *             type: string
 *           description: 要刪除的收件項ID陣列
 *         olderThan:
 *           type: string
 *           format: date-time
 *           description: 早於此時間的收件項
 *         unreadOnly:
 *           type: boolean
 *           description: 只刪除未讀收件項
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: 取得使用者的通知列表
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
 *           default: 20
 *         description: 每頁數量
 *       - in: query
 *         name: verb
 *         schema:
 *           type: string
 *           enum: [follow, like, comment, mention, system, announcement, share, report]
 *         description: 篩選動作類型
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *         description: 只顯示未讀通知
 *       - in: query
 *         name: archived
 *         schema:
 *           type: boolean
 *         description: 篩選封存項目
 *     responses:
 *       200:
 *         description: 成功取得通知列表
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
 *                     $ref: '#/components/schemas/NotificationWithEvent'
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 unreadCount:
 *                   type: integer
 *                   description: 未讀通知數量
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: 未授權
 *   delete:
 *     summary: 批次刪除通知收件項
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchDeleteRequest'
 *     responses:
 *       200:
 *         description: 批次刪除成功
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
 *                     deletedCount:
 *                       type: integer
 *                       description: 刪除的收件項數量
 *                 error:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: 請求參數錯誤
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
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedCount:
 *                       type: integer
 *                       description: 更新的收件項數量
 *                 error:
 *                   type: string
 *                   nullable: true
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
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *                       description: 未讀通知數量
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: 取得特定通知收件項
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 收件項的ID
 *     responses:
 *       200:
 *         description: 成功取得通知
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationWithEvent'
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 *       404:
 *         description: 通知不存在
 *   patch:
 *     summary: 更新通知收件項
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 收件項的ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReceiptRequest'
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationWithEvent'
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 *       404:
 *         description: 通知不存在
 *   delete:
 *     summary: 軟刪除通知收件項
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 收件項的ID
 *     responses:
 *       204:
 *         description: 刪除成功
 *       401:
 *         description: 未授權
 *       404:
 *         description: 通知不存在
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: 標記特定通知為已讀
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 收件項的ID
 *     responses:
 *       200:
 *         description: 標記成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationWithEvent'
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 *       404:
 *         description: 通知不存在
 */

/**
 * @swagger
 * /api/notifications/admin:
 *   post:
 *     summary: 建立通知事件（管理員功能）
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
 *         description: 通知事件建立成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationEvent'
 *                 error:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/notifications/admin/{id}:
 *   delete:
 *     summary: 硬刪除通知事件（管理員功能）
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 通知事件ID
 *       - in: query
 *         name: hard
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 確認硬刪除操作
 *     responses:
 *       200:
 *         description: 硬刪除成功
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
 *                     message:
 *                       type: string
 *                     deletedReceipts:
 *                       type: integer
 *                       description: 同時刪除的收件項數量
 *                 error:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 通知事件不存在
 */

/**
 * @swagger
 * /api/notifications/admin/cleanup-orphans:
 *   post:
 *     summary: 清理孤兒收件項（管理員功能）
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 清理完成
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
 *                     message:
 *                       type: string
 *                     deletedCount:
 *                       type: integer
 *                       description: 刪除的孤兒收件項數量
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

/**
 * @swagger
 * /api/notifications/admin/cleanup-expired:
 *   post:
 *     summary: 清理過期已刪除收件項（管理員功能）
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 清理完成
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
 *                     message:
 *                       type: string
 *                     deletedCount:
 *                       type: integer
 *                       description: 刪除的過期收件項數量
 *                 error:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 */

// ==================== 使用者端路由 ====================

// 取得通知列表
router.get('/', token, isUser, getNotifications)

// 批次刪除通知收件項
router.delete('/', token, isUser, deleteNotifications)

// 標記所有通知為已讀
router.patch('/read/all', token, isUser, markAllNotificationsRead)

// 取得未讀通知數量
router.get('/unread/count', token, isUser, getUnreadCount)

// 標記特定通知為已讀
router.patch('/:id/read', token, isUser, markNotificationRead)

// 基本 CRUD 操作
router.get('/:id', token, isUser, getNotificationById)
router.patch('/:id', token, isUser, updateNotification)
router.delete('/:id', token, isUser, deleteNotification)

// ==================== 管理員端路由 ====================

// 建立通知事件
router.post('/admin', token, isManager, createNotification)

// 硬刪除通知事件
router.delete('/admin/:id', token, isManager, hardDeleteNotification)

// 清理孤兒收件項
router.post('/admin/cleanup-orphans', token, isManager, cleanupOrphanReceiptsController)

// 清理過期已刪除收件項
router.post('/admin/cleanup-expired', token, isManager, cleanupExpiredReceiptsController)

export default router
