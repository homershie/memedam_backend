#!/usr/bin/env node

// 跨平台生產環境啟動腳本
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 載入 .env 檔案
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

console.log('🚀 啟動生產環境...')

// 設置環境變數
process.env.NODE_ENV = 'production'

// 檢查必要的環境變數
if (!process.env.MONGO_PROD_URI) {
  console.error('❌ 錯誤: 未設置 MONGO_PROD_URI 環境變數')
  console.error('請在 .env 文件中設置 MONGO_PROD_URI')
  process.exit(1)
}

if (!process.env.SESSION_SECRET) {
  console.error('❌ 錯誤: 未設置 SESSION_SECRET 環境變數')
  process.exit(1)
}

if (!process.env.JWT_SECRET) {
  console.error('❌ 錯誤: 未設置 JWT_SECRET 環境變數')
  process.exit(1)
}

// 安全檢查
if (process.env.MONGO_PROD_URI.toLowerCase().includes('dev')) {
  console.error('❌ 安全警告: 生產環境檢測到開發資料庫連接！')
  console.error('請檢查 MONGO_PROD_URI 設置')
  process.exit(1)
}

if (process.env.MONGO_PROD_URI.toLowerCase().includes('test')) {
  console.error('❌ 安全警告: 生產環境檢測到測試資料庫連接！')
  console.error('請檢查 MONGO_PROD_URI 設置')
  process.exit(1)
}

// 啟動應用
console.log(`📊 使用生產資料庫: ${process.env.MONGO_PROD_URI}`)
console.log('🌍 環境: production')
console.log('🔧 啟動模式: 生產模式')

// 執行生產啟動
const child = spawn('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env },
})

child.on('error', (error) => {
  console.error('生產環境啟動失敗:', error)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code)
})
