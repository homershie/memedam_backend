import Meme from '../models/Meme.js'
import { logger } from '../utils/logger.js'

/**
 * 生成網站地圖 XML
 */
export const generateSitemap = async (req, res) => {
  try {
    // 設定響應標頭
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600') // 快取1小時

    // 靜態頁面
    const staticUrls = [
      { loc: 'https://www.memedam.com/', priority: '1.0', changefreq: 'daily' },
      { loc: 'https://www.memedam.com/memes/all', priority: '0.9', changefreq: 'hourly' },
      { loc: 'https://www.memedam.com/memes/hot', priority: '0.9', changefreq: 'hourly' },
      { loc: 'https://www.memedam.com/memes/new', priority: '0.9', changefreq: 'hourly' },
      { loc: 'https://www.memedam.com/memes/trending', priority: '0.8', changefreq: 'hourly' },
      { loc: 'https://www.memedam.com/about', priority: '0.6', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/contact', priority: '0.5', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/donate', priority: '0.4', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/premium', priority: '0.6', changefreq: 'weekly' },
      { loc: 'https://www.memedam.com/feedback', priority: '0.4', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/privacy', priority: '0.5', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/terms', priority: '0.5', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/dmca', priority: '0.4', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/dsar', priority: '0.4', changefreq: 'monthly' },
      { loc: 'https://www.memedam.com/announcements', priority: '0.5', changefreq: 'weekly' },
    ]

    // 獲取公開的迷因，用於生成動態URL
    const memes = await Meme.find({ status: 'public' })
      .select('slug title cover_image image_url createdAt updatedAt views likes comments')
      .sort({ updatedAt: -1 })
      .limit(1000) // 限制為最新的1000個迷因
      .lean()

    // 動態生成迷因詳情頁面URL
    const memeUrls = memes.map((meme) => {
      const lastmod = meme.updatedAt || meme.createdAt
      const priority = Math.min(0.8, Math.max(0.3, (meme.views || 0) / 10000 + 0.3)) // 基於瀏覽量計算優先級
      const changefreq = getChangeFrequency(meme.updatedAt, meme.createdAt)

      return {
        loc: `https://www.memedam.com/memes/detail/${meme.slug}`,
        lastmod: lastmod.toISOString().split('T')[0], // 格式為 YYYY-MM-DD
        priority: priority.toFixed(1),
        changefreq,
        image: meme.cover_image || meme.image_url,
        title: meme.title,
      }
    })

    // 組合所有URL
    const allUrls = [...staticUrls, ...memeUrls]

    // 生成XML內容
    const xmlContent = generateSitemapXML(allUrls)

    res.send(xmlContent)
  } catch (error) {
    logger.error('生成網站地圖失敗:', error)
    res.status(500).send('內部服務器錯誤')
  }
}

/**
 * 根據更新時間計算變更頻率
 */
function getChangeFrequency(updatedAt, createdAt) {
  const now = new Date()
  const lastUpdate = new Date(updatedAt || createdAt)
  const daysDiff = (now - lastUpdate) / (1000 * 60 * 60 * 24)

  if (daysDiff < 1) return 'daily'
  if (daysDiff < 7) return 'weekly'
  if (daysDiff < 30) return 'monthly'
  return 'yearly'
}

/**
 * 生成網站地圖XML內容
 */
function generateSitemapXML(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'

  urls.forEach((url) => {
    xml += '  <url>\n'
    xml += `    <loc>${url.loc}</loc>\n`
    if (url.lastmod) {
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`
    }
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`
    xml += `    <priority>${url.priority}</priority>\n`

    // 如果有圖片資訊，添加圖片元素
    if (url.image) {
      xml += '    <image:image>\n'
      xml += `      <image:loc>${url.image}</image:loc>\n`
      if (url.title) {
        xml += `      <image:caption>${escapeXml(url.title)}</image:caption>\n`
      }
      xml += '    </image:image>\n'
    }

    xml += '  </url>\n'
  })

  xml += '</urlset>'
  return xml
}

/**
 * XML字符轉義
 */
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&#39;'
      case '"':
        return '&quot;'
    }
  })
}
