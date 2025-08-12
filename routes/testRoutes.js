import express from 'express'
import { logger } from '../utils/logger.js'

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
  const debugInfo = {
    session: {
      exists: !!req.session,
      id: req.sessionID,
      bindUserId: req.session?.bindUserId,
      bindProvider: req.session?.bindProvider,
      userId: req.session?.userId,
      oauthState: req.session?.oauthState,
      isBindingFlow: req.session?.isBindingFlow,
      twitterBind: req.session?.['oauth:twitter:bind'],
      // 添加更多會話資訊
      allSessionKeys: req.session ? Object.keys(req.session) : [],
      sessionData: req.session ? JSON.stringify(req.session, null, 2) : null,
    },
    environment: {
      TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
      TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
      TWITTER_REDIRECT_URI: process.env.TWITTER_REDIRECT_URI,
      TWITTER_BIND_REDIRECT_URI: process.env.TWITTER_BIND_REDIRECT_URI,
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    },
    headers: {
      'user-agent': req.get('User-Agent'),
      host: req.get('Host'),
      referer: req.get('Referer'),
      cookie: req.get('Cookie'),
    },
    // 添加會話存儲資訊
    sessionStore: {
      type: process.env.NODE_ENV === 'production' ? 'Redis' : 'MemoryStore',
      // 嘗試檢查會話存儲狀態
      canAccess: !!req.session,
    },
  }

  res.json({
    success: true,
    debug: debugInfo,
    message: 'OAuth 調試資訊',
  })
})

// 新增會話測試端點
router.get('/session-test', async (req, res) => {
  try {
    // 設置測試會話資料
    req.session.testData = {
      timestamp: new Date().toISOString(),
      randomValue: Math.random(),
      message: '測試會話資料',
    }

    // 強制保存會話
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          logger.error('會話保存失敗:', err)
          reject(err)
        } else {
          logger.info('✅ 測試會話保存成功')
          resolve()
        }
      })
    })

    res.json({
      success: true,
      message: '測試會話資料已設置',
      sessionId: req.sessionID,
      testData: req.session.testData,
    })
  } catch (error) {
    logger.error('會話測試失敗:', error)
    res.status(500).json({
      success: false,
      message: '會話測試失敗',
      error: error.message,
    })
  }
})

// 新增會話驗證端點
router.get('/session-verify', (req, res) => {
  const testData = req.session.testData

  res.json({
    success: true,
    message: '會話驗證結果',
    sessionId: req.sessionID,
    testDataExists: !!testData,
    testData: testData,
    allSessionKeys: req.session ? Object.keys(req.session) : [],
    sessionData: req.session ? JSON.stringify(req.session, null, 2) : null,
  })
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
      cookies: req.headers.cookie ? 'present' : 'missing',
    }

    res.json({
      success: true,
      message: 'Session 調試資訊',
      session_info: sessionInfo,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Session 調試錯誤:', error)
    res.status(500).json({
      success: false,
      message: 'Session 調試失敗',
      error: error.message,
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
        message: '不支援的社群平台',
      })
    }

    // 檢查環境變數
    const envVars = {
      google: {
        id: 'GOOGLE_CLIENT_ID',
        secret: 'GOOGLE_CLIENT_SECRET',
        bindUri: 'GOOGLE_BIND_REDIRECT_URI',
      },
      facebook: {
        id: 'FACEBOOK_CLIENT_ID',
        secret: 'FACEBOOK_CLIENT_SECRET',
        bindUri: 'FACEBOOK_BIND_REDIRECT_URI',
      },
      discord: {
        id: 'DISCORD_CLIENT_ID',
        secret: 'DISCORD_CLIENT_SECRET',
        bindUri: 'DISCORD_BIND_REDIRECT_URI',
      },
      twitter: {
        id: 'TWITTER_CLIENT_ID',
        secret: 'TWITTER_CLIENT_SECRET',
        bindUri: 'TWITTER_BIND_REDIRECT_URI',
      },
    }

    const { id: clientIdEnv, secret: clientSecretEnv, bindUri: bindUriEnv } = envVars[provider]
    const configStatus = {
      client_id: !!process.env[clientIdEnv],
      client_secret: !!process.env[clientSecretEnv],
      bind_redirect_uri: !!process.env[bindUriEnv],
      strategy_available: !!req._passport?.instance?._strategies?.[`${provider}-bind`],
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
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('OAuth 綁定測試錯誤:', error)
    res.status(500).json({
      success: false,
      message: 'OAuth 綁定測試失敗',
      error: error.message,
    })
  }
})

export default router
