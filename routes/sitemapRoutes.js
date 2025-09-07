import express from 'express'
import { generateSitemap } from '../controllers/sitemapController.js'

const router = express.Router()

/**
 * @swagger
 * /api/sitemap.xml:
 *   get:
 *     summary: 獲取網站地圖
 *     description: 生成包含所有頁面和迷因詳情頁面的XML網站地圖，用於SEO優化
 *     tags: [SEO]
 *     responses:
 *       200:
 *         description: 成功生成網站地圖
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *               example: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">...</urlset>"
 *       500:
 *         description: 內部服務器錯誤
 */
router.get('/sitemap.xml', generateSitemap)

export default router
