import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import redisCache from '../config/redis.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 載入環境變數
dotenv.config({ path: join(__dirname, '../.env') })

/**
 * 清除所有推薦系統相關的快取
 */
async function clearRecommendationCache() {
  try {
    console.log('開始清除推薦系統快取...')

    // 連接到Redis
    await redisCache.connect()

    if (!redisCache.isConnected) {
      console.error('無法連接到Redis')
      return
    }

    // 要清除的快取鍵模式
    const patterns = [
      'meme_social_score:*',
      'batch_social_scores:*',
      'social_graph:*',
      'cache_version:*',
      'mixed_recommendations:*',
      'content_based:*',
      'collaborative_filtering:*',
    ]

    let totalDeleted = 0

    for (const pattern of patterns) {
      try {
        const deleted = await redisCache.delPattern(pattern)
        console.log(`清除快取模式 ${pattern}: ${deleted} 個鍵`)
        totalDeleted += deleted
      } catch (error) {
        console.error(`清除快取模式 ${pattern} 失敗:`, error.message)
      }
    }

    // 檢查總共剩餘多少鍵
    const stats = await redisCache.getStats()
    console.log(`快取清除完成，共清除 ${totalDeleted} 個鍵，當前剩餘 ${stats.keys} 個鍵`)
  } catch (error) {
    console.error('清除快取時發生錯誤:', error)
  } finally {
    // 關閉Redis連接
    await redisCache.disconnect()
    // 關閉MongoDB連接
    await mongoose.connection.close()
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  clearRecommendationCache()
    .then(() => {
      console.log('快取清除腳本執行完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('快取清除腳本執行失敗:', error)
      process.exit(1)
    })
}

export { clearRecommendationCache }
