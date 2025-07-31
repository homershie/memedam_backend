import express from 'express'
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  validateCreateAnnouncement,
} from '../controllers/announcementController.js'
import { token, isAdmin, isUser } from '../middleware/auth.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Announcement:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - author
 *       properties:
 *         _id:
 *           type: string
 *           description: 公告唯一ID
 *         title:
 *           type: string
 *           description: 公告標題
 *         content:
 *           type: string
 *           description: 公告內容
 *         author:
 *           type: string
 *           description: 作者ID
 *         priority:
 *           type: integer
 *           default: 0
 *           description: 優先級（數字越大越優先）
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: 是否啟用
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: 開始顯示時間
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: 結束顯示時間
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateAnnouncementRequest:
 *       type: object
 *       required:
 *         - title
 *         - content
 *       properties:
 *         title:
 *           type: string
 *           description: 公告標題
 *         content:
 *           type: string
 *           description: 公告內容
 *         priority:
 *           type: integer
 *           default: 0
 *           description: 優先級
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: 是否啟用
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: 開始顯示時間
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: 結束顯示時間
 *     UpdateAnnouncementRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: 公告標題
 *         content:
 *           type: string
 *           description: 公告內容
 *         priority:
 *           type: integer
 *           description: 優先級
 *         isActive:
 *           type: boolean
 *           description: 是否啟用
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: 開始顯示時間
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: 結束顯示時間
 */

/**
 * @swagger
 * /api/announcements:
 *   post:
 *     summary: 建立公告
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAnnouncementRequest'
 *     responses:
 *       201:
 *         description: 公告創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 announcement:
 *                   $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得所有公告
 *     tags: [Announcements]
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
 *         name: active
 *         schema:
 *           type: boolean
 *         description: 只顯示啟用的公告
 *       - in: query
 *         name: priority
 *         schema:
 *           type: integer
 *         description: 篩選優先級
 *     responses:
 *       200:
 *         description: 成功取得公告列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcements:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Announcement'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 */

/**
 * @swagger
 * /api/announcements/{id}:
 *   get:
 *     summary: 取得單一公告
 *     tags: [Announcements]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 公告ID
 *     responses:
 *       200:
 *         description: 成功取得公告
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Announcement'
 *       404:
 *         description: 公告不存在
 *   put:
 *     summary: 更新公告（管理員功能）
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 公告ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAnnouncementRequest'
 *     responses:
 *       200:
 *         description: 公告更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 announcement:
 *                   $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 公告不存在
 *   delete:
 *     summary: 刪除公告（管理員功能）
 *     tags: [Announcements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 公告ID
 *     responses:
 *       200:
 *         description: 公告刪除成功
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
 *         description: 公告不存在
 */

// 建立公告
router.post('/', token, isUser, validateCreateAnnouncement, createAnnouncement)
// 取得所有公告
router.get('/', getAnnouncements)
// 取得單一公告
router.get('/:id', getAnnouncementById)
// 更新公告
router.put('/:id', token, isAdmin, updateAnnouncement)
// 刪除公告
router.delete('/:id', token, isAdmin, deleteAnnouncement)

export default router
