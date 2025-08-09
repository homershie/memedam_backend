/**
 * MongoDB 注入防護中間件
 * 用於替代 express-mongo-sanitize，相容 Express 5
 */

/**
 * 清理物件中的 MongoDB 操作符
 * @param {any} obj - 要清理的物件
 * @param {boolean} replaceWith - 是否用替代字符取代，否則直接刪除
 * @param {string} replacement - 替代字符，預設為空字串
 * @returns {any} 清理後的物件
 */
function sanitizeObject(obj, replaceWith = false, replacement = '') {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    // 檢查字串是否包含 MongoDB 操作符模式
    if (obj.startsWith('$') || obj.includes('.')) {
      return replaceWith ? replacement : obj
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, replaceWith, replacement))
  }

  if (typeof obj === 'object') {
    const sanitized = {}
    for (const [key, value] of Object.entries(obj)) {
      // 檢查鍵名是否包含 MongoDB 操作符
      const isDangerous = key.startsWith('$') || key.includes('.')
      
      if (isDangerous) {
        if (replaceWith) {
          const sanitizedKey = key.replace(/\$/g, replacement).replace(/\./g, replacement)
          sanitized[sanitizedKey] = sanitizeObject(value, replaceWith, replacement)
        }
        // 如果不替代，則跳過這個鍵
      } else {
        sanitized[key] = sanitizeObject(value, replaceWith, replacement)
      }
    }
    return sanitized
  }

  return obj
}

/**
 * MongoDB 消毒中間件工廠函數
 * @param {Object} options - 配置選項
 * @param {boolean} options.replaceWith - 是否替代危險字符
 * @param {string} options.replacement - 替代字符
 * @param {boolean} options.onlyBody - 是否只處理 body
 * @returns {Function} Express 中間件函數
 */
function mongoSanitize(options = {}) {
  const {
    replaceWith = false,
    replacement = '',
    onlyBody = false
  } = options

  return (req, res, next) => {
    try {
      // 清理 req.body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, replaceWith, replacement)
      }

      if (!onlyBody) {
        // 清理 req.query（創建新的清理後物件）
        if (req.query && typeof req.query === 'object') {
          const sanitizedQuery = sanitizeObject(req.query, replaceWith, replacement)
          // 由於 Express 5 中 req.query 是只讀的，我們需要重新定義它
          Object.defineProperty(req, 'query', {
            value: sanitizedQuery,
            writable: true,
            configurable: true,
            enumerable: true
          })
        }

        // 清理 req.params
        if (req.params && typeof req.params === 'object') {
          req.params = sanitizeObject(req.params, replaceWith, replacement)
        }
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export default mongoSanitize
export { sanitizeObject }