// OAuth 綁定臨時狀態存儲
// 用於在彈出視窗 OAuth 流程中傳遞用戶狀態，避免依賴 express-session

import { logger } from './logger.js'

// 臨時存儲 OAuth 綁定狀態 (僅用於開發環境，生產環境應使用 Redis)
const tempOAuthBindStates = new Map()
const TEMP_STATE_EXPIRATION_MS = 5 * 60 * 1000 // 5 分鐘過期

// Twitter OAuth 1.0a 的 request token 暫存：token -> { tokenSecret, userId, timestamp }
const twitterRequestTokens = new Map()

// 清理過期狀態的函數
const cleanupExpiredStates = () => {
  const now = Date.now()
  let cleanedCount = 0
  let cleanedTwitter = 0

  for (const [key, value] of tempOAuthBindStates.entries()) {
    if (now - value.timestamp > TEMP_STATE_EXPIRATION_MS) {
      tempOAuthBindStates.delete(key)
      cleanedCount++
    }
  }

  for (const [key, value] of twitterRequestTokens.entries()) {
    if (now - value.timestamp > TEMP_STATE_EXPIRATION_MS) {
      twitterRequestTokens.delete(key)
      cleanedTwitter++
    }
  }

  if (cleanedCount > 0) logger.info(`🗑️ 清理了 ${cleanedCount} 個過期的 OAuth 綁定狀態`)
  if (cleanedTwitter > 0) logger.info(`🗑️ 清理了 ${cleanedTwitter} 個過期的 Twitter request token`)
}

// 每分鐘清理一次過期狀態
setInterval(cleanupExpiredStates, 60 * 1000)

// 存儲綁定狀態
export const storeBindState = (state, userId, provider) => {
  try {
    tempOAuthBindStates.set(state, {
      userId: userId.toString(),
      provider,
      timestamp: Date.now(),
    })

    logger.info('✅ OAuth 綁定狀態已存儲:', {
      state: state.substring(0, 10) + '...',
      userId,
      provider,
      totalStates: tempOAuthBindStates.size,
    })

    return true
  } catch (error) {
    logger.error('❌ 存儲 OAuth 綁定狀態失敗:', error)
    return false
  }
}

// 獲取綁定狀態
export const getBindState = (state) => {
  try {
    const storedState = tempOAuthBindStates.get(state)

    if (!storedState) {
      logger.warn('⚠️ 找不到 OAuth 綁定狀態:', state)
      return null
    }

    // 檢查是否過期
    if (Date.now() - storedState.timestamp > TEMP_STATE_EXPIRATION_MS) {
      tempOAuthBindStates.delete(state)
      logger.warn('⚠️ OAuth 綁定狀態已過期:', state)
      return null
    }

    logger.info('✅ 成功獲取 OAuth 綁定狀態:', {
      state: state.substring(0, 10) + '...',
      userId: storedState.userId,
      provider: storedState.provider,
    })

    return storedState
  } catch (error) {
    logger.error('❌ 獲取 OAuth 綁定狀態失敗:', error)
    return null
  }
}

// 刪除綁定狀態
export const removeBindState = (state) => {
  try {
    const existed = tempOAuthBindStates.has(state)
    tempOAuthBindStates.delete(state)

    if (existed) {
      logger.info('🗑️ 已刪除 OAuth 綁定狀態:', state.substring(0, 10) + '...')
    }

    return existed
  } catch (error) {
    logger.error('❌ 刪除 OAuth 綁定狀態失敗:', error)
    return false
  }
}

// 獲取統計資訊
export const getBindStateStats = () => {
  return {
    totalStates: tempOAuthBindStates.size,
    expirationMs: TEMP_STATE_EXPIRATION_MS,
    twitterTokens: twitterRequestTokens.size,
  }
}

// Twitter: 存儲 request token 與對應使用者
export const storeTwitterRequestToken = (token, tokenSecret, userId) => {
  try {
    twitterRequestTokens.set(token, {
      tokenSecret,
      userId: userId?.toString?.() || userId,
      timestamp: Date.now(),
    })
    logger.info('✅ 儲存 Twitter request token', {
      token: token.substring(0, 6) + '...',
    })
    return true
  } catch (error) {
    logger.error('❌ 儲存 Twitter request token 失敗:', error)
    return false
  }
}

export const getTwitterRequestToken = (token) => {
  try {
    const data = twitterRequestTokens.get(token)
    if (!data) {
      logger.warn('⚠️ 找不到 Twitter request token', token?.substring?.(0, 6) + '...')
      return null
    }
    // 檢查過期
    if (Date.now() - data.timestamp > TEMP_STATE_EXPIRATION_MS) {
      twitterRequestTokens.delete(token)
      logger.warn('⚠️ Twitter request token 已過期', token?.substring?.(0, 6) + '...')
      return null
    }
    return data
  } catch (error) {
    logger.error('❌ 讀取 Twitter request token 失敗:', error)
    return null
  }
}

export const removeTwitterRequestToken = (token) => {
  try {
    const existed = twitterRequestTokens.has(token)
    twitterRequestTokens.delete(token)
    if (existed) logger.info('🗑️ 刪除 Twitter request token', token?.substring?.(0, 6) + '...')
    return existed
  } catch (error) {
    logger.error('❌ 刪除 Twitter request token 失敗:', error)
    return false
  }
}

export { tempOAuthBindStates, TEMP_STATE_EXPIRATION_MS }
