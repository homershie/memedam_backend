import request from 'supertest'
import { app } from '../../index.js'

// 測試迷因相關 API 的速率限制
async function testRateLimits() {
  console.log('開始測試迷因相關 API 速率限制...')

  const testUrls = [
    '/api/tags/categories?lang=zh',
    '/api/recommendations?page=1&limit=10&include_social_signals=true&algorithm=trending',
    '/api/tags/popular?limit=10',
    '/api/memes?page=1&limit=5',
    '/api/recommendations/infinite-scroll?limit=5&page=1&clear_cache=true',
    '/api/memes/search-suggestions',
  ]

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i]
    console.log(`\n測試 ${i + 1}/${testUrls.length}: ${url}`)

    try {
      const response = await request(app).get(url).timeout(5000)

      console.log(`狀態碼: ${response.status}`)
      console.log(`RateLimit-Limit: ${response.headers['ratelimit-limit']}`)
      console.log(`RateLimit-Remaining: ${response.headers['ratelimit-remaining']}`)
      console.log(`RateLimit-Reset: ${response.headers['ratelimit-reset']}`)

      if (response.status === 429) {
        console.log('❌ 遇到 429 錯誤！')
        console.log('錯誤訊息:', response.body)
      } else {
        console.log('✅ 請求成功')
      }
    } catch (error) {
      console.log(`❌ 請求失敗: ${error.message}`)
    }
  }

  console.log('\n測試完成！')
}

// 執行測試
testRateLimits().catch(console.error)
