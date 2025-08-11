import User from '../models/User.js'

/**
 * 為社群登入用戶生成唯一的username
 * @param {Object} profile - 社群平台的用戶資料
 * @param {string} provider - 社群平台名稱 ('google', 'facebook', 'discord', 'twitter')
 * @returns {Promise<string>} 唯一的username
 */
export const generateUniqueUsername = async (profile, provider) => {
  // 1. 生成基礎username
  let baseUsername = generateBaseUsername(profile, provider)
  
  // 2. 格式化處理
  baseUsername = sanitizeUsername(baseUsername)
  
  // 3. 檢查是否重複並生成唯一username
  const uniqueUsername = await resolveUsernameConflict(baseUsername)
  
  return uniqueUsername
}

/**
 * 根據不同社群平台生成基礎username
 */
const generateBaseUsername = (profile, provider) => {
  switch (provider) {
    case 'google':
    case 'facebook':
      return profile.emails?.[0]?.value?.split('@')[0] || profile.id
    
    case 'discord':
      return profile.username || profile.id
    
    case 'twitter':
      return profile.username || profile.id
    
    case 'custom':
      // 用於已存在用戶的username變體生成
      return profile.username || profile.emails?.[0]?.value?.split('@')[0] || profile.id
    
    default:
      return profile.id || 'user'
  }
}

/**
 * 清理和格式化username
 */
const sanitizeUsername = (username) => {
  // 移除不符合規則的字符，只保留英文字母、數字、點號、底線和連字號
  let cleaned = username.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase()
  
  // 長度調整
  if (cleaned.length < 8) {
    // 如果長度不足8個字元，用數字填充
    cleaned = cleaned + '0'.repeat(8 - cleaned.length)
  } else if (cleaned.length > 20) {
    // 如果超過20個字元，截斷
    cleaned = cleaned.substring(0, 20)
  }
  
  return cleaned
}

/**
 * 解決username衝突的策略
 */
const resolveUsernameConflict = async (baseUsername) => {
  // 檢查原始username是否可用
  const existingUser = await User.findOne({ username: baseUsername })
  if (!existingUser) {
    return baseUsername
  }
  
  // 如果重複，使用多種策略生成唯一username
  const strategies = [
    () => addRandomSuffix(baseUsername),
    () => addShortRandomString(baseUsername),
    () => addNumericSuffix(baseUsername),
    () => generateRandomVariation(baseUsername)
  ]
  
  for (const strategy of strategies) {
    const candidates = Array.from({ length: 3 }, () => strategy())
    
    for (const candidate of candidates) {
      const exists = await User.findOne({ username: candidate })
      if (!exists) {
        return candidate
      }
    }
  }
  
  // 如果所有策略都失敗，使用時間戳保證唯一性
  return generateFallbackUsername(baseUsername)
}

/**
 * 策略1: 添加隨機2位數字後綴
 */
const addRandomSuffix = (username) => {
  const maxLength = 20
  const suffix = Math.floor(Math.random() * 99).toString().padStart(2, '0')
  
  if (username.length + suffix.length > maxLength) {
    username = username.substring(0, maxLength - suffix.length)
  }
  
  return username + suffix
}

/**
 * 策略2: 添加短隨機字符串
 */
const addShortRandomString = (username) => {
  const maxLength = 20
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const suffixLength = 3
  let suffix = ''
  
  for (let i = 0; i < suffixLength; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  if (username.length + suffix.length > maxLength) {
    username = username.substring(0, maxLength - suffix.length)
  }
  
  return username + suffix
}

/**
 * 策略3: 添加遞增數字後綴（原有邏輯的改進版）
 */
const addNumericSuffix = (username) => {
  const maxLength = 20
  const randomStart = Math.floor(Math.random() * 100) + 1 // 從隨機數字開始，避免從1開始的可預測性
  
  let counter = randomStart
  let candidate = username + counter.toString()
  
  while (candidate.length > maxLength) {
    const maxCounterLength = maxLength - username.length + counter.toString().length
    username = username.substring(0, maxLength - maxCounterLength)
    candidate = username + counter.toString()
  }
  
  return candidate
}

/**
 * 策略4: 生成隨機變體
 */
const generateRandomVariation = (username) => {
  const variations = [
    username.replace(/[aeiou]/g, ''), // 移除母音
    username.substring(0, 12) + '_' + Math.floor(Math.random() * 999), // 添加底線和數字
    username.split('').reverse().join(''), // 反轉
    username + '_' + ['user', 'mem', 'fan'].at(Math.floor(Math.random() * 3)) // 添加常用後綴
  ]
  
  const variation = variations[Math.floor(Math.random() * variations.length)]
  return sanitizeUsername(variation)
}

/**
 * 最後保底策略：使用時間戳
 */
const generateFallbackUsername = (username) => {
  const timestamp = Date.now().toString().slice(-6) // 取最後6位時間戳
  const maxUsernameLength = 20 - timestamp.length
  
  const truncatedUsername = username.substring(0, maxUsernameLength)
  return truncatedUsername + timestamp
}

/**
 * 為用戶提供username建議列表
 * @param {Object} profile - 社群平台的用戶資料
 * @param {string} provider - 社群平台名稱
 * @param {number} count - 建議數量，預設5個
 * @returns {Promise<string[]>} username建議列表
 */
export const generateUsernameSuggestions = async (profile, provider, count = 5) => {
  const baseUsername = sanitizeUsername(generateBaseUsername(profile, provider))
  const suggestions = new Set()
  
  // 添加基礎username（如果可用）
  const baseExists = await User.findOne({ username: baseUsername })
  if (!baseExists) {
    suggestions.add(baseUsername)
  }
  
  // 生成多個建議
  const strategies = [
    () => addRandomSuffix(baseUsername),
    () => addShortRandomString(baseUsername),
    () => addNumericSuffix(baseUsername),
    () => generateRandomVariation(baseUsername)
  ]
  
  while (suggestions.size < count) {
    for (const strategy of strategies) {
      if (suggestions.size >= count) break
      
      const candidate = strategy()
      const exists = await User.findOne({ username: candidate })
      
      if (!exists) {
        suggestions.add(candidate)
      }
    }
    
    // 防止無限循環
    if (suggestions.size === 0) {
      suggestions.add(generateFallbackUsername(baseUsername))
      break
    }
  }
  
  return Array.from(suggestions).slice(0, count)
}