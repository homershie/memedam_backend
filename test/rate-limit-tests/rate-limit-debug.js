import request from 'supertest'
import { app } from '../../index.js'
import User from '../../models/User.js'
import jwt from 'jsonwebtoken'

// 測試檢舉 rate limit
async function testReportRateLimit() {
  console.log('🔍 開始測試檢舉 rate limit...')

  // 創建測試用戶或使用現有用戶
  let testUser
  try {
    testUser = await User.findOne({ email: 'test@example.com' })
    if (!testUser) {
      console.log('❌ 找不到測試用戶，請先創建 test@example.com 用戶')
      return
    }
  } catch (error) {
    console.log('❌ 無法找到測試用戶:', error.message)
    return
  }

  // 生成 JWT token
  const token = jwt.sign(
    { _id: testUser._id, email: testUser.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' },
  )

  // 創建測試迷因 ID（使用一個存在的迷因 ID）
  const testMemeId = '507f1f77bcf86cd799439011' // 這是一個示例 ID，實際測試時需要替換

  console.log(`👤 使用用戶: ${testUser.email} (ID: ${testUser._id})`)
  console.log(`🎯 測試迷因 ID: ${testMemeId}`)

  // 測試多次檢舉
  for (let i = 1; i <= 6; i++) {
    console.log(`\n📝 嘗試第 ${i} 次檢舉...`)

    try {
      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({
          target_type: 'meme',
          target_id: testMemeId,
          reason: 'spam',
          description: `測試檢舉 ${i}`,
        })

      console.log(`📊 回應狀態: ${response.status}`)
      console.log(`📋 回應內容:`, response.body)

      if (response.headers['ratelimit-remaining']) {
        console.log(`⏱️  剩餘請求次數: ${response.headers['ratelimit-remaining']}`)
      }
      if (response.headers['ratelimit-limit']) {
        console.log(`📈 總限制次數: ${response.headers['ratelimit-limit']}`)
      }
      if (response.headers['ratelimit-reset']) {
        const resetTime = new Date(parseInt(response.headers['ratelimit-reset']) * 1000)
        console.log(`🔄 重置時間: ${resetTime.toLocaleString()}`)
      }

      // 如果被限制，停止測試
      if (response.status === 429) {
        console.log(`🚫 第 ${i} 次檢舉被 rate limit 阻擋`)
        break
      }

      // 等待一秒再進行下一次請求
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.log(`❌ 第 ${i} 次檢舉失敗:`, error.message)
    }
  }

  console.log('\n✅ 檢舉 rate limit 測試完成')
}

// 檢查 Redis 狀態
async function checkRedisStatus() {
  console.log('\n🔍 檢查 Redis 狀態...')

  try {
    const redisCache = (await import('../../config/redis.js')).default
    const stats = await redisCache.getStats()

    console.log('📊 Redis 狀態:', {
      enabled: stats.enabled,
      connected: stats.connected,
      keys: stats.keys,
    })

    if (stats.connected) {
      const ping = await redisCache.ping()
      console.log(`🏓 Redis ping: ${ping}`)

      // 檢查 rate limit 相關的 keys
      await checkRateLimitKeys(redisCache)
    }
  } catch (error) {
    console.log('❌ 無法檢查 Redis 狀態:', error.message)
  }
}

// 檢查 rate limit keys
async function checkRateLimitKeys(redisCache) {
  console.log('\n🔍 檢查 rate limit keys...')

  try {
    // 檢查所有 rate limit 相關的 keys
    const keys = await redisCache.client.keys('rl:report:*')
    console.log(`📋 找到 ${keys.length} 個 rate limit keys:`)

    for (const key of keys) {
      const value = await redisCache.client.get(key)
      const ttl = await redisCache.client.ttl(key)
      console.log(`  ${key}: ${value} (TTL: ${ttl}s)`)
    }

    // 檢查特定用戶的 keys
    const testUser = await User.findOne({ email: 'test@example.com' })
    if (testUser) {
      const userKeys = await redisCache.client.keys(`*user:${testUser._id}*`)
      console.log(`\n👤 用戶 ${testUser.email} 的 rate limit keys:`)
      for (const key of userKeys) {
        const value = await redisCache.client.get(key)
        const ttl = await redisCache.client.ttl(key)
        console.log(`  ${key}: ${value} (TTL: ${ttl}s)`)
      }
    }
  } catch (error) {
    console.log('❌ 無法檢查 rate limit keys:', error.message)
  }
}

// 檢查 rate limit 配置
function checkRateLimitConfig() {
  console.log('\n🔍 檢查 rate limit 配置...')

  try {
    const {
      reportSubmissionLimiter,
      reportWeeklyLimiter,
    } = require('../../middleware/rateLimit.js')

    console.log('📋 24小時限制器配置:', {
      windowMs: reportSubmissionLimiter.windowMs,
      max: reportSubmissionLimiter.max,
      message: reportSubmissionLimiter.message,
    })

    console.log('📋 7天限制器配置:', {
      windowMs: reportWeeklyLimiter.windowMs,
      max: reportWeeklyLimiter.max,
      message: reportWeeklyLimiter.message,
    })

    // 檢查 keyGenerator 邏輯
    console.log('\n🔑 Key Generator 邏輯:')
    console.log('  - 如果 req.user 存在，使用 `user:${req.user._id}`')
    console.log('  - 否則使用 `ip:${req.ip}`')
  } catch (error) {
    console.log('❌ 無法檢查 rate limit 配置:', error.message)
  }
}

// 清理測試數據
async function cleanupTestData() {
  console.log('\n🧹 清理測試數據...')

  try {
    const redisCache = (await import('../../config/redis.js')).default
    if (redisCache.isConnected) {
      // 清理測試用戶的 rate limit keys
      const testUser = await User.findOne({ email: 'test@example.com' })
      if (testUser) {
        const userKeys = await redisCache.client.keys(`*user:${testUser._id}*`)
        if (userKeys.length > 0) {
          await redisCache.client.del(...userKeys)
          console.log(`🗑️  已清理 ${userKeys.length} 個測試用戶的 rate limit keys`)
        }
      }
    }
  } catch (error) {
    console.log('❌ 清理測試數據失敗:', error.message)
  }
}

// 主函數
async function main() {
  console.log('🚀 開始檢舉 rate limit 調試...')

  await checkRedisStatus()
  checkRateLimitConfig()

  // 詢問是否要清理測試數據
  console.log('\n❓ 是否要清理現有的測試數據？(y/n)')
  // 這裡可以加入互動式輸入，但為了簡化，我們直接清理
  await cleanupTestData()

  await testReportRateLimit()

  console.log('\n🎉 調試完成')
  process.exit(0)
}

// 執行主函數
main().catch((error) => {
  console.error('❌ 調試過程中發生錯誤:', error)
  process.exit(1)
})
