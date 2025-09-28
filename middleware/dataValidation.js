/**
 * 數據驗證中間件
 * 防止數據庫中出現類型錯誤的計數字段
 */

import mongoose from 'mongoose'

/**
 * 驗證計數字段的數據類型
 * @param {Object} data - 要驗證的數據物件
 * @param {Array} countFields - 計數字段名稱陣列
 * @returns {Object} 驗證結果
 */
const validateCountFields = (
  data,
  countFields = [
    'like_count',
    'dislike_count',
    'comment_count',
    'view_count',
    'collection_count',
    'share_count',
  ],
) => {
  const errors = []

  countFields.forEach((field) => {
    if (data[field] !== undefined) {
      const value = data[field]

      // 檢查是否為物件（這是主要問題）
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        errors.push({
          field,
          value: JSON.stringify(value),
          message: `${field} 不能是物件類型，應為數值`,
        })
        return
      }

      // 檢查是否為數值
      if (typeof value !== 'number') {
        errors.push({
          field,
          value: typeof value,
          message: `${field} 必須是數值類型`,
        })
        return
      }

      // 檢查是否為非負數
      if (value < 0) {
        errors.push({
          field,
          value,
          message: `${field} 不能為負數`,
        })
        return
      }

      // 檢查是否為整數（計數應該是整數）
      if (!Number.isInteger(value)) {
        errors.push({
          field,
          value,
          message: `${field} 應該是整數`,
        })
      }
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 清理計數字段中的錯誤值
 * @param {Object} data - 要清理的數據物件
 * @param {Array} countFields - 計數字段名稱陣列
 * @returns {Object} 清理後的數據
 */
const sanitizeCountFields = (
  data,
  countFields = [
    'like_count',
    'dislike_count',
    'comment_count',
    'view_count',
    'collection_count',
    'share_count',
  ],
) => {
  const sanitized = { ...data }

  countFields.forEach((field) => {
    if (sanitized[field] !== undefined) {
      const value = sanitized[field]

      // 如果是物件，嘗試從中提取數值
      if (typeof value === 'object' && value !== null) {
        if (typeof value.$numberInt === 'string') {
          sanitized[field] = parseInt(value.$numberInt, 10)
        } else if (typeof value.$numberLong === 'string') {
          sanitized[field] = parseInt(value.$numberLong, 10)
        } else {
          // 嘗試轉換為數值
          const numValue = Number(value)
          sanitized[field] = isNaN(numValue) ? 0 : Math.max(0, Math.floor(numValue))
        }
      } else if (typeof value === 'string') {
        // 如果是字串，嘗試轉換為數值
        const numValue = parseInt(value, 10)
        sanitized[field] = isNaN(numValue) ? 0 : Math.max(0, numValue)
      } else if (typeof value === 'number') {
        // 確保是非負整數
        sanitized[field] = Math.max(0, Math.floor(value))
      } else {
        // 其他類型設為0
        sanitized[field] = 0
      }
    }
  })

  return sanitized
}

/**
 * Mongoose pre-save 中間件，用於驗證和清理計數字段
 */
export const validateAndSanitizeCountFields = function (next) {
  const countFields = [
    'like_count',
    'dislike_count',
    'comment_count',
    'view_count',
    'collection_count',
    'share_count',
  ]

  // 驗證數據
  const validation = validateCountFields(this.toObject(), countFields)

  if (!validation.isValid) {
    const error = new Error('數據驗證失敗')
    error.validationErrors = validation.errors
    return next(error)
  }

  // 清理數據
  const sanitized = sanitizeCountFields(this.toObject(), countFields)

  // 應用清理後的值
  countFields.forEach((field) => {
    if (sanitized[field] !== undefined) {
      this[field] = sanitized[field]
    }
  })

  next()
}

/**
 * 數據驗證中間件（Express中間件）
 * @param {Array} countFields - 要驗證的計數字段
 */
export const countFieldValidationMiddleware = (
  countFields = [
    'like_count',
    'dislike_count',
    'comment_count',
    'view_count',
    'collection_count',
    'share_count',
  ],
) => {
  return (req, res, next) => {
    try {
      // 只驗證POST和PUT請求
      if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next()
      }

      // 獲取請求體數據
      const data = req.body || {}

      // 驗證計數字段
      const validation = validateCountFields(data, countFields)

      if (!validation.isValid) {
        return res.status(400).json({
          error: '數據驗證失敗',
          details: validation.errors,
        })
      }

      // 清理數據
      const sanitized = sanitizeCountFields(data, countFields)
      req.body = sanitized

      next()
    } catch (error) {
      console.error('數據驗證中間件錯誤:', error)
      next(error)
    }
  }
}

/**
 * 批量驗證多個文檔的計數字段
 * @param {Array} documents - 文檔陣列
 * @param {Array} countFields - 計數字段名稱陣列
 * @returns {Object} 驗證結果
 */
export const validateBatchCountFields = (
  documents,
  countFields = [
    'like_count',
    'dislike_count',
    'comment_count',
    'view_count',
    'collection_count',
    'share_count',
  ],
) => {
  const allErrors = []
  const validDocuments = []

  documents.forEach((doc, index) => {
    const validation = validateCountFields(doc, countFields)

    if (validation.isValid) {
      validDocuments.push(doc)
    } else {
      allErrors.push({
        index,
        errors: validation.errors,
      })
    }
  })

  return {
    isValid: allErrors.length === 0,
    validCount: validDocuments.length,
    errorCount: allErrors.length,
    errors: allErrors,
    validDocuments,
  }
}

export default {
  validateCountFields,
  sanitizeCountFields,
  validateAndSanitizeCountFields,
  countFieldValidationMiddleware,
  validateBatchCountFields,
}
