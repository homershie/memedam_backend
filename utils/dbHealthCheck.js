/**
 * 資料庫連線健康檢查工具
 * 用於在執行重要操作前檢查資料庫連線狀態
 */

import mongoose from 'mongoose'
import { logger } from './logger.js'
import { getCurrentEnvironment } from '../config/environment.js'

/**
 * 檢查資料庫連線狀態
 * @returns {Promise<Object>} 連線狀態
 */
export const checkDatabaseConnection = async () => {
  try {
    const state = mongoose.connection.readyState

    // 連線狀態碼：
    // 0 = disconnected
    // 1 = connected
    // 2 = connecting
    // 3 = disconnecting

    const statusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    }

    const status = statusMap[state] || 'unknown'

    if (state === 1) {
      // 執行 ping 測試
      try {
        await mongoose.connection.db.admin().ping()
        logger.info('資料庫連線正常，ping 測試成功')
        return {
          success: true,
          status: 'connected',
          readyState: state,
          message: '資料庫連線正常',
        }
      } catch (pingError) {
        logger.warn('資料庫連線狀態異常，ping 測試失敗:', {
          error: pingError.message,
          readyState: state,
        })
        return {
          success: false,
          status: 'ping_failed',
          readyState: state,
          message: '資料庫連線狀態異常',
        }
      }
    } else {
      logger.warn('資料庫未連線，當前狀態:', {
        status,
        readyState: state,
      })
      return {
        success: false,
        status,
        readyState: state,
        message: `資料庫未連線，狀態: ${status}`,
      }
    }
  } catch (error) {
    logger.error('檢查資料庫連線狀態失敗:', {
      error: error.message,
      stack: error.stack,
    })
    return {
      success: false,
      status: 'error',
      message: '檢查資料庫連線狀態失敗',
      error: error.message,
    }
  }
}

/**
 * 等待資料庫連線就緒
 * @param {number} maxWaitTime - 最大等待時間（毫秒）
 * @param {number} checkInterval - 檢查間隔（毫秒）
 * @returns {Promise<Object>} 等待結果
 */
export const waitForDatabaseConnection = async (maxWaitTime = 30000, checkInterval = 1000) => {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const connectionStatus = await checkDatabaseConnection()

    if (connectionStatus.success) {
      logger.info('資料庫連線已就緒')
      return {
        success: true,
        waitTime: Date.now() - startTime,
        message: '資料庫連線已就緒',
      }
    }

    // 等待一段時間後再次檢查
    await new Promise((resolve) => setTimeout(resolve, checkInterval))
  }

  logger.error('等待資料庫連線超時')
  return {
    success: false,
    waitTime: maxWaitTime,
    message: '等待資料庫連線超時',
  }
}

/**
 * 嘗試重新連接到資料庫
 * @returns {Promise<Object>} 重連結果
 */
export const reconnectDatabase = async () => {
  try {
    logger.info('嘗試重新連接到資料庫...')

    const env = getCurrentEnvironment()
    const { uri, options } = env.database

    // 如果已經連接，先斷開
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
      logger.info('已斷開現有連線')
    }

    // 重新連線
    await mongoose.connect(uri, options)
    logger.info('資料庫重連成功')

    return {
      success: true,
      message: '資料庫重連成功',
    }
  } catch (error) {
    logger.error('資料庫重連失敗:', error)
    return {
      success: false,
      message: '資料庫重連失敗',
      error: error.message,
    }
  }
}

/**
 * 執行資料庫操作前的健康檢查（包含自動重連）
 * @param {string} operationName - 操作名稱
 * @param {boolean} autoReconnect - 是否啟用自動重連
 * @returns {Promise<boolean>} 是否通過健康檢查
 */
export const preOperationHealthCheck = async (operationName, autoReconnect = true) => {
  logger.info(`執行 ${operationName} 前的資料庫健康檢查...`)

  const connectionStatus = await checkDatabaseConnection()

  if (connectionStatus.success) {
    logger.info(`${operationName} 健康檢查通過`)
    return true
  }

  // 如果連線失敗且啟用了自動重連，嘗試重連
  if (autoReconnect) {
    logger.warn(`${operationName} 健康檢查失敗，嘗試自動重連...`)
    const reconnectResult = await reconnectDatabase()

    if (reconnectResult.success) {
      // 重連成功，再次檢查連線狀態
      const recheckStatus = await checkDatabaseConnection()
      if (recheckStatus.success) {
        logger.info(`${operationName} 自動重連並通過健康檢查`)
        return true
      }
    }

    logger.error(`${operationName} 自動重連失敗:`, reconnectResult)
  } else {
    logger.error(`${operationName} 健康檢查失敗:`, connectionStatus)
  }

  return false
}

export default {
  checkDatabaseConnection,
  waitForDatabaseConnection,
  preOperationHealthCheck,
  reconnectDatabase,
}
