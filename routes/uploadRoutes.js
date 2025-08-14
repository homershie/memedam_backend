import express from 'express'
import { singleUpload } from '../middleware/upload.js'
import { token, isUser, blockBannedUser } from '../middleware/auth.js'
import { uploadImage } from '../controllers/uploadController.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: 操作結果訊息
 *         imageUrl:
 *           type: string
 *           description: 上傳後的圖片URL
 *         filename:
 *           type: string
 *           description: 檔案名稱
 *         size:
 *           type: integer
 *           description: 檔案大小（bytes）
 *         mimetype:
 *           type: string
 *           description: 檔案類型
 */

/**
 * @swagger
 * /api/upload/image:
 *   post:
 *     summary: 上傳圖片
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 要上傳的圖片檔案
 *     responses:
 *       200:
 *         description: 圖片上傳成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: 檔案太大
 *       415:
 *         description: 不支援的檔案類型
 */

/**
 * @swagger
 * /api/upload/avatar:
 *   post:
 *     summary: 上傳頭像
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: 要上傳的頭像檔案
 *     responses:
 *       200:
 *         description: 頭像上傳成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: 請求參數錯誤
 *       413:
 *         description: 檔案太大
 *       415:
 *         description: 不支援的檔案類型
 */

router.post('/image', token, isUser, blockBannedUser, singleUpload('image'), uploadImage)
router.post('/avatar', token, isUser, blockBannedUser, singleUpload('avatar'), uploadImage)

export default router
