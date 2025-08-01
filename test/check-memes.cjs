const { MongoClient } = require('mongodb')
const dotenv = require('dotenv')

// 載入環境變數
dotenv.config()

async function checkMemes() {
  console.log('=== 檢查 Memes 集合 ===\n')

  try {
    const client = new MongoClient(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    })

    await client.connect()
    console.log('✅ 數據庫連接成功')

    const db = client.db()
    const memesCollection = db.collection('memes')

    // 檢查總文檔數量
    const totalCount = await memesCollection.countDocuments({})
    console.log(`📊 memes 集合總文檔數量: ${totalCount}`)

    if (totalCount === 0) {
      console.log('❌ memes 集合中沒有文檔')
      await client.close()
      return
    }

    // 檢查不同狀態的文檔數量
    console.log('\n📈 不同狀態的文檔數量:')
    const statusCounts = await memesCollection
      .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
      .toArray()

    statusCounts.forEach((status) => {
      console.log(`  ${status._id || '無狀態'}: ${status.count} 個`)
    })

    // 檢查前 5 個文檔的詳細信息
    console.log('\n📋 前 5 個文檔的詳細信息:')
    const sampleMemes = await memesCollection.find({}).limit(5).toArray()

    sampleMemes.forEach((meme, index) => {
      console.log(`\n文檔 ${index + 1}:`)
      console.log(`  ID: ${meme._id}`)
      console.log(`  標題: ${meme.title || '無標題'}`)
      console.log(`  狀態: ${meme.status || '無狀態'}`)
      console.log(`  hot_score: ${meme.hot_score || '無'}`)
      console.log(`  創建時間: ${meme.created_at || meme.createdAt || '無'}`)
    })

    // 檢查是否有 hot_score 字段
    console.log('\n🔍 檢查 hot_score 字段:')
    const withHotScore = await memesCollection.countDocuments({ hot_score: { $exists: true } })
    const withoutHotScore = await memesCollection.countDocuments({ hot_score: { $exists: false } })
    console.log(`  有 hot_score: ${withHotScore} 個`)
    console.log(`  無 hot_score: ${withoutHotScore} 個`)

    // 如果有 hot_score，顯示排序結果
    if (withHotScore > 0) {
      console.log('\n📊 按 hot_score 排序的前 5 個:')
      const topHotMemes = await memesCollection
        .find({ hot_score: { $exists: true } })
        .sort({ hot_score: -1 })
        .limit(5)
        .toArray()

      topHotMemes.forEach((meme, index) => {
        console.log(`  ${index + 1}. ${meme._id} - hot_score: ${meme.hot_score}`)
      })
    }

    await client.close()
    console.log('\n✅ 檢查完成')
  } catch (error) {
    console.error('❌ 檢查失敗:', error.message)
  }
}

// 運行檢查
checkMemes()
