#!/usr/bin/env node

// 跨平台測試環境啟動腳本
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 強制設置 UTF-8 編碼和繁體中文語言環境
process.stdout.setEncoding('utf8')
process.stderr.setEncoding('utf8')
process.env.LANG = process.env.LANG || 'zh_TW.UTF-8'
process.env.LC_ALL = process.env.LC_ALL || 'zh_TW.UTF-8'
process.env.LC_CTYPE = process.env.LC_CTYPE || 'zh_TW.UTF-8'

// 載入 .env 檔案
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

console.log('🧪 啟動測試環境...')

// 設置環境變數
process.env.NODE_ENV = 'test'

// 檢查必要的環境變數
if (!process.env.MONGO_TEST_URI) {
  console.error('❌ 錯誤: 未設置 MONGO_TEST_URI 環境變數')
  console.error('請在 .env 文件中設置 MONGO_TEST_URI')
  process.exit(1)
}

// 安全檢查
if (process.env.MONGO_TEST_URI.toLowerCase().includes('prod')) {
  console.error('❌ 安全警告: 測試環境檢測到生產資料庫連接！')
  console.error('請檢查 MONGO_TEST_URI 設置')
  process.exit(1)
}

// 啟動測試
console.log(`📊 使用測試資料庫: ${process.env.MONGO_TEST_URI}`)
console.log('🌍 環境: test')
console.log('🔧 啟動模式: 測試模式')

// 執行測試
const child = spawn('npm', ['test'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
  env: {
    ...process.env,
    // 確保子進程也使用正確的編碼
    LANG: 'zh_TW.UTF-8',
    LC_ALL: 'zh_TW.UTF-8',
    LC_CTYPE: 'zh_TW.UTF-8',
  },
})

child.on('error', (error) => {
  console.error('測試啟動失敗:', error)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code)
})
