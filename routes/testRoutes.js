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
// OAuth 配置調試端點
router.get('/oauth-debug', (req, res) => {
  try {
    const oauthConfig = {
      google: {
        enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        client_id: !!process.env.GOOGLE_CLIENT_ID,
        client_secret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: !!process.env.GOOGLE_REDIRECT_URI,
        bind_redirect_uri: !!process.env.GOOGLE_BIND_REDIRECT_URI,
        strategy_name: 'google-bind'
      },
      facebook: {
        enabled: !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
        client_id: !!process.env.FACEBOOK_CLIENT_ID,
        client_secret: !!process.env.FACEBOOK_CLIENT_SECRET,
        redirect_uri: !!process.env.FACEBOOK_REDIRECT_URI,
        bind_redirect_uri: !!process.env.FACEBOOK_BIND_REDIRECT_URI,
        strategy_name: 'facebook-bind'
      },
      discord: {
        enabled: !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
        client_id: !!process.env.DISCORD_CLIENT_ID,
        client_secret: !!process.env.DISCORD_CLIENT_SECRET,
        redirect_uri: !!process.env.DISCORD_REDIRECT_URI,
        bind_redirect_uri: !!process.env.DISCORD_BIND_REDIRECT_URI,
        strategy_name: 'discord-bind'
      },
      twitter: {
        enabled: !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
        client_id: !!process.env.TWITTER_CLIENT_ID,
        client_secret: !!process.env.TWITTER_CLIENT_SECRET,
        redirect_uri: !!process.env.TWITTER_REDIRECT_URI,
        bind_redirect_uri: !!process.env.TWITTER_BIND_REDIRECT_URI,
        strategy_name: 'twitter-oauth2-bind'
      }
    }

    const sessionConfig = {
      session_secret: !!process.env.SESSION_SECRET,
      session_configured: !!req.session
    }

    res.json({
      success: true,
      message: 'OAuth 配置檢查完成',
      oauth_config: oauthConfig,
      session_config: sessionConfig,
      node_env: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('OAuth 配置檢查錯誤:', error)
    res.status(500).json({
      success: false,
      message: 'OAuth 配置檢查失敗',
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
// Session 調試端點
router.get('/session-debug', (req, res) => {
  try {
    const sessionInfo = {
      session_exists: !!req.session,
      session_id: req.sessionID || null,
      oauth_state: req.session?.oauthState || null,
      bind_user_id: req.session?.bindUserId || null,
      bind_provider: req.session?.bindProvider || null,
      cookies: req.headers.cookie ? 'present' : 'missing'
    }

    res.json({
      success: true,
      message: 'Session 調試資訊',
      session_info: sessionInfo,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Session 調試錯誤:', error)
    res.status(500).json({
      success: false,
      message: 'Session 調試失敗',
      error: error.message
    })
  }
})

// OAuth 綁定流程測試端點（需要認證）
router.get('/oauth-bind-test/:provider', (req, res) => {
  try {
    const { provider } = req.params
    const validProviders = ['google', 'facebook', 'discord', 'twitter']
    
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: '不支援的社群平台'
      })
    }

    // 檢查環境變數
    const envVars = {
      google: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET', bindUri: 'GOOGLE_BIND_REDIRECT_URI' },
      facebook: { id: 'FACEBOOK_CLIENT_ID', secret: 'FACEBOOK_CLIENT_SECRET', bindUri: 'FACEBOOK_BIND_REDIRECT_URI' },
      discord: { id: 'DISCORD_CLIENT_ID', secret: 'DISCORD_CLIENT_SECRET', bindUri: 'DISCORD_BIND_REDIRECT_URI' },
      twitter: { id: 'TWITTER_CLIENT_ID', secret: 'TWITTER_CLIENT_SECRET', bindUri: 'TWITTER_BIND_REDIRECT_URI' }
    }

    const { id: clientIdEnv, secret: clientSecretEnv, bindUri: bindUriEnv } = envVars[provider]
    const configStatus = {
      client_id: !!process.env[clientIdEnv],
      client_secret: !!process.env[clientSecretEnv],
      bind_redirect_uri: !!process.env[bindUriEnv],
      strategy_available: !!req._passport?.instance?._strategies?.[`${provider}-bind`]
    }

    // 模擬綁定流程
    const state = Math.random().toString(36).substring(2, 15)
    const authUrl = `/api/users/bind-auth/${provider}/init?state=${state}`

    res.json({
      success: true,
      message: `${provider} OAuth 綁定測試`,
      provider,
      config_status: configStatus,
      test_auth_url: authUrl,
      test_state: state,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('OAuth 綁定測試錯誤:', error)
    res.status(500).json({
      success: false,
      message: 'OAuth 綁定測試失敗',
      error: error.message
    })
  }
})

export default router
