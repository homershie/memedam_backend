// 測試環境配置
export const TEST_CONFIG = {
  // 測試資料庫配置
  database: {
    // 測試資料庫連接字串（如果沒有設置，使用開發資料庫）
    uri: process.env.MONGODB_TEST_URI || process.env.MONGO_URI,
    // 測試資料庫名稱後綴
    nameSuffix: '_test',
  },

  // 安全檢查配置
  safety: {
    // 禁止在生產環境運行測試
    preventProduction: true,
    // 生產環境關鍵字
    productionKeywords: ['production', 'prod', 'live'],
    // 測試用戶名模式
    testUserPattern: /^testuser_/,
    // 測試郵箱模式
    testEmailPattern: /^test_.*@example\.com$/,
  },

  // 測試資料清理配置
  cleanup: {
    // 是否在測試後清理資料
    enabled: true,
    // 清理的集合
    collections: ['reports', 'test_memes', 'test_users'],
    // 保留的資料模式（不清理）
    preservePatterns: {
      users: { username: { $not: /^testuser_/ } },
      memes: { title: { $not: /^測試/ } },
    },
  },
}

// 環境安全檢查
export const checkTestEnvironment = () => {
  const { safety, database } = TEST_CONFIG

  if (safety.preventProduction) {
    const mongoUri = database.uri || ''
    const nodeEnv = process.env.NODE_ENV || 'development'

    // 檢查是否為生產環境
    const isProduction = safety.productionKeywords.some(
      (keyword) =>
        mongoUri.toLowerCase().includes(keyword) || nodeEnv.toLowerCase().includes(keyword),
    )

    if (isProduction) {
      throw new Error(`
❌ 安全警告：檢測到生產環境！
- 資料庫連接：${mongoUri}
- 環境變數：${nodeEnv}
- 為保護生產資料，測試已停止執行

請設置 MONGODB_TEST_URI 環境變數指向測試資料庫。
      `)
    }
  }

  console.log('🔒 測試環境檢查通過')
  console.log(`📊 資料庫：${database.uri}`)
  console.log(`🌍 環境：${process.env.NODE_ENV || 'development'}`)
}

// 生成測試用戶資料
export const generateTestUserData = () => {
  const timestamp = Date.now()
  return {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'password123456',
  }
}

// 檢查是否為測試資料
export const isTestData = (data, type) => {
  const { safety } = TEST_CONFIG

  switch (type) {
    case 'user':
      return safety.testUserPattern.test(data.username || data)
    case 'email':
      return safety.testEmailPattern.test(data.email || data)
    case 'meme':
      return (data.title || '').startsWith('測試')
    default:
      return false
  }
}

// 安全的資料清理
export const safeCleanup = async (models) => {
  const { cleanup } = TEST_CONFIG

  if (!cleanup.enabled) {
    console.log('🧹 資料清理已停用')
    return
  }

  console.log('🧹 開始安全清理測試資料...')

  try {
    // 只清理測試資料
    if (models.User) {
      const result = await models.User.deleteMany({
        username: { $regex: /^testuser_/ },
      })
      console.log(`已清理 ${result.deletedCount} 個測試用戶`)
    }

    if (models.Meme) {
      const result = await models.Meme.deleteMany({
        title: { $regex: /^測試/ },
      })
      console.log(`已清理 ${result.deletedCount} 個測試迷因`)
    }

    if (models.Report) {
      const result = await models.Report.deleteMany({})
      console.log(`已清理 ${result.deletedCount} 個測試檢舉`)
    }

    console.log('✅ 測試資料清理完成')
  } catch (error) {
    console.error('❌ 清理測試資料時發生錯誤:', error.message)
  }
}
