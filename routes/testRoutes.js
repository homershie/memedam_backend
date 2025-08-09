import express from 'express'

const router = express.Router()

router.get('/test', (req, res) => {
  res.json({ message: 'Test route works' })
})

router.get('/categories', (req, res) => {
  res.json({
    message: 'Categories route works',
    categories: {
      memeTypes: [
        { _id: 'text', name: '用語', count: 0 },
        { _id: 'image', name: '圖片', count: 0 },
        { _id: 'video', name: '影片', count: 0 },
        { _id: 'audio', name: '音訊', count: 0 },
      ],
      popularTags: [],
      allTags: [],
    },
  })
})

/**
 * @swagger
 * /api/test/oauth-debug:
 *   get:
 *     summary: OAuth 配置調試工具
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: OAuth 配置狀態
 */
router.get('/oauth-debug', (req, res) => {
  try {
    const oauthConfig = {
      google: {
        clientId: !!process.env.GOOGLE_CLIENT_ID,
        clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        bindRedirectUri: process.env.GOOGLE_BIND_REDIRECT_URI,
      },
      facebook: {
        clientId: !!process.env.FACEBOOK_CLIENT_ID,
        clientSecret: !!process.env.FACEBOOK_CLIENT_SECRET,
        redirectUri: process.env.FACEBOOK_REDIRECT_URI,
        bindRedirectUri: process.env.FACEBOOK_BIND_REDIRECT_URI,
      },
      discord: {
        clientId: !!process.env.DISCORD_CLIENT_ID,
        clientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI,
        bindRedirectUri: process.env.DISCORD_BIND_REDIRECT_URI,
      },
      twitter: {
        clientId: !!process.env.TWITTER_CLIENT_ID,
        clientSecret: !!process.env.TWITTER_CLIENT_SECRET,
        redirectUri: process.env.TWITTER_REDIRECT_URI,
        bindRedirectUri: process.env.TWITTER_BIND_REDIRECT_URI,
      },
      session: {
        secret: !!process.env.SESSION_SECRET,
        nodeEnv: process.env.NODE_ENV,
      }
    }

    res.json({
      success: true,
      message: 'OAuth 配置狀態',
      config: oauthConfig,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '調試工具錯誤',
      error: error.message
    })
  }
})

/**
 * @swagger
 * /api/test/session-debug:
 *   get:
 *     summary: Session 調試工具
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Session 狀態
 */
router.get('/session-debug', (req, res) => {
  try {
    res.json({
      success: true,
      session: {
        id: req.sessionID,
        exists: !!req.session,
        data: req.session || null,
      },
      headers: {
        'user-agent': req.get('User-Agent'),
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP'),
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '調試工具錯誤',
      error: error.message
    })
  }
})

export default router
