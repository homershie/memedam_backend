import { beforeAll, afterAll, vi } from 'vitest'
import dotenv from 'dotenv'

// 載入環境變數
dotenv.config({ path: '.env.test' })

// 先 mock 掉會在載入時檢查雲端設定的模組，避免測試環境因未設 CLOUDINARY_* 失敗
vi.mock('../config/cloudinary.js', () => ({ default: {} }))

// Mock MongoDB 相關模組
vi.mock('mongoose', () => ({
  default: {
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue({}),
    connection: {
      readyState: 1,
      on: vi.fn(),
      once: vi.fn(),
    },
  },
}))

// Mock Redis 相關模組
vi.mock('../config/redis.js', () => ({
  default: {
    connect: vi.fn().mockResolvedValue({}),
    disconnect: vi.fn().mockResolvedValue({}),
    isEnabled: false,
    isConnected: false,
    client: null,
  },
}))

// Mock 郵件服務
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}))

// Mock 其他可能造成問題的模組
vi.mock('../utils/analyticsMonitor.js', () => ({
  performanceMonitor: {
    startMonitoring: vi.fn().mockResolvedValue({}),
    stopMonitoring: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../utils/maintenance.js', () => ({
  default: {
    startAllTasks: vi.fn(),
    stopAllTasks: vi.fn(),
  },
}))

vi.mock('../utils/notificationScheduler.js', () => ({
  startNotificationScheduler: vi.fn(),
  stopNotificationScheduler: vi.fn(),
}))

vi.mock('../utils/userCleanupScheduler.js', () => ({
  startUserCleanupScheduler: vi.fn(),
  stopUserCleanupScheduler: vi.fn(),
}))

vi.mock('../utils/recommendationScheduler.js', () => ({
  startRecommendationScheduler: vi.fn(),
  stopRecommendationScheduler: vi.fn(),
}))

// 測試環境配置
const TEST_CONFIG = {
  safety: {
    preventProduction: true,
    productionKeywords: ['production', 'prod', 'live'],
    testUserPattern: /^test_/,
    testEmailPattern: /^test_.*@example\.com$/,
  },
}

// 環境安全檢查
const checkTestEnvironment = () => {
  const { safety } = TEST_CONFIG

  if (safety.preventProduction) {
    const nodeEnv = process.env.NODE_ENV || 'development'

    // 檢查是否為生產環境
    const isProduction = safety.productionKeywords.some((keyword) =>
      nodeEnv.toLowerCase().includes(keyword),
    )

    if (isProduction) {
      throw new Error(`
❌ 安全警告：檢測到生產環境！
- 環境變數：${nodeEnv}
- 為保護生產資料，測試已停止執行

請確保 NODE_ENV 設置為 test。
      `)
    }
  }

  console.log('🔒 測試環境檢查通過')
  console.log(`🌍 環境：${process.env.NODE_ENV || 'development'}`)
}

// 執行環境檢查
checkTestEnvironment()

// 測試環境旗標，阻止應用自動啟動與重度背景任務
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.SKIP_SERVER = process.env.SKIP_SERVER || 'true'
process.env.REDIS_ENABLED = 'false'
process.env.SKIP_DB = 'true'

// 全局測試設置
beforeAll(async () => {
  console.log('✅ 簡化測試環境已設置')
  console.log('📋 環境變數:')
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`)
  console.log(`  SKIP_SERVER: ${process.env.SKIP_SERVER}`)
  console.log(`  REDIS_ENABLED: ${process.env.REDIS_ENABLED}`)
  console.log(`  SKIP_DB: ${process.env.SKIP_DB}`)
})

// 全局測試清理
afterAll(async () => {
  console.log('✅ 簡化測試環境已清理')
})
