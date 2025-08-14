/**
 * Google Cloud Translation API v3 wrapper
 * 使用 OAuth2 access token 進行翻譯服務
 */
import { GoogleAuth } from 'google-auth-library'

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'memedam'
const LOCATION = process.env.GCP_TRANSLATE_LOCATION || 'global'

/**
 * 翻譯文字為英文
 * @param {string} text - 要翻譯的文字
 * @param {string} [sourceLanguage] - 來源語言代碼（可選，會自動偵測）
 * @returns {Promise<string>} 翻譯後的英文文字
 */
export async function translateToEnglish(text, sourceLanguage = null) {
  try {
    // 驗證輸入
    if (!text || typeof text !== 'string') {
      throw new Error('輸入的文字必須是非空字串')
    }

    // 如果已經是英文，直接返回
    if (sourceLanguage === 'en' || /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(text)) {
      return text
    }

    // 初始化 Google Auth
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-translation']
    })

    // 獲取 access token
    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()

    if (!accessToken.token) {
      throw new Error('無法獲取 Google Cloud access token')
    }

    // 準備翻譯請求
    const translateUrl = `https://translation.googleapis.com/v3/projects/${PROJECT_ID}/locations/${LOCATION}:translateText`
    
    const requestBody = {
      contents: [text],
      targetLanguageCode: 'en'
    }

    // 如果指定了來源語言，加入請求中
    if (sourceLanguage) {
      requestBody.sourceLanguageCode = sourceLanguage
    }

    // 發送翻譯請求
    const response = await fetch(translateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      // 設定 30 秒逾時
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google Translate API 錯誤 (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.translations || !result.translations[0]) {
      throw new Error('翻譯 API 返回了無效的結果')
    }

    return result.translations[0].translatedText || text

  } catch (error) {
    console.error('Google Translate 錯誤:', error.message)
    
    // 如果是逾時或網路錯誤，返回原文
    if (error.name === 'AbortError' || error.message.includes('fetch')) {
      console.warn('翻譯服務逾時或無法連接，返回原文')
      return text
    }
    
    // 對於其他錯誤，也返回原文以確保系統穩定性
    return text
  }
}

export default { translateToEnglish }