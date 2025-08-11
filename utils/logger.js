import pino from 'pino';

// 強制設置 UTF-8 編碼和語言環境
process.env.LANG = process.env.LANG || 'zh_TW.UTF-8';
process.env.LC_ALL = process.env.LC_ALL || 'zh_TW.UTF-8';
process.env.LC_CTYPE = process.env.LC_CTYPE || 'zh_TW.UTF-8';

// 強制設置標準輸出編碼
if (process.stdout.setEncoding) {
  process.stdout.setEncoding('utf8');
}
if (process.stderr.setEncoding) {
  process.stderr.setEncoding('utf8');
}

// 根據環境決定是否使用 pretty 格式
const isDevelopment = process.env.NODE_ENV === 'development';

// 創建 pino logger 實例
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // 移除 pid/hostname 噪音
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: pino.stdSerializers,
  // 簡化 transport 配置以避免編碼問題
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      // 最小化配置，避免編碼衝突
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: true,
      // 確保同步輸出
      sync: true
    }
  } : {
    // 生產環境直接輸出 JSON，不使用 pretty
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
