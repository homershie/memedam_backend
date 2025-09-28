/**
 * 測試數據庫連接
 */

import mongoose from 'mongoose'
import { loadEnv } from '../../config/loadEnv.js'

console.log('🚀 測試數據庫連接...')

loadEnv()

const main = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/memedam'
    console.log(`🔗 嘗試連接到: ${mongoUri}`)

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    console.log('✅ 數據庫連接成功')

    // 測試查詢
    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log(`📊 數據庫中的集合數量: ${collections.length}`)

    await mongoose.connection.close()
    console.log('🔌 數據庫連接已關閉')
  } catch (error) {
    console.error('❌ 數據庫連接失敗:', error.message)
    process.exit(1)
  }
}

main()

