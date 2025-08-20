/**
 * 非同步處理工具
 * 提供隊列管理、批量操作和並行處理功能
 */

import { logger } from '../utils/logger.js'
import redisCache from '../config/redis.js'

/**
 * 任務隊列管理器
 */
class TaskQueue {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 5
    this.retryAttempts = options.retryAttempts || 3
    this.retryDelay = options.retryDelay || 1000
    this.queue = []
    this.running = 0
    this.processing = false
  }

  /**
   * 添加任務到隊列
   * @param {Function} task - 任務函數
   * @param {Object} options - 任務選項
   */
  async add(task, options = {}) {
    const taskItem = {
      id: Date.now() + Math.random(),
      task,
      options,
      priority: options.priority || 0,
      retries: 0,
      createdAt: Date.now(),
    }

    this.queue.push(taskItem)
    this.queue.sort((a, b) => b.priority - a.priority)

    if (!this.processing) {
      this.process()
    }

    return taskItem.id
  }

  /**
   * 處理隊列中的任務
   */
  async process() {
    if (this.processing || this.running >= this.maxConcurrency) {
      return
    }

    this.processing = true

    while (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const taskItem = this.queue.shift()
      this.running++

      this.executeTask(taskItem).finally(() => {
        this.running--
        if (this.queue.length > 0 && this.running < this.maxConcurrency) {
          this.process()
        } else if (this.queue.length === 0 && this.running === 0) {
          this.processing = false
        }
      })
    }

    this.processing = false
  }

  /**
   * 執行任務
   * @param {Object} taskItem - 任務項目
   */
  async executeTask(taskItem) {
    try {
      await taskItem.task()
    } catch (error) {
      logger.error(`任務執行失敗 (ID: ${taskItem.id}):`, error)

      if (taskItem.retries < this.retryAttempts) {
        taskItem.retries++
        setTimeout(() => {
          this.queue.unshift(taskItem)
          this.process()
        }, this.retryDelay * taskItem.retries)
      } else {
        logger.error(`任務重試次數已達上限 (ID: ${taskItem.id})`)
      }
    }
  }

  /**
   * 取得隊列狀態
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      processing: this.processing,
      maxConcurrency: this.maxConcurrency,
    }
  }

  /**
   * 清空隊列
   */
  clear() {
    this.queue = []
  }
}

/**
 * 批量處理器
 */
class BatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 100
    this.delay = options.delay || 100
    this.maxConcurrency = options.maxConcurrency || 3
  }

  /**
   * 批量處理數據
   * @param {Array} items - 數據項目
   * @param {Function} processor - 處理函數
   * @param {Object} options - 選項
   */
  async processBatch(items, processor, options = {}) {
    const batchSize = options.batchSize || this.batchSize
    const delay = options.delay || this.delay
    const maxConcurrency = options.maxConcurrency || this.maxConcurrency

    const batches = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    const results = []
    const errors = []

    // 並行處理批次
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const currentBatches = batches.slice(i, i + maxConcurrency)

      const batchResults = await Promise.allSettled(
        currentBatches.map(async (batch, index) => {
          try {
            const result = await processor(batch, i + index)
            return { batchIndex: i + index, result }
          } catch (error) {
            logger.error(`批次處理失敗 (批次 ${i + index}):`, error)
            return { batchIndex: i + index, error }
          }
        }),
      )

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.error) {
            errors.push(result.value)
          } else {
            results.push(result.value)
          }
        } else {
          errors.push({ batchIndex: i + index, error: result.reason })
        }
      })

      // 批次間延遲
      if (i + maxConcurrency < batches.length) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return { results, errors }
  }
}

/**
 * 並行處理器
 */
class ParallelProcessor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 10
    this.timeout = options.timeout || 30000
  }

  /**
   * 並行處理任務
   * @param {Array} tasks - 任務列表
   * @param {Object} options - 選項
   */
  async processParallel(tasks, options = {}) {
    const maxConcurrency = options.maxConcurrency || this.maxConcurrency
    const timeout = options.timeout || this.timeout

    const results = []
    const errors = []

    // 使用 Promise.allSettled 確保所有任務都能完成
    const taskPromises = tasks.map(async (task, index) => {
      try {
        const result = await Promise.race([
          task(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), timeout)),
        ])
        return { index, result, success: true }
      } catch (error) {
        logger.error(`並行任務失敗 (索引 ${index}):`, error)
        return { index, error, success: false }
      }
    })

    // 控制並行度
    const chunks = []
    for (let i = 0; i < taskPromises.length; i += maxConcurrency) {
      chunks.push(taskPromises.slice(i, i + maxConcurrency))
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk)

      chunkResults.forEach((result) => {
        if (result.success) {
          results.push(result)
        } else {
          errors.push(result)
        }
      })
    }

    return { results, errors }
  }
}

/**
 * 快取處理器
 */
class CacheProcessor {
  constructor() {
    this.cache = redisCache
  }

  /**
   * 帶快取的處理函數
   * @param {string} key - 快取鍵
   * @param {Function} processor - 處理函數
   * @param {Object} options - 選項
   */
  async processWithCache(key, processor, options = {}) {
    const ttl = options.ttl || 3600
    const forceRefresh = options.forceRefresh || false

    if (!forceRefresh) {
      const cached = await this.cache.get(key)
      if (cached !== null) {
        return cached
      }
    }

    const result = await processor()
    await this.cache.set(key, result, ttl)
    return result
  }

  /**
   * 批量快取處理
   * @param {Array} keys - 快取鍵列表
   * @param {Function} processor - 處理函數
   * @param {Object} options - 選項
   */
  async processBatchWithCache(keys, processor, options = {}) {
    const ttl = options.ttl || 3600
    const forceRefresh = options.forceRefresh || false

    // 嘗試從快取取得所有鍵
    const cachedResults = {}
    const missingKeys = []

    if (!forceRefresh) {
      const cachePromises = keys.map(async (key) => {
        const cached = await this.cache.get(key)
        if (cached !== null) {
          cachedResults[key] = cached
        } else {
          missingKeys.push(key)
        }
      })

      await Promise.all(cachePromises)
    } else {
      missingKeys.push(...keys)
    }

    // 處理缺失的鍵
    if (missingKeys.length > 0) {
      const newResults = await processor(missingKeys)

      // 設定快取
      const cachePromises = Object.entries(newResults).map(([key, value]) =>
        this.cache.set(key, value, ttl),
      )
      await Promise.all(cachePromises)

      // 合併結果
      Object.assign(cachedResults, newResults)
    }

    return cachedResults
  }
}

/**
 * 效能監控器
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map()
  }

  /**
   * 開始監控
   * @param {string} name - 監控名稱
   */
  start(name) {
    this.metrics.set(name, {
      startTime: Date.now(),
      endTime: null,
      duration: null,
    })
  }

  /**
   * 結束監控
   * @param {string} name - 監控名稱
   */
  end(name) {
    const metric = this.metrics.get(name)
    if (metric) {
      metric.endTime = Date.now()
      metric.duration = metric.endTime - metric.startTime
    }
  }

  /**
   * 取得監控結果
   * @param {string} name - 監控名稱
   */
  getMetric(name) {
    return this.metrics.get(name)
  }

  /**
   * 取得所有監控結果
   */
  getAllMetrics() {
    return Object.fromEntries(this.metrics)
  }

  /**
   * 清除監控數據
   */
  clear() {
    this.metrics.clear()
  }
}

// 創建全局實例
const taskQueue = new TaskQueue()
const batchProcessor = new BatchProcessor()
const parallelProcessor = new ParallelProcessor()
const cacheProcessor = new CacheProcessor()
const performanceMonitor = new PerformanceMonitor()

export {
  TaskQueue,
  BatchProcessor,
  ParallelProcessor,
  CacheProcessor,
  PerformanceMonitor,
  taskQueue,
  batchProcessor,
  parallelProcessor,
  cacheProcessor,
  performanceMonitor,
}
