import pino from 'pino';

// 強制設置 UTF-8 編碼
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
  // 確保正確的編碼設置
  serializers: pino.stdSerializers,
  // 簡化配置，專注於解決編碼問題
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      // 禁用顏色避免 ANSI 碼問題，但保持可讀性
      colorize: false,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      // 使用多行格式提高可讀性
      singleLine: false,
      hideObject: false,
      // 確保消息格式簡潔
      messageFormat: '{msg}',
      // 同步輸出，確保正確的字符順序
      sync: true,
      // 禁用所有可能導致編碼問題的選項
      colorizeObjects: false,
      crlf: false,
      // 添加換行符確保格式正確
      append: true
    }
  } : {
    // 生產環境使用原生 JSON 格式
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
