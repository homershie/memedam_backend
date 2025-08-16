#!/usr/bin/env node

// 跨平台開發環境啟動腳本
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 載入 .env 檔案
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

console.log('🚀 啟動開發環境...')

// 設置環境變數
process.env.NODE_ENV = 'development'

// 檢查必要的環境變數
if (!process.env.MONGO_DEV_URI) {
  console.error('❌ 錯誤: 未設置 MONGO_DEV_URI 環境變數')
  console.error('請在 .env 文件中設置 MONGO_DEV_URI')
  process.exit(1)
}

// 啟動應用
console.log(`📊 使用開發資料庫: ${process.env.MONGO_DEV_URI}`)
console.log('🌍 環境: development')
console.log('🔧 啟動模式: 開發模式')

// 執行 npm run dev
const child = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env },
})

child.on('error', (error) => {
  console.error('啟動失敗:', error)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code)
})
