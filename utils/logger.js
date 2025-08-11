import pino from 'pino';

// 根據環境決定是否使用 pretty 格式
const isDevelopment = process.env.NODE_ENV === 'development';

// 創建 pino logger 實例
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // 移除 pid/hostname 噪音
  timestamp: pino.stdTimeFunctions.isoTime,
  // 確保正確的編碼設置
  serializers: pino.stdSerializers,
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: process.stdout.isTTY, // 只在 TTY 環境啟用顏色
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      // 確保正確的編碼設置
      singleLine: false,
      hideObject: false,
      // 禁用可能導致問題的 ANSI 轉義碼
      colorizeObjects: false,
      // 確保正確處理 Unicode 字符
      messageFormat: '{msg}',
      // 避免額外的格式化可能導致的編碼問題
      sync: false
    }
  } : {
    // 生產環境使用簡單的 JSON 格式，避免編碼問題
    target: 'pino/file',
    options: {
      destination: 1, // stdout
      sync: false
    }
  }
});

// 設置全域 log 對象
globalThis.log = logger;

export { logger };
