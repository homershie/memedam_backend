const { MongoClient } = require('mongodb')
const dotenv = require('dotenv')

// 載入環境變數
dotenv.config()

async function testMongoConnection() {
  console.log('=== MongoDB 原生連接測試 ===\n')

  try {
    // 檢查環境變數
    console.log('1. 檢查環境變數...')
    console.log('MONGO_URI:', process.env.MONGO_URI ? '已設定' : '未設定')

    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI 環境變數未設定')
      return
    }

    // 測試連接
    console.log('\n2. 測試數據庫連接...')
    const client = new MongoClient(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    })

    await client.connect()
    console.log('✅ 數據庫連接成功')

    // 測試基本查詢
    console.log('\n3. 測試基本查詢...')
    const db = client.db()

    // 檢查集合列表
    const collections = await db.listCollections().toArray()
    console.log(
      '📊 數據庫集合:',
      collections.map((c) => c.name),
    )

    // 測試 memes 集合查詢
    console.log('\n4. 測試 memes 集合查詢...')
    const memesCollection = db.collection('memes')

    // 簡單計數查詢
    const count = await memesCollection.countDocuments({ status: 'active' })
    console.log(`✅ memes 集合中活躍狀態的文檔數量: ${count}`)

    // 測試分頁查詢（模擬推薦系統）
    console.log('\n5. 測試分頁查詢...')
    const memes = await memesCollection
      .find({ status: 'active' })
      .sort({ hot_score: -1 })
      .limit(10)
      .toArray()

    console.log(`✅ 成功查詢到 ${memes.length} 個 meme`)

    if (memes.length > 0) {
      console.log('前 3 個 meme 的 hot_score:')
      memes.slice(0, 3).forEach((meme, index) => {
        console.log(`  ${index + 1}. ${meme._id} - hot_score: ${meme.hot_score}`)
      })
    }

    // 檢查連接狀態
    console.log('\n6. 連接狀態檢查...')
    const adminDb = db.admin()
    const serverInfo = await adminDb.serverInfo()
    console.log('MongoDB 版本:', serverInfo.version)
    console.log('數據庫名稱:', db.databaseName)

    await client.close()
    console.log('\n✅ 測試完成，連接已關閉')
  } catch (error) {
    console.error('❌ 測試失敗:', error.message)

    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 建議: 請檢查 MongoDB 服務是否正在運行')
      console.error('   如果是本地 MongoDB，請運行: mongod')
    }

    if (error.message.includes('ENOTFOUND')) {
      console.error('💡 建議: 請檢查 MONGO_URI 中的主機名稱是否正確')
    }

    if (error.message.includes('timeout')) {
      console.error('💡 建議: 請檢查網絡連接或增加超時時間')
    }

    if (error.message.includes('authentication')) {
      console.error('💡 建議: 請檢查 MONGO_URI 中的用戶名和密碼')
    }
  }
}

// 運行測試
testMongoConnection()
