import pino from 'pino'

// 強制設置 UTF-8 編碼和語言環境
process.env.LANG = process.env.LANG || 'zh_TW.UTF-8'
process.env.LC_ALL = process.env.LC_ALL || 'zh_TW.UTF-8'
process.env.LC_CTYPE = process.env.LC_CTYPE || 'zh_TW.UTF-8'

// 強制設置標準輸出編碼
if (process.stdout.setEncoding) {
  process.stdout.setEncoding('utf8')
}
if (process.stderr.setEncoding) {
  process.stderr.setEncoding('utf8')
}

// 檢查是否為本地開發環境（更寬鬆的判斷）
const isLocalDevelopment =
  process.env.NODE_ENV === 'development' ||
  !process.env.NODE_ENV || // 沒有設置 NODE_ENV
  process.env.PORT === '4000' || // 本地開發端口
  process.platform === 'darwin' || // macOS
  process.platform === 'win32' || // Windows
  (process.env.HOSTNAME && process.env.HOSTNAME.includes('localhost')) // localhost

// 創建 pino logger 實例
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // 移除 pid/hostname 噪音
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: pino.stdSerializers,
  transport: isLocalDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          // 最小化配置，避免編碼衝突
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: true,
          // 確保同步輸出
          sync: true,
          // 強制使用 UTF-8 編碼
          messageFormat: '{msg}',
        },
      }
    : {
        // 生產環境但如果是本地測試，使用改良的 JSON 格式
        target: 'pino/file',
        options: {
          destination: 1, // stdout
          sync: true, // 本地測試時使用同步輸出
          // 確保 UTF-8 編碼正確處理
          mkdir: false,
        },
      },
})

// 在非開發環境但是本地測試時，提供友善提示
if (!isLocalDevelopment && (process.platform === 'darwin' || process.platform === 'win32')) {
  console.log('💡 提示：如要在本地查看格式化的日誌，請設置 NODE_ENV=development')
}

// 設置全域 log 對象
globalThis.log = logger

export { logger }
