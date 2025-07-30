import express from 'express'
import {
  createMeme,
  getMemes,
  getMemeById,
  updateMeme,
  deleteMeme,
  addEditor,
  removeEditor,
  getMemesByTags,
  getSearchSuggestions,
  validateUpdateMeme,
  updateMemeHotScore,
  batchUpdateHotScores,
  getHotMemes,
  getTrendingMemes,
  getMemeScoreAnalysis,
} from '../controllers/memeController.js'
import {
  proposeEdit,
  listProposals,
  approveProposal,
  rejectProposal,
} from '../controllers/memeEditProposalController.js'
import { token, canEditMeme, isUser } from '../middleware/auth.js'
import { validateCreateMeme } from '../controllers/memeController.js'
import { arrayUpload } from '../middleware/upload.js'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     Meme:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - author
 *       properties:
 *         _id:
 *           type: string
 *           description: 迷因唯一ID
 *         title:
 *           type: string
 *           description: 迷因標題
 *         description:
 *           type: string
 *           description: 迷因描述
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: 迷因圖片URL陣列
 *         author:
 *           type: string
 *           description: 作者ID
 *         editors:
 *           type: array
 *           items:
 *             type: string
 *           description: 協作者ID陣列
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: 標籤陣列
 *         likes:
 *           type: integer
 *           description: 讚數
 *         dislikes:
 *           type: integer
 *           description: 倒讚數
 *         views:
 *           type: integer
 *           description: 瀏覽數
 *         shares:
 *           type: integer
 *           description: 分享數
 *         hotScore:
 *           type: number
 *           description: 熱門分數
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
 *     CreateMemeRequest:
 *       type: object
 *       required:
 *         - title
 *         - description
 *       properties:
 *         title:
 *           type: string
 *           description: 迷因標題
 *         description:
 *           type: string
 *           description: 迷因描述
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: 標籤陣列
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *           description: 迷因圖片文件
 *     UpdateMemeRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: 迷因標題
 *         description:
 *           type: string
 *           description: 迷因描述
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: 標籤陣列
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *           description: 迷因圖片文件
 */

/**
 * @swagger
 * /api/memes:
 *   post:
 *     summary: 建立新迷因
 *     tags: [Memes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateMemeRequest'
 *     responses:
 *       201:
 *         description: 迷因創建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Meme'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *   get:
 *     summary: 取得所有迷因
 *     tags: [Memes]
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
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, popular, hot]
 *           default: newest
 *         description: 排序方式
 *     responses:
 *       200:
 *         description: 成功取得迷因列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meme'
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
router.post('/', token, isUser, arrayUpload('images', 5), validateCreateMeme, createMeme)
router.get('/', getMemes)

/**
 * @swagger
 * /api/memes/search-suggestions:
 *   get:
 *     summary: 取得搜尋建議
 *     tags: [Memes]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字
 *     responses:
 *       200:
 *         description: 成功取得搜尋建議
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 * /api/memes/by-tags:
 *   get:
 *     summary: 根據標籤篩選迷因
 *     tags: [Memes]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: 標籤陣列
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
 *         description: 成功取得篩選結果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Meme'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 * /api/memes/{id}:
 *   get:
 *     summary: 取得指定迷因
 *     tags: [Memes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 成功取得迷因資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Meme'
 *       404:
 *         description: 迷因不存在
 *   put:
 *     summary: 更新迷因 (作者/協作者專用)
 *     tags: [Memes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMemeRequest'
 *     responses:
 *       200:
 *         description: 迷因更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Meme'
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 迷因不存在
 *   delete:
 *     summary: 刪除迷因 (作者/協作者專用)
 *     tags: [Memes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 迷因ID
 *     responses:
 *       200:
 *         description: 迷因刪除成功
 *       401:
 *         description: 未授權
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 迷因不存在
 */
router.get('/search-suggestions', getSearchSuggestions)
router.get('/by-tags', getMemesByTags)
// 批次更新所有迷因的熱門分數
router.post('/batch-update-hot-scores', token, batchUpdateHotScores)
// 取得熱門迷因列表
router.get('/hot/list', getHotMemes)
// 取得趨勢迷因列表
router.get('/trending/list', getTrendingMemes)

// 取得迷因的詳細分數分析（必須在 /:id 之前）
router.get('/:id/score-analysis', getMemeScoreAnalysis)

// 新增協作者
router.post('/:id/editors', token, addEditor)
// 移除協作者
router.delete('/:id/editors', token, removeEditor)
// 提交修改提案
router.post('/:id/proposals', token, proposeEdit)
// 查詢所有提案（僅作者/協作者/管理員）
router.get('/:id/proposals', token, canEditMeme, listProposals)
// 審核通過
router.post('/:id/proposals/:proposalId/approve', token, canEditMeme, approveProposal)
// 駁回提案
router.post('/:id/proposals/:proposalId/reject', token, canEditMeme, rejectProposal)

// 熱門分數相關端點
// 更新單一迷因的熱門分數
router.put('/:id/hot-score', token, updateMemeHotScore)

// 基本 CRUD 操作（必須在最後）
router.get('/:id', getMemeById)
router.put('/:id', token, canEditMeme, arrayUpload('images', 5), validateUpdateMeme, updateMeme)
router.delete('/:id', token, canEditMeme, deleteMeme)

export default router
