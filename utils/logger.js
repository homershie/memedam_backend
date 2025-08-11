import pino from 'pino';

// 強制設置 UTF-8 編碼
if (process.stdout.setEncoding) {
  process.stdout.setEncoding('utf8');
}
if (process.stderr.setEncoding) {
  process.stderr.setEncoding('utf8');
}

// 檢查是否為本地開發環境（更寬鬆的判斷）
const isLocalDevelopment = process.env.NODE_ENV === 'development' || 
                          !process.env.NODE_ENV || // 沒有設置 NODE_ENV
                          process.env.PORT === '4000' || // 本地開發端口
                          process.platform === 'darwin' || // macOS
                          process.platform === 'win32' || // Windows  
                          (process.env.HOSTNAME && process.env.HOSTNAME.includes('localhost')); // localhost

// 創建 pino logger 實例
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // 移除 pid/hostname 噪音
  timestamp: pino.stdTimeFunctions.isoTime,
  // 確保正確的編碼設置
  serializers: pino.stdSerializers,
  // 改善配置以支持本地開發
  transport: isLocalDevelopment ? {
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
    // 生產環境但如果是本地測試，使用改良的 JSON 格式
    target: 'pino/file',
    options: {
      destination: 1, // stdout
      sync: true, // 本地測試時使用同步輸出
      // 確保 UTF-8 編碼正確處理
      mkdir: false
    }
  }
});

// 在非開發環境但是本地測試時，提供友善提示
if (!isLocalDevelopment && (process.platform === 'darwin' || process.platform === 'win32')) {
  console.log('💡 提示：如要在本地查看格式化的日誌，請設置 NODE_ENV=development');
}

// 設置全域 log 對象
globalThis.log = logger;

export { logger };
