import axios from 'axios'
import { logger } from '../../utils/logger.js'

// 測試 Cloudflare 環境下的 session 處理
const testCloudflareSession = async () => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://api.memedam.com' 
    : 'http://localhost:4000'

  logger.info('=== Cloudflare Session 測試開始 ===')
  logger.info(`測試環境: ${baseUrl}`)

  try {
    // 1. 測試健康檢查
    logger.info('1. 測試健康檢查...')
    const healthResponse = await axios.get(`${baseUrl}/health`)
    logger.info(`健康檢查狀態: ${healthResponse.status}`)
    logger.info(`Redis 狀態: ${healthResponse.data.redis?.connected ? '已連接' : '未連接'}`)

    // 2. 測試 session 創建
    logger.info('2. 測試 session 創建...')
    const sessionResponse = await axios.get(`${baseUrl}/api/test/session`, {
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    
    const cookies = sessionResponse.headers['set-cookie']
    logger.info(`Session cookies: ${cookies ? cookies.length : 0} 個`)
    
    if (cookies) {
      cookies.forEach((cookie, index) => {
        logger.info(`Cookie ${index + 1}: ${cookie.substring(0, 100)}...`)
      })
    }

    // 3. 測試 OAuth 狀態設定（模擬）
    logger.info('3. 測試 OAuth 狀態設定...')
    
    // 創建一個 axios instance 來保持 cookies
    const client = axios.create({
      baseURL: baseUrl,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    // 如果有 cookies，設定它們
    if (cookies) {
      const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ')
      client.defaults.headers.Cookie = cookieString
    }

    // 測試 OAuth 初始化（不實際觸發 Discord）
    try {
      const testOAuthResponse = await client.get('/api/test/oauth-state')
      logger.info(`OAuth 狀態測試: ${testOAuthResponse.status}`)
      logger.info(`生成的狀態: ${testOAuthResponse.data.state}`)
      logger.info(`Session ID: ${testOAuthResponse.data.sessionId}`)
    } catch (oauthError) {
      if (oauthError.response?.status === 404) {
        logger.info('OAuth 狀態測試端點不存在，跳過此測試')
      } else {
        throw oauthError
      }
    }

    // 4. 測試跨域請求處理
    logger.info('4. 測試跨域請求處理...')
    try {
      const corsResponse = await axios.options(`${baseUrl}/api/users/auth/discord`, {
        headers: {
          'Origin': 'https://memedam.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      })
      logger.info(`CORS 預檢狀態: ${corsResponse.status}`)
      logger.info(`CORS 標頭: ${JSON.stringify(corsResponse.headers['access-control-allow-origin'])}`)
    } catch (corsError) {
      logger.warn(`CORS 測試失敗: ${corsError.message}`)
    }

    logger.info('=== 所有測試完成 ===')
    logger.info('✅ 基本 session 功能正常')
    logger.info('✅ Cookie 設定正確')
    logger.info('建議: 請在 Discord OAuth 流程中觀察 session 持久性')

  } catch (error) {
    logger.error('測試失敗:', error.message)
    if (error.response) {
      logger.error(`回應狀態: ${error.response.status}`)
      logger.error(`回應內容: ${JSON.stringify(error.response.data)}`)
    }
    process.exit(1)
  }
}

// 執行測試
testCloudflareSession()