import mongoose from 'mongoose'
import dotenv from 'dotenv'

// 載入環境變數
dotenv.config()

async function simpleDBTest() {
  console.log('=== 簡化數據庫測試 ===\n')

  try {
    // 檢查環境變數
    console.log('1. 檢查環境變數...')
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI 環境變數未設定')
      console.log('請檢查 .env 文件是否存在並包含 MONGO_URI')
      return
    }
    console.log('✅ MONGO_URI 已設定')

    // 簡化的連接選項
    console.log('\n2. 嘗試連接數據庫...')
    const options = {
      maxPoolSize: 1, // 減少連接池大小
      serverSelectionTimeoutMS: 5000, // 減少超時時間
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
    }

    await mongoose.connect(process.env.MONGO_URI, options)
    console.log('✅ 數據庫連接成功')

    // 簡單的查詢測試
    console.log('\n3. 測試簡單查詢...')
    const db = mongoose.connection.db

    // 檢查數據庫是否存在
    const adminDb = db.admin()
    const dbList = await adminDb.listDatabases()
    console.log(
      '📊 可用的數據庫:',
      dbList.databases.map((db) => db.name),
    )

    // 檢查當前數據庫的集合
    const collections = await db.listCollections().toArray()
    console.log(
      '📊 當前數據庫的集合:',
      collections.map((c) => c.name),
    )

    // 如果沒有集合，創建一個測試集合
    if (collections.length === 0) {
      console.log('⚠️ 數據庫中沒有集合，創建測試集合...')
      const testCollection = db.collection('test')
      await testCollection.insertOne({ test: 'data', timestamp: new Date() })
      console.log('✅ 測試集合創建成功')
    }

    // 測試基本查詢
    const testCollection = db.collection('test')
    const testDoc = await testCollection.findOne({})
    console.log('✅ 基本查詢成功:', testDoc ? '找到文檔' : '沒有文檔')

    await mongoose.connection.close()
    console.log('\n✅ 測試完成')
  } catch (error) {
    console.error('❌ 測試失敗:', error.message)

    // 提供具體的錯誤建議
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 解決方案:')
      console.error('1. 確保 MongoDB 服務正在運行')
      console.error('2. 檢查 MongoDB 是否在正確的端口上運行')
      console.error('3. 如果是本地 MongoDB，請運行: mongod')
    }

    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 解決方案:')
      console.error('1. 檢查 MONGO_URI 中的主機名稱是否正確')
      console.error('2. 檢查網絡連接')
    }

    if (error.message.includes('timeout')) {
      console.error('\n💡 解決方案:')
      console.error('1. 檢查網絡連接')
      console.error('2. 檢查防火牆設置')
      console.error('3. 嘗試增加超時時間')
    }

    if (error.message.includes('authentication')) {
      console.error('\n💡 解決方案:')
      console.error('1. 檢查 MONGO_URI 中的用戶名和密碼')
      console.error('2. 確保用戶有適當的權限')
    }
  }
}

// 如果直接運行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleDBTest()
}

export { simpleDBTest }
