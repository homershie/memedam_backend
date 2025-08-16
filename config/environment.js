// 環境配置管理
const ENV_CONFIG = {
  development: {
    name: 'development',
    database: {
      uri: process.env.MONGO_DEV_URI,
      name: 'dev',
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      },
    },
    redis: {
      uri: process.env.REDIS_DEV_URI || 'redis://localhost:6379/0',
      prefix: 'dev:',
    },
    logging: {
      level: 'debug',
      enableConsole: true,
      enableFile: false,
    },
    security: {
      corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
      },
    },
    features: {
      enableDebugMode: true,
      enableTestEndpoints: true,
      enablePerformanceMonitoring: true,
    },
  },

  test: {
    name: 'test',
    database: {
      uri: process.env.MONGO_TEST_URI,
      name: 'test',
      options: {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 5000,
      },
    },
    redis: {
      uri: process.env.REDIS_TEST_URI || 'redis://localhost:6379/1',
      prefix: 'test:',
    },
    logging: {
      level: 'warn',
      enableConsole: false,
      enableFile: false,
    },
    security: {
      corsOrigins: ['http://localhost:3000'],
      rateLimit: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 1000, // higher limit for testing
      },
    },
    features: {
      enableDebugMode: false,
      enableTestEndpoints: true,
      enablePerformanceMonitoring: false,
    },
  },

  production: {
    name: 'production',
    database: {
      uri: process.env.MONGO_PROD_URI,
      name: 'prod',
      options: {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 15000,
        retryWrites: true,
        retryReads: true,
      },
    },
    redis: {
      uri: process.env.REDIS_PROD_URI || 'redis://localhost:6379/2',
      prefix: 'prod:',
    },
    logging: {
      level: 'info',
      enableConsole: false,
      enableFile: true,
    },
    security: {
      corsOrigins: ['https://memedam.com', 'https://www.memedam.com'],
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // stricter limit for production
      },
    },
    features: {
      enableDebugMode: false,
      enableTestEndpoints: false,
      enablePerformanceMonitoring: true,
    },
  },
}

// 獲取當前環境配置
const getCurrentEnvironment = () => {
  const env = process.env.NODE_ENV || 'development'
  const config = ENV_CONFIG[env]

  if (!config) {
    throw new Error(`未知的環境: ${env}`)
  }

  return config
}

// 環境驗證
const validateEnvironment = () => {
  const env = getCurrentEnvironment()
  const requiredVars = []

  // 根據環境檢查必要的環境變數
  switch (env.name) {
    case 'development':
      requiredVars.push('MONGO_DEV_URI')
      break
    case 'test':
      requiredVars.push('MONGO_TEST_URI')
      break
    case 'production':
      requiredVars.push('MONGO_PROD_URI', 'SESSION_SECRET', 'JWT_SECRET')
      break
  }

  const missingVars = requiredVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    throw new Error(`缺少必要的環境變數: ${missingVars.join(', ')}`)
  }

  console.log(`✅ 環境驗證通過: ${env.name}`)
  return true
}

// 安全檢查
const performSecurityCheck = () => {
  const env = getCurrentEnvironment()

  // 檢查是否在生產環境使用開發配置
  if (env.name === 'production') {
    const devPatterns = ['dev', 'test', 'localhost', '127.0.0.1']
    const dbUri = env.database.uri || ''

    const hasDevPattern = devPatterns.some((pattern) => dbUri.toLowerCase().includes(pattern))

    if (hasDevPattern) {
      throw new Error('❌ 安全警告：生產環境檢測到開發資料庫連接！')
    }
  }

  // 檢查測試環境是否連接到生產資料庫
  if (env.name === 'test') {
    const prodPatterns = ['prod', 'production']
    const dbUri = env.database.uri || ''

    const hasProdPattern = prodPatterns.some((pattern) => dbUri.toLowerCase().includes(pattern))

    if (hasProdPattern) {
      throw new Error('❌ 安全警告：測試環境檢測到生產資料庫連接！')
    }
  }

  console.log(`🔒 安全檢查通過: ${env.name}`)
  return true
}

// 導出配置
export { ENV_CONFIG, getCurrentEnvironment, validateEnvironment, performSecurityCheck }

// 預設導出當前環境配置
export default getCurrentEnvironment()
