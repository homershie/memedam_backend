#!/usr/bin/env node

/**
 * Facebook OAuth 綁定問題診斷腳本
 * 用於排查生產環境的 Facebook OAuth 綁定失敗問題
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 載入環境變數
dotenv.config({ path: join(__dirname, '..', '.env') })

console.log('🔍 Facebook OAuth 綁定問題診斷開始...\n')

// 檢查基本環境配置
console.log('📋 基本環境配置:')
console.log(`  NODE_ENV: ${process.env.NODE_ENV || '未設定'}`)
console.log(`  PORT: ${process.env.PORT || '未設定'}`)
console.log(`  FRONTEND_URL: ${process.env.FRONTEND_URL || '未設定'}`)

// 檢查 Facebook OAuth 配置
console.log('\n📋 Facebook OAuth 配置:')
const facebookConfig = {
  clientId: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  bindRedirectUri: process.env.FACEBOOK_BIND_REDIRECT_URI,
  redirectUri: process.env.FACEBOOK_REDIRECT_URI,
}

for (const [key, value] of Object.entries(facebookConfig)) {
  const isPresent = !!value
  const status = isPresent ? '✅' : '❌'
  const valuePreview = isPresent ? `${value.substring(0, 10)}...` : '未設定'

  console.log(`  ${status} ${key}: ${valuePreview}`)
}

// 檢查資料庫配置
console.log('\n🗄️ 資料庫配置:')
const mongoUri = process.env.MONGO_URI || process.env.MONGO_PROD_URI
if (mongoUri) {
  const isProduction =
    mongoUri.includes('memedam') && !mongoUri.includes('dev') && !mongoUri.includes('test')
  console.log(`  MongoDB URI: ${mongoUri.substring(0, 30)}...`)
  console.log(`  生產環境: ${isProduction ? '✅' : '⚠️'}`)
} else {
  console.log('  ❌ MongoDB URI 未設定')
}

// 檢查 Redis 配置
console.log('\n🔴 Redis 配置:')
const redisEnabled = process.env.REDIS_ENABLED === 'true'
const redisUrl = process.env.REDIS_URL
console.log(`  Redis 啟用: ${redisEnabled ? '✅' : '❌'}`)
if (redisUrl) {
  console.log(`  Redis URL: ${redisUrl.substring(0, 30)}...`)
} else {
  console.log('  Redis URL: 未設定')
}

// 檢查 Session 配置
console.log('\n🍪 Session 配置:')
const sessionSecret = process.env.SESSION_SECRET
console.log(`  Session Secret: ${sessionSecret ? '✅ 已設定' : '❌ 未設定'}`)
if (sessionSecret) {
  console.log(`  Secret 長度: ${sessionSecret.length} 字符`)
}

// 檢查 JWT 配置
console.log('\n🔑 JWT 配置:')
const jwtSecret = process.env.JWT_SECRET
const jwtExpiresIn = process.env.JWT_EXPIRES_IN
console.log(`  JWT Secret: ${jwtSecret ? '✅ 已設定' : '❌ 未設定'}`)
console.log(`  JWT 過期時間: ${jwtExpiresIn || '未設定'}`)

// 測試 crypto 功能
console.log('\n🔐 Crypto 功能測試:')
try {
  const testState = crypto.randomBytes(32).toString('hex')
  console.log(`  ✅ 生成 state 參數: ${testState.substring(0, 10)}...`)
  console.log(`  State 長度: ${testState.length} 字符`)
} catch (error) {
  console.log(`  ❌ Crypto 功能失敗: ${error.message}`)
}

// 檢查 CORS 配置
console.log('\n🌐 CORS 配置:')
const corsOrigin = process.env.CORS_ORIGIN
console.log(`  CORS Origin: ${corsOrigin || '未設定'}`)

// 檢查 Facebook App 配置
console.log('\n📱 Facebook App 配置驗證:')
if (facebookConfig.clientId && facebookConfig.clientSecret) {
  const clientIdValid = /^\d+$/.test(facebookConfig.clientId)
  const clientSecretValid = /^[a-f0-9]{32}$/i.test(facebookConfig.clientSecret)

  console.log(`  App ID 格式: ${clientIdValid ? '✅ 正確' : '❌ 錯誤'} (應為純數字)`)
  console.log(`  App Secret 格式: ${clientSecretValid ? '✅ 正確' : '❌ 錯誤'} (應為32位十六進制)`)

  if (facebookConfig.bindRedirectUri) {
    const isValidUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(facebookConfig.bindRedirectUri)
    const isHttps = facebookConfig.bindRedirectUri.startsWith('https://')
    const hasCorrectPath = facebookConfig.bindRedirectUri.includes(
      '/api/users/bind-auth/facebook/callback',
    )

    console.log(`  回調 URI 格式: ${isValidUrl ? '✅ 正確' : '❌ 錯誤'}`)
    console.log(`  HTTPS 協議: ${isHttps ? '✅ 是' : '❌ 否'}`)
    console.log(`  路徑正確: ${hasCorrectPath ? '✅ 是' : '❌ 否'}`)
  }
}

// 檢查網路配置
console.log('\n🌍 網路配置:')
const frontendUrl = process.env.FRONTEND_URL
if (frontendUrl) {
  const isHttps = frontendUrl.startsWith('https://')
  const isProduction = process.env.NODE_ENV === 'production'

  console.log(`  前端 URL: ${frontendUrl}`)
  console.log(`  HTTPS: ${isHttps ? '✅ 是' : '❌ 否'}`)
  console.log(`  生產環境: ${isProduction ? '✅ 是' : '❌ 否'}`)

  if (isProduction && !isHttps) {
    console.log('  ⚠️ 警告: 生產環境建議使用 HTTPS')
  }
}

// 總結和建議
console.log('\n📊 診斷總結:')
const requiredVars = ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'FACEBOOK_BIND_REDIRECT_URI']
const missingVars = requiredVars.filter((varName) => !process.env[varName])

if (missingVars.length === 0) {
  console.log('  ✅ 所有必要的 Facebook OAuth 環境變數都已設定')
} else {
  console.log(`  ❌ 缺少必要的環境變數: ${missingVars.join(', ')}`)
}

// 建議
console.log('\n💡 建議:')
if (missingVars.length > 0) {
  console.log('  1. 檢查 .env 檔案是否包含所有必要的 Facebook OAuth 配置')
  console.log('  2. 確認環境變數名稱拼寫正確')
}

if (process.env.NODE_ENV === 'production') {
  console.log('  3. 生產環境建議使用 HTTPS 回調 URI')
  console.log('  4. 檢查 Facebook App 的域名設定是否包含您的生產域名')
  console.log('  5. 確認 Facebook App 的狀態是否為活躍狀態')
}

console.log('  6. 檢查伺服器日誌中的詳細錯誤信息')
console.log('  7. 確認資料庫連接正常')
console.log('  8. 驗證 Redis 連接（如果啟用）')

console.log('\n🔍 診斷完成!')
console.log('\n📝 如果問題持續存在，請檢查:')
console.log('  - 伺服器錯誤日誌')
console.log('  - Facebook App 設定')
console.log('  - 網路連接和防火牆設定')
console.log('  - 資料庫和 Redis 連接狀態')
