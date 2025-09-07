#!/usr/bin/env node

/**
 * 快取系統快速測試腳本
 * 用於驗證統一快取管理器是否正常工作
 */

import integratedCache from '../config/cache.js'

async function testCacheSystem() {
  console.log('🚀 開始測試整合快取系統...\n')

  try {
    // 1. 初始化測試
    console.log('📋 步驟 1: 初始化快取系統')
    const initResult = await integratedCache.initialize()
    console.log(`   結果: ${initResult ? '✅ 成功' : '❌ 失敗'}\n`)

    // 2. 健康檢查
    console.log('📋 步驟 2: 執行健康檢查')
    const healthResult = await integratedCache.healthCheck()
    console.log(`   整體狀態: ${healthResult.overall}`)
    console.log(`   Redis 狀態: ${healthResult.redis.connected ? '✅ 已連線' : '❌ 未連線'}`)
    console.log(`   管理器狀態: ${healthResult.manager.status}\n`)

    // 3. 基本快取操作測試
    console.log('📋 步驟 3: 測試基本快取操作')

    const testKey = 'cache-system-test:key'
    const testData = {
      message: 'Hello from unified cache manager',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }

    // 設定快取
    console.log('   設定快取...')
    const setResult = await integratedCache.manager.set(testKey, testData, { ttl: 300 })
    console.log(`   設定結果: ${setResult ? '✅ 成功' : '❌ 失敗'}`)

    // 取得快取
    console.log('   取得快取...')
    const getResult = await integratedCache.manager.get(testKey)
    console.log(`   取得結果: ${getResult ? '✅ 成功' : '❌ 失敗'}`)
    if (getResult) {
      console.log(
        `   資料驗證: ${getResult.message === testData.message ? '✅ 正確' : '❌ 不正確'}`,
      )
    }

    // 測試 getOrSet
    console.log('   測試 getOrSet...')
    const getOrSetResult = await integratedCache.manager.getOrSet(
      'cache-system-test:getorset',
      async () => ({ generated: true, time: Date.now() }),
    )
    console.log(`   getOrSet 結果: ${getOrSetResult ? '✅ 成功' : '❌ 失敗'}`)

    // 4. 版本控制測試
    console.log('📋 步驟 4: 測試版本控制')
    const versionKey = 'cache-system-test:versioned'

    // 取得初始版本
    const initialVersion = await integratedCache.manager.getVersion(versionKey)
    console.log(`   初始版本: ${initialVersion}`)

    // 更新版本
    const updatedVersion = await integratedCache.manager.updateVersion(versionKey, 'minor')
    console.log(`   更新版本: ${updatedVersion}`)

    // 測試版本控制的快取操作
    const versionedResult = await integratedCache.manager.getOrSet(
      versionKey,
      async () => ({ versioned: true, version: updatedVersion }),
      { useVersion: true },
    )
    console.log(`   版本控制快取: ${versionedResult ? '✅ 成功' : '❌ 失敗'}`)

    // 5. 監控測試
    console.log('📋 步驟 5: 測試監控功能')
    const stats = await integratedCache.manager.getStats()
    console.log(`   快取統計: ${stats ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`   Redis 鍵數量: ${stats?.redis?.keys || 0}`)
    console.log(`   監控鍵數量: ${stats?.monitor?.overall?.totalKeys || 0}`)

    // 產生效能報告
    console.log('   產生效能報告...')
    const report = integratedCache.getPerformanceReport()
    console.log('   效能報告摘要:')
    console.log(`   ${report.split('\n')[0] || '無報告'}`)

    // 6. 測試新的高級版本管理功能
    console.log('📋 步驟 6: 測試高級版本管理功能')

    // 測試批量操作
    console.log('   測試批量版本更新...')
    const bulkResult = await integratedCache.versionManager.batchUpdateVersions(
      ['test:key1', 'test:key2'],
      'minor',
    )
    console.log(`   批量更新結果: ${bulkResult ? '✅ 成功' : '❌ 失敗'}`)

    // 測試統計功能
    console.log('   測試版本統計...')
    const versionStats = await integratedCache.versionManager.getVersionStats()
    console.log(`   版本統計: ${versionStats ? '✅ 成功' : '❌ 失敗'}`)
    console.log(`   總快取鍵數: ${versionStats?.total_cache_keys || 0}`)
    console.log(`   記憶體快取大小: ${versionStats?.memory_cache_size || 0}`)

    // 測試清除功能
    console.log('   測試清除功能...')
    await integratedCache.versionManager.clearVersion('test:key1')
    console.log('   清除版本: ✅ 完成')

    // 測試重置功能
    console.log('   測試重置功能...')
    await integratedCache.versionManager.resetAllVersions()
    console.log('   重置所有版本: ✅ 完成')

    // 7. 清理測試
    console.log('📋 步驟 7: 清理測試資料')
    const cleanupResult = await integratedCache.manager.delMulti([
      testKey,
      'cache-system-test:getorset',
      versionKey,
      `${versionKey}:version`,
    ])
    console.log(`   清理結果: 刪除 ${cleanupResult.deleted} 個鍵`)

    // 7. 最終健康檢查
    console.log('📋 步驟 7: 最終健康檢查')
    const finalHealth = await integratedCache.healthCheck()
    console.log(`   最終狀態: ${finalHealth.overall}`)

    console.log('\n🎉 整合快取系統測試完成！')
    console.log('\n📊 測試摘要:')
    console.log(`   初始化: ${initResult ? '✅' : '❌'}`)
    console.log(`   健康檢查: ${healthResult.overall === 'healthy' ? '✅' : '❌'}`)
    console.log(`   基本操作: ${setResult && getResult ? '✅' : '❌'}`)
    console.log(`   版本控制: ${versionedResult ? '✅' : '❌'}`)
    console.log(`   監控功能: ${stats ? '✅' : '❌'}`)
    console.log(`   批量操作: ${bulkResult ? '✅' : '❌'}`)
    console.log(`   統計功能: ${versionStats ? '✅' : '❌'}`)
    console.log(`   清理功能: ${cleanupResult.deleted >= 0 ? '✅' : '❌'}`)

    const successCount = [
      initResult,
      healthResult.overall === 'healthy',
      setResult && getResult,
      versionedResult,
      !!stats,
      bulkResult,
      versionStats,
      cleanupResult.deleted >= 0,
    ].filter(Boolean).length

    const totalTests = 8
    console.log(`\n🏆 總分: ${successCount}/${totalTests} 項測試通過`)

    if (successCount === totalTests) {
      console.log('🎯 恭喜！統一快取管理器運行正常！')
      process.exit(0)
    } else {
      console.log('⚠️  部分測試失敗，請檢查系統配置')
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.message)
    console.error('詳細錯誤:', error)
    process.exit(1)
  }
}

// 執行測試
testCacheSystem().catch((error) => {
  console.error('💥 無法執行測試:', error.message)
  process.exit(1)
})
