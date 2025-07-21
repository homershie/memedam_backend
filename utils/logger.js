function getTimestamp() {
  return new Date().toISOString()
}

export const logger = {
  info: (...args) => {
    console.info(`[INFO] [${getTimestamp()}]`, ...args)
  },
  warn: (...args) => {
    console.warn(`[WARN] [${getTimestamp()}]`, ...args)
  },
  error: (...args) => {
    console.error(`[ERROR] [${getTimestamp()}]`, ...args)
  },
}
