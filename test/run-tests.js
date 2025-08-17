#!/usr/bin/env node

import { spawn } from 'child_process'
import { checkTestEnvironment } from './utils/test-config.js'

// 測試配置
const TEST_CONFIGS = {
  'rate-limit': {
    description: '速率限制測試',
    tests: [
      { name: '簡單速率限制測試', file: 'rate-limit-tests/simple-rate-limit-test.js' },
      { name: 'API 速率限制測試', file: 'rate-limit-tests/api-rate-limit-test.js' },
      { name: '基礎速率限制測試', file: 'rate-limit-tests/basic-rate-limit-test.js' },
      { name: '速率限制調試', file: 'rate-limit-tests/rate-limit-debug.js' },
      { name: '速率限制診斷', file: 'rate-limit-tests/rate-limit-diagnose.js' },
    ],
  },
  'report': {
    description: '檢舉系統測試',
    tests: [
      { name: '簡單檢舉系統測試', file: 'report-tests/report-system-simple-test.js' },
      { name: '完整檢舉系統測試', file: 'report-tests/report-system-comprehensive-test.js' },
    ],
  },
  'notification': {
    description: '通知系統測試',
    tests: [
      { name: '通知修復測試', file: 'notification-tests/notification-fix-test.js' },
      { name: 'API 通知測試', file: 'notification-tests/api-notification-test.js' },
      { name: '完整通知測試', file: 'notification-tests/comprehensive-notification-test.js' },
      { name: '端到端通知測試', file: 'notification-tests/end-to-end-notification-test.js' },
      { name: '通知增強測試', file: 'notification-tests/notification-enhancement.test.js' },
      { name: '通知設定測試', file: 'notification-tests/notification-settings-test.js' },
      { name: '通知系統測試', file: 'notification-tests/notification-system-test.js' },
      { name: '通知測試', file: 'notification-tests/notification-test.js' },
      { name: '通知調試', file: 'notification-tests/debug-notification.js' },
    ],
  },
  'api': {
    description: 'API 測試',
    tests: [
      { name: 'API 分頁測試', file: 'api-tests/api-pagination-test.js' },
      { name: '基礎 API 測試', file: 'api-tests/api-test.js' },
      { name: '電子郵件變更測試', file: 'api-tests/change-email-test.js' },
      { name: '熱門 API 測試', file: 'api-tests/hot-api-test.cjs' },
      { name: 'OAuth 綁定測試', file: 'api-tests/oauth-bind-test.js' },
      { name: '真實 API 測試', file: 'api-tests/real-api-test.js' },
      { name: '簡單 API 測試', file: 'api-tests/simple-api-test.js' },
      { name: '使用者 API 測試', file: 'api-tests/user-api-test.js' },
      { name: '使用者名稱 API 測試', file: 'api-tests/username-test.js' },
    ],
  },
  'db': {
    description: '資料庫測試',
    tests: [
      { name: '資料庫連線測試', file: 'db-tests/db-connection-test.js' },
      { name: '資料庫測試 (CJS)', file: 'db-tests/db-test.cjs' },
      { name: '資料庫測試 (CJS)', file: 'db-tests/db-test-cjs.js' },
      { name: '簡單資料庫測試', file: 'db-tests/simple-db-test.js' },
      { name: '簡單 MongoDB 測試', file: 'db-tests/simple-mongo-test.cjs' },
    ],
  },
  'debug': {
    description: '調試測試',
    tests: [
      { name: '型別轉換錯誤驗證', file: 'debug-tests/cast-error-verification.js' },
      { name: '電子郵件存在性檢查', file: 'debug-tests/check-email-existence.js' },
      { name: '排序調試', file: 'debug-tests/debug-sorting.js' },
      { name: '使用者刪除測試', file: 'debug-tests/delete-user.js' },
      { name: '最終排序驗證', file: 'debug-tests/final-sort-verification.cjs' },
      { name: '查詢結構測試', file: 'debug-tests/query-structure-test.js' },
      { name: '簡單型別轉換測試', file: 'debug-tests/simple-cast-test.js' },
      { name: '簡單電子郵件檢查', file: 'debug-tests/simple-email-check.js' },
      { name: '型別轉換錯誤修復測試', file: 'debug-tests/test-cast-error-fix.js' },
      { name: '排序修復驗證', file: 'debug-tests/verify-sort-fix.js' },
    ],
  },
  'email': {
    description: '電子郵件測試',
    tests: [
      { name: '日期型別轉換錯誤測試', file: 'email-tests/date-cast-error-test.js' },
      { name: '電子郵件測試', file: 'email-tests/email-test.js' },
      { name: '密碼重設測試', file: 'email-tests/password-reset-test.js' },
      { name: '簡單電子郵件測試', file: 'email-tests/simple-email-test.js' },
    ],
  },
  'frontend': {
    description: '前端整合測試',
    tests: [
      { name: '前端資料檢查', file: 'frontend-tests/check-frontend-data.cjs' },
      { name: '無限滾動檢查', file: 'frontend-tests/check-infinite-scroll.cjs' },
      { name: '迷因日期檢查', file: 'frontend-tests/check-meme-dates.cjs' },
      { name: '迷因檢查', file: 'frontend-tests/check-memes.cjs' },
    ],
  },
  'oauth': {
    description: 'OAuth 認證測試',
    tests: [
      { name: 'Cloudflare 會話測試', file: 'oauth-tests/cloudflare-session-test.js' },
      { name: 'Discord 電子郵件修復測試', file: 'oauth-tests/discord-email-fix-test.js' },
      { name: 'Discord OAuth 修復測試', file: 'oauth-tests/discord-oauth-fix-test.js' },
      { name: 'Discord OAuth 會話測試', file: 'oauth-tests/discord-oauth-session-test.js' },
      { name: 'OAuth 修復驗證', file: 'oauth-tests/oauth-fix-verification.js' },
      { name: '臨時儲存測試', file: 'oauth-tests/test-temp-store.js' },
    ],
  },
  'performance': {
    description: '效能測試',
    tests: [
      { name: '分析效能測試', file: 'performance-tests/analytics.test.js' },
      { name: '效能測試', file: 'performance-tests/performance.test.js' },
    ],
  },
  'recommendation': {
    description: '推薦系統測試',
    tests: [
      { name: '協同過濾測試', file: 'recommendation-tests/collaborativeFiltering.test.js' },
      { name: '內容基礎推薦測試', file: 'recommendation-tests/contentBasedRecommendation.test.js' },
      { name: '混合推薦測試', file: 'recommendation-tests/mixedRecommendation.test.js' },
      { name: '社交協同過濾測試', file: 'recommendation-tests/socialCollaborativeFiltering.test.js' },
      { name: '社交分數計算器測試', file: 'recommendation-tests/socialScoreCalculator.test.js' },
      { name: '推薦 API 測試', file: 'recommendation-tests/test-recommendation-api.cjs' },
    ],
  },
  'search-sort': {
    description: '搜尋和排序測試',
    tests: [
      { name: '進階搜尋測試', file: 'search-sort-tests/advancedSearch.test.js' },
      { name: '內容標籤協同分頁測試', file: 'search-sort-tests/content-tag-collaborative-pagination.test.js' },
      { name: '熱門最新分頁測試', file: 'search-sort-tests/hot-latest-pagination.test.js' },
      { name: '無限滾動測試', file: 'search-sort-tests/infiniteScroll.test.js' },
      { name: '簡單排序測試', file: 'search-sort-tests/simple-sort-test.js' },
      { name: '排序測試', file: 'search-sort-tests/sorting-test.js' },
    ],
  },
  'user-cleanup': {
    description: '使用者清理測試',
    tests: [
      { name: '密碼存在性測試', file: 'user-cleanup-tests/has-password-test.js' },
      { name: '密碼狀態 API 測試', file: 'user-cleanup-tests/test-password-status-api.js' },
      { name: '使用者清理測試', file: 'user-cleanup-tests/user-cleanup-test.js' },
    ],
  },
  'username': {
    description: '使用者名稱測試',
    tests: [
      { name: '使用者名稱優化測試', file: 'username-tests/username-optimization-test.js' },
    ],
  },
  'verification': {
    description: '驗證系統測試',
    tests: [
      { name: '註冊電子郵件測試', file: 'verification-tests/registration-email-test.js' },
      { name: '驗證系統測試', file: 'verification-tests/verification-system-test.js' },
    ],
  },
  'all': {
    description: '所有測試',
    tests: [
      { name: '簡單速率限制測試', file: 'rate-limit-tests/simple-rate-limit-test.js' },
      { name: '簡單檢舉系統測試', file: 'report-tests/report-system-simple-test.js' },
      { name: '通知修復測試', file: 'notification-tests/notification-fix-test.js' },
      { name: '簡單 API 測試', file: 'api-tests/simple-api-test.js' },
      { name: '資料庫連線測試', file: 'db-tests/db-connection-test.js' },
      { name: '簡單電子郵件測試', file: 'email-tests/simple-email-test.js' },
    ],
  },
}

// 顯示幫助信息
function showHelp() {
  console.log('🚀 迷因典後端測試執行器')
  console.log('')
  console.log('使用方法:')
  console.log('  node test/run-tests.js <測試類型>')
  console.log('')
  console.log('可用的測試類型:')
  Object.entries(TEST_CONFIGS).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(15)} - ${config.description}`)
  })
  console.log('')
  console.log('範例:')
  console.log('  node test/run-tests.js rate-limit')
  console.log('  node test/run-tests.js report')
  console.log('  node test/run-tests.js all')
}

// 執行單個測試
function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 執行測試: ${testFile}`)

    const child = spawn('node', [testFile], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 測試完成: ${testFile}`)
        resolve()
      } else {
        console.log(`❌ 測試失敗: ${testFile} (退出碼: ${code})`)
        reject(new Error(`測試失敗，退出碼: ${code}`))
      }
    })

    child.on('error', (error) => {
      console.log(`❌ 測試執行錯誤: ${testFile}`)
      console.error(error)
      reject(error)
    })
  })
}

// 執行測試組
async function runTestGroup(testType) {
  const config = TEST_CONFIGS[testType]
  if (!config) {
    console.log(`❌ 未知的測試類型: ${testType}`)
    showHelp()
    process.exit(1)
  }

  console.log(`\n🚀 開始執行 ${config.description}`)
  console.log(`📋 共 ${config.tests.length} 個測試`)

  const results = {
    passed: 0,
    failed: 0,
    errors: [],
  }

  for (const test of config.tests) {
    try {
      await runTest(`test/${test.file}`)
      results.passed++
    } catch (error) {
      results.failed++
      results.errors.push({
        test: test.name,
        error: error.message,
      })
    }
  }

  // 顯示結果摘要
  console.log('\n📊 測試結果摘要')
  console.log('=' * 50)
  console.log(`✅ 通過: ${results.passed}`)
  console.log(`❌ 失敗: ${results.failed}`)
  console.log(
    `📈 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`,
  )

  if (results.errors.length > 0) {
    console.log('\n❌ 失敗的測試:')
    results.errors.forEach(({ test, error }) => {
      console.log(`  - ${test}: ${error}`)
    })
  }

  return results
}

// 主函數
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp()
    return
  }

  const testType = args[0]

  try {
    // 檢查測試環境
    console.log('🔒 檢查測試環境...')
    checkTestEnvironment()

    // 執行測試
    const results = await runTestGroup(testType)

    // 根據結果設置退出碼
    if (results.failed > 0) {
      process.exit(1)
    } else {
      console.log('\n🎉 所有測試通過！')
    }
  } catch (error) {
    console.error('❌ 測試執行過程中發生錯誤:', error.message)
    process.exit(1)
  }
}

// 執行主函數
main().catch((error) => {
  console.error('❌ 程序執行失敗:', error)
  process.exit(1)
})
