#!/usr/bin/env node

/**
 * Facebook OAuth 配置診斷腳本
 * 用於檢查生產環境的 Facebook OAuth 配置是否正確
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { logger } from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 載入環境變數
dotenv.config({ path: join(__dirname, '..', '.env') })

console.log('🔍 Facebook OAuth 配置診斷開始...\n')

// 檢查必要的環境變數
const requiredEnvVars = [
  'FACEBOOK_CLIENT_ID',
  'FACEBOOK_CLIENT_SECRET',
  'FACEBOOK_BIND_REDIRECT_URI',
]

const optionalEnvVars = ['FACEBOOK_REDIRECT_URI', 'NODE_ENV', 'FRONTEND_URL']

console.log('📋 必要環境變數檢查:')
let allRequiredVarsPresent = true

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar]
  const isPresent = !!value
  const status = isPresent ? '✅' : '❌'
  const valuePreview = isPresent ? `${value.substring(0, 10)}...` : '未設定'

  console.log(`  ${status} ${envVar}: ${valuePreview}`)

  if (!isPresent) {
    allRequiredVarsPresent = false
  }
}

console.log('\n📋 可選環境變數檢查:')
for (const envVar of optionalEnvVars) {
  const value = process.env[envVar]
  const isPresent = !!value
  const status = isPresent ? '✅' : '⚠️'
  const valuePreview = isPresent ? value : '未設定'

  console.log(`  ${status} ${envVar}: ${valuePreview}`)
}

console.log('\n🔧 配置驗證:')

// 檢查 Facebook App ID 格式
const facebookClientId = process.env.FACEBOOK_CLIENT_ID
if (facebookClientId) {
  const isValidFormat = /^\d+$/.test(facebookClientId)
  console.log(
    `  ${isValidFormat ? '✅' : '❌'} Facebook App ID 格式: ${isValidFormat ? '正確' : '錯誤'} (應為純數字)`,
  )
}

// 檢查 Facebook App Secret 格式
const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET
if (facebookClientSecret) {
  const isValidFormat = /^[a-f0-9]{32}$/i.test(facebookClientSecret)
  console.log(
    `  ${isValidFormat ? '✅' : '❌'} Facebook App Secret 格式: ${isValidFormat ? '正確' : '錯誤'} (應為32位十六進制)`,
  )
}

// 檢查回調 URI 格式
const bindRedirectUri = process.env.FACEBOOK_BIND_REDIRECT_URI
if (bindRedirectUri) {
  const isValidUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(bindRedirectUri)
  const isHttps = bindRedirectUri.startsWith('https://')
  const hasCorrectPath = bindRedirectUri.includes('/api/users/bind-auth/facebook/callback')

  console.log(`  ${isValidUrl ? '✅' : '❌'} 回調 URI 格式: ${isValidUrl ? '正確' : '錯誤'}`)
  console.log(`  ${isHttps ? '✅' : '❌'} HTTPS 協議: ${isHttps ? '是' : '否'}`)
  console.log(`  ${hasCorrectPath ? '✅' : '❌'} 路徑正確: ${hasCorrectPath ? '是' : '否'}`)
}

// 檢查環境配置
console.log('\n🌍 環境配置:')
console.log(`  NODE_ENV: ${process.env.NODE_ENV || '未設定'}`)
console.log(`  FRONTEND_URL: ${process.env.FRONTEND_URL || '未設定'}`)

// 檢查資料庫連接
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

// 總結
console.log('\n📊 診斷總結:')
if (allRequiredVarsPresent) {
  console.log('  ✅ 所有必要環境變數都已設定')
} else {
  console.log('  ❌ 缺少必要的環境變數')
}

// 建議
console.log('\n💡 建議:')
if (!allRequiredVarsPresent) {
  console.log('  1. 檢查 .env 檔案是否包含所有必要的 Facebook OAuth 配置')
  console.log('  2. 確認 Facebook App 的設定是否正確')
  console.log('  3. 驗證回調 URI 是否與 Facebook App 設定一致')
}

if (process.env.NODE_ENV === 'production') {
  console.log('  4. 生產環境建議使用 HTTPS 回調 URI')
  console.log('  5. 檢查 Facebook App 的域名設定是否包含您的生產域名')
}

console.log('\n🔍 診斷完成!')
