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
 *     MemeEditProposal:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: 提案唯一ID
 *         memeId:
 *           type: string
 *           description: 迷因ID
 *         proposerId:
 *           type: string
 *           description: 提案者ID
 *         changes:
 *           type: object
 *           description: 修改內容
 *         notes:
 *           type: string
 *           description: 修改說明
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: 提案狀態
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新時間
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *           enum: [comprehensive, relevance, quality, freshness, popularity, createdAt, newest, oldest, popular, hot]
 *           default: comprehensive
 *         description: 排序方式
 *       - in: query
 *         name: useAdvancedSearch
 *         schema:
 *           type: boolean
 *           default: true
 *         description: 是否使用進階搜尋
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: 作者篩選
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日期
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: 結束日期
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
 *                     totalPages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *                 scoring:
 *                   type: object
 *                   properties:
 *                     relevance:
 *                       type: number
 *                     quality:
 *                       type: number
 *                     freshness:
 *                       type: number
 *                     userBehavior:
 *                       type: number
 *                     comprehensive:
 *                       type: number
 *                 searchStats:
 *                   type: object
 *                   properties:
 *                     totalResults:
 *                       type: integer
 *                     averageScores:
 *                       type: object
 *                     scoreDistribution:
 *                       type: object
 *                 searchAlgorithm:
 *                   type: string
 *                   description: 使用的搜尋演算法
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search-suggestions', getSearchSuggestions)
router.get('/by-tags', getMemesByTags)
/**
 * @swagger
 * /api/memes/batch-update-hot-scores:
 *   post:
 *     summary: 批次更新所有迷因的熱門分數
 *     tags: [Memes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 批次更新完成
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 updatedCount:
 *                   type: integer
 *       401:
 *         description: 未授權
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
router.post('/batch-update-hot-scores', token, batchUpdateHotScores)

/**
 * @swagger
 * /api/memes/hot/list:
 *   get:
 *     summary: 取得熱門迷因列表
 *     tags: [Memes]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 返回數量限制
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *     responses:
 *       200:
 *         description: 成功取得熱門迷因列表
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
router.get('/hot/list', getHotMemes)

/**
 * @swagger
 * /api/memes/trending/list:
 *   get:
 *     summary: 取得趨勢迷因列表
 *     tags: [Memes]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 返回數量限制
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: 趨勢計算週期
 *     responses:
 *       200:
 *         description: 成功取得趨勢迷因列表
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
router.get('/trending/list', getTrendingMemes)

/**
 * @swagger
 * /api/memes/{id}/score-analysis:
 *   get:
 *     summary: 取得迷因的詳細分數分析
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
 *         description: 成功取得分數分析
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hotScore:
 *                   type: number
 *                   description: 熱門分數
 *                 scoreBreakdown:
 *                   type: object
 *                   description: 分數細項分析
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: 改進建議
 *       404:
 *         description: 迷因不存在
 */
router.get('/:id/score-analysis', getMemeScoreAnalysis)

/**
 * @swagger
 * /api/memes/{id}/editors:
 *   post:
 *     summary: 新增協作者
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - editorId
 *             properties:
 *               editorId:
 *                 type: string
 *                 description: 協作者用戶ID
 *     responses:
 *       200:
 *         description: 協作者新增成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: 移除協作者
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
 *       - in: query
 *         name: editorId
 *         required: true
 *         schema:
 *           type: string
 *         description: 協作者用戶ID
 *     responses:
 *       200:
 *         description: 協作者移除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/editors', token, addEditor)
router.delete('/:id/editors', token, removeEditor)

/**
 * @swagger
 * /api/memes/{id}/proposals:
 *   post:
 *     summary: 提交修改提案
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - changes
 *             properties:
 *               changes:
 *                 type: object
 *                 description: 修改內容
 *               notes:
 *                 type: string
 *                 description: 修改說明
 *     responses:
 *       201:
 *         description: 提案提交成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 proposalId:
 *                   type: string
 *       400:
 *         description: 請求參數錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: 查詢所有提案
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
 *         description: 成功取得提案列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 proposals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: 提案資訊
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/proposals', token, proposeEdit)
router.get('/:id/proposals', token, canEditMeme, listProposals)

/**
 * @swagger
 * /api/memes/{id}/proposals/{proposalId}/approve:
 *   post:
 *     summary: 審核通過提案
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
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提案ID
 *     responses:
 *       200:
 *         description: 提案審核通過成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因或提案不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/proposals/:proposalId/approve', token, canEditMeme, approveProposal)

/**
 * @swagger
 * /api/memes/{id}/proposals/{proposalId}/reject:
 *   post:
 *     summary: 駁回提案
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
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: 提案ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: 駁回原因
 *     responses:
 *       200:
 *         description: 提案駁回成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: 權限不足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因或提案不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/proposals/:proposalId/reject', token, canEditMeme, rejectProposal)

/**
 * @swagger
 * /api/memes/{id}/hot-score:
 *   put:
 *     summary: 更新單一迷因的熱門分數
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
 *         description: 熱門分數更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 newHotScore:
 *                   type: number
 *       401:
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 迷因不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/hot-score', token, updateMemeHotScore)

// 基本 CRUD 操作（必須在最後）
router.get('/:id', getMemeById)
router.put('/:id', token, canEditMeme, arrayUpload('images', 5), validateUpdateMeme, updateMeme)
router.delete('/:id', token, canEditMeme, deleteMeme)

export default router
