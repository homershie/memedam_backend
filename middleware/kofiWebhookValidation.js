import integratedCache from '../config/cache.js'
import { logger } from '../utils/logger.js'

// Ko-fi 驗證 token（從環境變數取得，支援動態更新）
const getKofiVerificationToken = () => {
  // 在測試環境中，如果沒有設置token，使用預設測試token
  if (process.env.NODE_ENV === 'test' && !process.env.KOFI_VERIFICATION_TOKEN) {
    return 'test_token'
  }
  return process.env.KOFI_VERIFICATION_TOKEN || 'fallback_token'
}

// Ko-fi 允許的 IP 範圍（根據 Ko-fi 官方文檔）
const KOFI_ALLOWED_IPS = [
  '172.16.31.10', // Ko-fi IP 範圍範例
  '172.16.31.10',
  '192.168.3.11',
  '172.16.17.32',
  '192.168.127.12',
  '192.168.127.12',
  '192.168.3.11',
  '192.168.3.11',
  '192.168.3.11',
  '192.168.3.11',
]

// 支援的商品代碼對應贊助等級（根據已建立的商品）
const SUPPORTED_PRODUCTS = {
  c4043b71a4: { level: 'soy', amount: 1 }, // 豆漿贊助 (1 USD)
  b7e4575bf6: { level: 'chicken', amount: 2 }, // 雞肉贊助 (2 USD)
  '25678099a7': { level: 'coffee', amount: 5 }, // 咖啡贊助 (5 USD)
}

/**
 * 驗證 Ko-fi Webhook 請求
 * @param {Object} req - Express 請求物件
 * @param {Object} res - Express 回應物件
 * @param {Function} next - 下一個中間件函數
 */
export const validateKofiWebhook = async (req, res, next) => {
  try {
    const { verification_token, message_id, direct_link_code, kofi_transaction_id, type } = req.body

    // 1. 驗證請求類型
    if (type !== 'Shop Order') {
      logger.warn('Ko-fi Webhook: 不支援的請求類型', { type })
      return res.status(400).json({
        success: false,
        error: '不支援的請求類型，僅支援 Shop Order',
      })
    }

    // 2. 驗證驗證令牌
    const expectedToken = getKofiVerificationToken()
    if (!verification_token || verification_token !== expectedToken) {
      logger.warn('Ko-fi Webhook: 驗證令牌無效', {
        received_token: verification_token?.substring(0, 10) + '...',
        expected_token: expectedToken?.substring(0, 10) + '...',
        node_env: process.env.NODE_ENV,
      })
      return res.status(401).json({
        success: false,
        error: '驗證令牌無效',
      })
    }

    // 3. 驗證請求來源 IP（生產環境和測試環境都啟用，但測試環境使用寬鬆檢查）
    const clientIP = getClientIP(req)
    const isAllowedIP = KOFI_ALLOWED_IPS.includes(clientIP)

    // 在生產環境或測試環境中，如果IP不允許則記錄警告但不阻擋（測試環境允許本地IP）
    if (process.env.NODE_ENV === 'production' && !isAllowedIP) {
      logger.warn('Ko-fi Webhook: 來自不允許的 IP 位址', {
        clientIP,
        allowedIPs: KOFI_ALLOWED_IPS,
      })
      return res.status(403).json({
        success: false,
        error: '來自不允許的來源 IP',
      })
    }

    // 在測試環境中，只記錄IP資訊，不阻擋請求
    if (process.env.NODE_ENV === 'test') {
      logger.info('Ko-fi Webhook: 測試環境IP檢查', {
        clientIP,
        isAllowedIP,
        note: '測試環境允許所有IP',
      })
    }

    // 4. 檢查重複處理（使用 message_id）
    if (message_id && process.env.NODE_ENV !== 'test') {
      try {
        const processedKey = `kofi:processed:${message_id}`
        const isProcessed = await integratedCache.get(processedKey)

        if (isProcessed) {
          logger.info('Ko-fi Webhook: 訊息已處理，跳過重複處理', { message_id })
          return res.status(200).json({
            success: true,
            message: '訊息已處理',
            message_id,
          })
        }

        // 標記為已處理（快取 24 小時）
        await integratedCache.set(processedKey, '1', 86400)
      } catch (cacheError) {
        logger.warn('Ko-fi Webhook: 快取操作失敗，但繼續處理', {
          message_id,
          error: cacheError.message,
          note: '測試環境可能沒有完整配置快取',
        })
        // 在測試環境中，如果快取失敗，我們繼續處理而不是阻擋
      }
    } else if (message_id && process.env.NODE_ENV === 'test') {
      // 在測試環境中，使用簡單的記憶體快取來模擬重複檢查
      const processedKey = `kofi:processed:${message_id}`
      if (global.testProcessedMessages && global.testProcessedMessages[processedKey]) {
        logger.info('Ko-fi Webhook: 測試環境 - 訊息已處理，跳過重複處理', { message_id })
        return res.status(200).json({
          success: true,
          message: '訊息已處理',
          message_id,
        })
      }

      // 初始化測試用的記憶體快取
      if (!global.testProcessedMessages) {
        global.testProcessedMessages = {}
      }
      global.testProcessedMessages[processedKey] = true
    }

    // 5. 驗證 direct_link_code
    if (!direct_link_code) {
      logger.warn('Ko-fi Webhook: 缺少商品代碼', { message_id })
      return res.status(400).json({
        success: false,
        error: '缺少商品代碼 (direct_link_code)',
      })
    }

    const productInfo = SUPPORTED_PRODUCTS[direct_link_code.toLowerCase()]
    if (!productInfo) {
      logger.warn('Ko-fi Webhook: 不支援的商品代碼', {
        direct_link_code,
        message_id,
        supported_products: Object.keys(SUPPORTED_PRODUCTS),
      })
      return res.status(400).json({
        success: false,
        error: `不支援的商品代碼: ${direct_link_code}`,
        supported_products: Object.keys(SUPPORTED_PRODUCTS),
      })
    }

    // 6. 驗證必要參數
    const requiredFields = ['kofi_transaction_id', 'from_name', 'amount', 'currency']

    const missingFields = requiredFields.filter((field) => !req.body[field])
    if (missingFields.length > 0) {
      logger.warn('Ko-fi Webhook: 缺少必要參數', {
        missingFields,
        message_id,
      })
      return res.status(400).json({
        success: false,
        error: `缺少必要參數: ${missingFields.join(', ')}`,
      })
    }

    // 7. 驗證金額格式
    if (isNaN(req.body.amount) || req.body.amount <= 0) {
      logger.warn('Ko-fi Webhook: 無效的金額', {
        amount: req.body.amount,
        message_id,
      })
      return res.status(400).json({
        success: false,
        error: '無效的金額',
      })
    }

    // 將解析出的商品資訊添加到請求物件
    req.kofiData = {
      productInfo,
      clientIP,
      message_id,
      kofi_transaction_id,
      direct_link_code: direct_link_code.toUpperCase(),
    }

    logger.info('Ko-fi Webhook 驗證通過', {
      message_id,
      kofi_transaction_id,
      direct_link_code,
      product_level: productInfo.level,
      amount: req.body.amount,
      clientIP,
    })

    next()
  } catch (error) {
    logger.error('Ko-fi Webhook 驗證失敗:', error)
    return res.status(500).json({
      success: false,
      error: '驗證過程發生錯誤',
    })
  }
}

/**
 * 取得用戶端真實 IP 位址
 * @param {Object} req - Express 請求物件
 * @returns {string} 客戶端 IP 位址
 */
function getClientIP(req) {
  // 優先檢查 X-Forwarded-For（代理伺服器）
  const xForwardedFor = req.headers['x-forwarded-for']
  if (xForwardedFor) {
    // X-Forwarded-For 可能包含多個 IP，取第一個
    return xForwardedFor.split(',')[0].trim()
  }

  // 檢查 X-Real-IP（某些代理使用）
  const xRealIP = req.headers['x-real-ip']
  if (xRealIP) {
    return xRealIP
  }

  // 檢查 CF-Connecting-IP（Cloudflare）
  const cfConnectingIP = req.headers['cf-connecting-ip']
  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // 最後回退到 req.ip 或 req.connection.remoteAddress
  return req.ip || req.connection?.remoteAddress || 'unknown'
}

/**
 * 檢查商品代碼是否支援
 * @param {string} directLinkCode - 商品代碼
 * @returns {Object|null} 商品資訊或 null
 */
export const getProductInfo = (directLinkCode) => {
  return SUPPORTED_PRODUCTS[directLinkCode?.toUpperCase()] || null
}

/**
 * 清除重複處理標記（用於測試或錯誤恢復）
 * @param {string} messageId - 訊息 ID
 */
export const clearProcessedMessage = async (messageId) => {
  if (messageId) {
    const processedKey = `kofi:processed:${messageId}`
    await integratedCache.del(processedKey)
    logger.info('清除 Ko-fi 訊息處理標記', { messageId })
  }
}
