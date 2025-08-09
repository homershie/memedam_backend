import pino from 'pino';

// 根據環境決定是否使用 pretty 格式
const isDevelopment = process.env.NODE_ENV === 'development';

// 創建 pino logger 實例
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // 移除 pid/hostname 噪音
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// 設置全域 log 對象
globalThis.log = logger;

export { logger };
