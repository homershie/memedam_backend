/**
 * 效能測試腳本
 * 測試 Redis 快取、資料庫查詢和非同步處理的效能
 */

import { performance } from 'perf_hooks'
import redisCache from '../config/redis.js'
import {
  taskQueue,
  batchProcessor,
  parallelProcessor,
  cacheProcessor,
  performanceMonitor,
} from '../utils/asyncProcessor.js'
import { getMixedRecommendations } from '../utils/mixedRecommendation.js'
import { logger } from '../utils/logger.js'

/**
 * 效能測試類別
 */
class PerformanceTest {
  constructor() {
    this.results = []
    this.testData = []
  }

  /**
   * 生成測試數據
   */
  generateTestData(count = 1000) {
    this.testData = Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `test_item_${i}`,
      value: Math.random() * 1000,
      timestamp: Date.now(),
    }))
  }

  /**
   * 測試 Redis 快取效能
   */
  async testRedisCache() {
    logger.info('開始測試 Redis 快取效能...')

    const testKey = 'performance_test'
    const testData = { message: 'Hello World', timestamp: Date.now() }

    // 測試寫入效能
    const writeStart = performance.now()
    await redisCache.set(testKey, testData, 60)
    const writeTime = performance.now() - writeStart

    // 測試讀取效能
    const readStart = performance.now()
    const cachedData = await redisCache.get(testKey)
    const readTime = performance.now() - readStart

    // 測試批量操作
    const batchStart = performance.now()
    const batchPromises = this.testData
      .slice(0, 100)
      .map((item, index) => redisCache.set(`batch_test_${index}`, item, 60))
    await Promise.all(batchPromises)
    const batchTime = performance.now() - batchStart

    this.results.push({
      test: 'Redis Cache',
      writeTime: writeTime.toFixed(2),
      readTime: readTime.toFixed(2),
      batchTime: batchTime.toFixed(2),
      success: cachedData !== null,
    })

    logger.info(
      `Redis 快取測試完成 - 寫入: ${writeTime.toFixed(2)}ms, 讀取: ${readTime.toFixed(2)}ms`,
    )
  }

  /**
   * 測試任務隊列效能
   */
  async testTaskQueue() {
    logger.info('開始測試任務隊列效能...')

    const queueStart = performance.now()
    const taskPromises = []

    // 添加多個任務
    for (let i = 0; i < 50; i++) {
      taskPromises.push(
        taskQueue.add(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 100))
            return `task_${i}_completed`
          },
          { priority: Math.floor(Math.random() * 5) },
        ),
      )
    }

    await Promise.all(taskPromises)
    const queueTime = performance.now() - queueStart

    this.results.push({
      test: 'Task Queue',
      queueTime: queueTime.toFixed(2),
      taskCount: 50,
      success: true,
    })

    logger.info(`任務隊列測試完成 - 總時間: ${queueTime.toFixed(2)}ms`)
  }

  /**
   * 測試批量處理效能
   */
  async testBatchProcessing() {
    logger.info('開始測試批量處理效能...')

    const batchStart = performance.now()

    const { results, errors } = await batchProcessor.processBatch(
      this.testData,
      async (batch) => {
        // 模擬處理邏輯
        await new Promise((resolve) => setTimeout(resolve, 10))
        return batch.map((item) => ({ ...item, processed: true }))
      },
      {
        batchSize: 50,
        delay: 50,
        maxConcurrency: 3,
      },
    )

    const batchTime = performance.now() - batchStart

    this.results.push({
      test: 'Batch Processing',
      batchTime: batchTime.toFixed(2),
      processedItems: results.length,
      errors: errors.length,
      success: errors.length === 0,
    })

    logger.info(`批量處理測試完成 - 總時間: ${batchTime.toFixed(2)}ms, 處理項目: ${results.length}`)
  }

  /**
   * 測試並行處理效能
   */
  async testParallelProcessing() {
    logger.info('開始測試並行處理效能...')

    const parallelStart = performance.now()

    const tasks = this.testData.slice(0, 100).map((item, index) => async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))
      return { ...item, processed: true, taskIndex: index }
    })

    const { results, errors } = await parallelProcessor.processParallel(tasks, {
      maxConcurrency: 10,
      timeout: 30000,
    })

    const parallelTime = performance.now() - parallelStart

    this.results.push({
      test: 'Parallel Processing',
      parallelTime: parallelTime.toFixed(2),
      completedTasks: results.length,
      errors: errors.length,
      success: errors.length === 0,
    })

    logger.info(
      `並行處理測試完成 - 總時間: ${parallelTime.toFixed(2)}ms, 完成任務: ${results.length}`,
    )
  }

  /**
   * 測試快取處理器效能
   */
  async testCacheProcessor() {
    logger.info('開始測試快取處理器效能...')

    const cacheStart = performance.now()

    const cachePromises = this.testData.slice(0, 50).map((item, index) =>
      cacheProcessor.processWithCache(
        `cache_test_${index}`,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20))
          return { ...item, cached: true }
        },
        { ttl: 60 },
      ),
    )

    const results = await Promise.all(cachePromises)
    const cacheTime = performance.now() - cacheStart

    this.results.push({
      test: 'Cache Processor',
      cacheTime: cacheTime.toFixed(2),
      cachedItems: results.length,
      success: results.every((result) => result !== null),
    })

    logger.info(
      `快取處理器測試完成 - 總時間: ${cacheTime.toFixed(2)}ms, 快取項目: ${results.length}`,
    )
  }

  /**
   * 測試推薦系統效能
   */
  async testRecommendationSystem() {
    logger.info('開始測試推薦系統效能...')

    const recommendationStart = performance.now()

    try {
      const result = await getMixedRecommendations('test_user_id', {
        limit: 20,
        useCache: true,
        includeDiversity: true,
        includeSocialScores: true,
      })

      const recommendationTime = performance.now() - recommendationStart

      this.results.push({
        test: 'Recommendation System',
        recommendationTime: recommendationTime.toFixed(2),
        recommendationsCount: result.recommendations.length,
        success: result.recommendations.length > 0,
      })

      logger.info(
        `推薦系統測試完成 - 總時間: ${recommendationTime.toFixed(2)}ms, 推薦數量: ${result.recommendations.length}`,
      )
    } catch (error) {
      logger.error('推薦系統測試失敗:', error)
      this.results.push({
        test: 'Recommendation System',
        recommendationTime: 0,
        recommendationsCount: 0,
        success: false,
        error: error.message,
      })
    }
  }

  /**
   * 測試效能監控
   */
  async testPerformanceMonitoring() {
    logger.info('開始測試效能監控...')

    const monitorStart = performance.now()

    // 模擬多個監控點
    for (let i = 0; i < 10; i++) {
      performanceMonitor.start(`test_monitor_${i}`)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100))
      performanceMonitor.end(`test_monitor_${i}`)
    }

    const metrics = performanceMonitor.getAllMetrics()
    const monitorTime = performance.now() - monitorStart

    this.results.push({
      test: 'Performance Monitoring',
      monitorTime: monitorTime.toFixed(2),
      metricsCount: Object.keys(metrics).length,
      success: Object.keys(metrics).length > 0,
    })

    logger.info(
      `效能監控測試完成 - 總時間: ${monitorTime.toFixed(2)}ms, 監控點: ${Object.keys(metrics).length}`,
    )
  }

  /**
   * 執行所有測試
   */
  async runAllTests() {
    logger.info('開始執行效能測試...')

    // 生成測試數據
    this.generateTestData(1000)

    // 執行各項測試
    await this.testRedisCache()
    await this.testTaskQueue()
    await this.testBatchProcessing()
    await this.testParallelProcessing()
    await this.testCacheProcessor()
    await this.testRecommendationSystem()
    await this.testPerformanceMonitoring()

    // 輸出測試結果
    this.printResults()
  }

  /**
   * 輸出測試結果
   */
  printResults() {
    logger.info('\n=== 效能測試結果 ===')

    this.results.forEach((result) => {
      const status = result.success ? '✅' : '❌'
      logger.info(`${status} ${result.test}`)

      Object.entries(result).forEach(([key, value]) => {
        if (key !== 'test' && key !== 'success') {
          logger.info(`  ${key}: ${value}`)
        }
      })

      logger.info('')
    })

    // 計算總體統計
    const successfulTests = this.results.filter((r) => r.success).length
    const totalTests = this.results.length

    logger.info(`總體結果: ${successfulTests}/${totalTests} 測試通過`)

    // 效能基準檢查
    this.checkPerformanceBenchmarks()
  }

  /**
   * 檢查效能基準
   */
  checkPerformanceBenchmarks() {
    logger.info('\n=== 效能基準檢查 ===')

    const benchmarks = {
      'Redis Cache Read': 5, // ms
      'Redis Cache Write': 10, // ms
      'Task Queue': 1000, // ms for 50 tasks
      'Batch Processing': 2000, // ms for 1000 items
      'Parallel Processing': 1000, // ms for 100 tasks
      'Cache Processor': 1000, // ms for 50 items
      'Recommendation System': 500, // ms
    }

    this.results.forEach((result) => {
      const benchmark = benchmarks[result.test]
      if (benchmark) {
        const timeKey = Object.keys(result).find((key) => key.includes('Time'))
        if (timeKey) {
          const actualTime = parseFloat(result[timeKey])
          const status = actualTime <= benchmark ? '✅' : '⚠️'
          logger.info(`${status} ${result.test}: ${actualTime}ms (基準: ${benchmark}ms)`)
        }
      }
    })
  }
}

/**
 * 執行效能測試
 */
const runPerformanceTest = async () => {
  try {
    const test = new PerformanceTest()
    await test.runAllTests()
  } catch (error) {
    logger.error('效能測試執行失敗:', error)
  }
}

// 如果直接執行此檔案，則執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTest()
}

export default PerformanceTest
