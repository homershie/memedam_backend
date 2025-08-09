#!/usr/bin/env node

/**
 * 測試路徑腳本
 * 用於檢查 Render 環境中的路徑和檔案
 */

import { config } from 'dotenv'
import { logger } from '../utils/logger.js'

// 載入環境變數
config()

console.log('=== Render 環境路徑測試 ===')
console.log('當前工作目錄:', process.cwd())
console.log('__dirname:', __dirname)
console.log('__filename:', __filename)
console.log('Node.js 版本:', process.version)
console.log('平台:', process.platform)

// 檢查關鍵檔案是否存在
import fs from 'fs'
import path from 'path'

const filesToCheck = ['scripts/render-jobs.js', 'utils/logger.js', 'package.json', '.env']

console.log('\n=== 檔案檢查 ===')
filesToCheck.forEach((file) => {
  const fullPath = path.resolve(file)
  const exists = fs.existsSync(fullPath)
  console.log(`${exists ? '✅' : '❌'} ${file}: ${fullPath}`)
})

console.log('\n=== 環境變數檢查 ===')
const envVars = ['NODE_ENV', 'RENDER_API_KEY', 'RENDER_SERVICE_ID', 'MONGODB_URI']
envVars.forEach((varName) => {
  const value = process.env[varName]
  console.log(`${value ? '✅' : '❌'} ${varName}: ${value ? '已設置' : '未設置'}`)
})

console.log('\n=== 測試完成 ===')
