#!/usr/bin/env node

/**
 * 測試 Facebook OAuth 策略初始化腳本
 * 用於驗證 Facebook OAuth 策略是否正確載入
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import passport from 'passport'
import { initializeOAuthStrategies } from '../config/passport.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 載入環境變數
dotenv.config({ path: join(__dirname, '..', '.env') })

console.log('🧪 Facebook OAuth 策略測試開始...\n')

// 檢查環境變數
console.log('📋 環境變數檢查:')
const requiredVars = {
  FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID,
  FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET,
  FACEBOOK_BIND_REDIRECT_URI: process.env.FACEBOOK_BIND_REDIRECT_URI,
}

for (const [key, value] of Object.entries(requiredVars)) {
  const isPresent = !!value
  const status = isPresent ? '✅' : '❌'
  const valuePreview = isPresent ? `${value.substring(0, 10)}...` : '未設定'

  console.log(`  ${status} ${key}: ${valuePreview}`)
}

// 初始化 OAuth 策略
console.log('\n🔧 初始化 OAuth 策略...')
try {
  initializeOAuthStrategies()
  console.log('  ✅ OAuth 策略初始化完成')
} catch (error) {
  console.log(`  ❌ OAuth 策略初始化失敗: ${error.message}`)
  process.exit(1)
}

// 檢查策略是否正確載入
console.log('\n📋 載入的策略檢查:')
const availableStrategies = Object.keys(passport._strategies)
console.log(`  可用策略數量: ${availableStrategies.length}`)

const facebookStrategies = availableStrategies.filter((name) => name.includes('facebook'))
console.log(`  Facebook 相關策略: ${facebookStrategies.length}`)

for (const strategy of facebookStrategies) {
  const isLoaded = !!passport._strategies[strategy]
  const status = isLoaded ? '✅' : '❌'
  console.log(`  ${status} ${strategy}: ${isLoaded ? '已載入' : '未載入'}`)
}

// 檢查特定策略
const requiredStrategies = ['facebook', 'facebook-bind']
console.log('\n📋 必要策略檢查:')
for (const strategy of requiredStrategies) {
  const isLoaded = !!passport._strategies[strategy]
  const status = isLoaded ? '✅' : '❌'
  console.log(`  ${status} ${strategy}: ${isLoaded ? '已載入' : '未載入'}`)

  if (isLoaded) {
    const strategyInstance = passport._strategies[strategy]
    console.log(`    - 策略類型: ${strategyInstance.constructor.name}`)
    console.log(`    - 策略名稱: ${strategyInstance.name}`)
  }
}

// 檢查策略配置
console.log('\n🔧 策略配置檢查:')
if (passport._strategies['facebook-bind']) {
  const facebookBindStrategy = passport._strategies['facebook-bind']
  console.log('  Facebook 綁定策略配置:')
  console.log(`    - Client ID: ${facebookBindStrategy._clientID ? '✅ 已設定' : '❌ 未設定'}`)
  console.log(
    `    - Client Secret: ${facebookBindStrategy._clientSecret ? '✅ 已設定' : '❌ 未設定'}`,
  )
  console.log(`    - Callback URL: ${facebookBindStrategy._callbackURL || '未設定'}`)

  if (facebookBindStrategy._callbackURL) {
    const isHttps = facebookBindStrategy._callbackURL.startsWith('https://')
    const hasCorrectPath = facebookBindStrategy._callbackURL.includes(
      '/api/users/bind-auth/facebook/callback',
    )

    console.log(`    - HTTPS: ${isHttps ? '✅ 是' : '❌ 否'}`)
    console.log(`    - 路徑正確: ${hasCorrectPath ? '✅ 是' : '❌ 否'}`)
  }
}

// 總結
console.log('\n📊 測試總結:')
const allStrategiesLoaded = requiredStrategies.every((strategy) => !!passport._strategies[strategy])
const allEnvVarsPresent = Object.values(requiredVars).every((value) => !!value)

if (allStrategiesLoaded && allEnvVarsPresent) {
  console.log('  ✅ 所有 Facebook OAuth 策略都已正確載入')
} else {
  console.log('  ❌ 存在問題:')
  if (!allEnvVarsPresent) {
    console.log('    - 缺少必要的環境變數')
  }
  if (!allStrategiesLoaded) {
    console.log('    - 部分策略未載入')
  }
}

console.log('\n🔍 測試完成!')

if (!allStrategiesLoaded || !allEnvVarsPresent) {
  console.log('\n💡 建議:')
  if (!allEnvVarsPresent) {
    console.log('  1. 檢查 .env 檔案是否包含所有必要的 Facebook OAuth 配置')
    console.log('  2. 確認環境變數名稱拼寫正確')
  }
  if (!allStrategiesLoaded) {
    console.log('  3. 檢查 passport.js 中的策略初始化邏輯')
    console.log('  4. 確認 Facebook OAuth 策略的條件檢查')
  }
  process.exit(1)
}
