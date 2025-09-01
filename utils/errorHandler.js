/**
 * 推薦系統錯誤處理工具
 * 統一處理推薦系統中的各種錯誤情況
 */

import { logger } from './logger.js'

/**
 * 處理批次處理錯誤
 * @param {Error} error - 錯誤物件
 * @param {Object} context - 錯誤上下文
 * @returns {Object} 錯誤處理結果
 */
export const handleBatchProcessingError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString(),
    ...context,
  }

  // 根據錯誤類型進行分類處理
  if (error.name === 'CastError') {
    logger.error('資料類型轉換錯誤:', errorInfo)
    return {
      type: 'cast_error',
      recoverable: false,
      message: '資料類型轉換失敗，需要檢查資料格式',
      details: errorInfo,
    }
  }

  if (error.name === 'ValidationError') {
    logger.error('資料驗證錯誤:', errorInfo)
    return {
      type: 'validation_error',
      recoverable: false,
      message: '資料驗證失敗，需要檢查資料完整性',
      details: errorInfo,
    }
  }

  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    logger.error('MongoDB 錯誤:', errorInfo)
    return {
      type: 'database_error',
      recoverable: error.code === 11000, // 重複鍵錯誤可恢復
      message: '資料庫操作失敗',
      details: errorInfo,
    }
  }

  if (error.name === 'TimeoutError') {
    logger.error('操作超時錯誤:', errorInfo)
    return {
      type: 'timeout_error',
      recoverable: true,
      message: '操作超時，建議重試',
      details: errorInfo,
    }
  }

  // 預設錯誤處理
  logger.error('未分類錯誤:', errorInfo)
  return {
    type: 'unknown_error',
    recoverable: false,
    message: '發生未知錯誤',
    details: errorInfo,
  }
}

/**
 * 處理查詢錯誤
 * @param {Error} error - 錯誤物件
 * @param {Object} query - 查詢條件
 * @returns {Object} 錯誤處理結果
 */
export const handleQueryError = (error, query = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    query: JSON.stringify(query, null, 2),
    timestamp: new Date().toISOString(),
  }

  if (error.name === 'CastError') {
    logger.error('查詢類型轉換錯誤:', {
      ...errorInfo,
      path: error.path,
      value: error.value,
      kind: error.kind,
    })

    return {
      type: 'query_cast_error',
      recoverable: false,
      message: `查詢欄位 ${error.path} 類型轉換失敗`,
      suggestion: '檢查查詢條件的資料類型是否正確',
      details: errorInfo,
    }
  }

  return handleBatchProcessingError(error, { query })
}

/**
 * 創建安全的查詢條件
 * @param {Object} query - 原始查詢條件
 * @returns {Object} 安全的查詢條件
 */
export const createSafeQuery = (query) => {
  try {
    // 深拷貝查詢條件，避免修改原始物件
    const safeQuery = JSON.parse(JSON.stringify(query))

    // 驗證查詢條件的結構
    if (typeof safeQuery !== 'object' || safeQuery === null) {
      throw new Error('查詢條件必須是物件')
    }

    return safeQuery
  } catch (error) {
    logger.error('創建安全查詢條件失敗:', {
      error: error.message,
      originalQuery: query,
    })

    // 返回安全的預設查詢
    return { status: { $ne: 'deleted' } }
  }
}

/**
 * 驗證 ObjectId 陣列
 * @param {Array} ids - ID 陣列
 * @param {string} fieldName - 欄位名稱
 * @returns {Array} 有效的 ObjectId 陣列
 */
export const validateObjectIdArray = (ids, fieldName = 'ids') => {
  if (!Array.isArray(ids)) {
    logger.warn(`${fieldName} 不是陣列:`, { ids, type: typeof ids })
    return []
  }

  const validIds = []
  const invalidIds = []

  for (const id of ids) {
    if (id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
      validIds.push(id)
    } else if (id && typeof id === 'object' && id._bsontype === 'ObjectID') {
      validIds.push(id.toString())
    } else {
      invalidIds.push(id)
    }
  }

  if (invalidIds.length > 0) {
    logger.warn(`發現無效的 ${fieldName}:`, { invalidIds, validCount: validIds.length })
  }

  return validIds
}

export default {
  handleBatchProcessingError,
  handleQueryError,
  createSafeQuery,
  validateObjectIdArray,
}
