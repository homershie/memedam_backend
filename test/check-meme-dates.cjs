const { MongoClient } = require('mongodb')
const dotenv = require('dotenv')

// 載入環境變數
dotenv.config()

async function checkMemeDates() {
  console.log('=== 檢查迷因創建時間 ===\n')

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

    // 計算7天前的日期
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    console.log(`📅 7天前日期: ${sevenDaysAgo.toISOString()}`)

    // 檢查總數
    const totalCount = await memesCollection.countDocuments({ status: 'public' })
    console.log(`📊 總共有 ${totalCount} 個 public 狀態的迷因`)

    // 檢查最近7天內的數量
    const recentCount = await memesCollection.countDocuments({
      status: 'public',
      createdAt: { $gte: sevenDaysAgo },
    })
    console.log(`📊 最近7天內創建的迷因: ${recentCount} 個`)

    // 檢查所有迷因的創建時間
    console.log('\n📋 所有迷因的創建時間:')
    const allMemes = await memesCollection
      .find({ status: 'public' })
      .sort({ createdAt: -1 })
      .toArray()

    allMemes.forEach((meme, index) => {
      const createdAt = new Date(meme.createdAt)
      const isRecent = createdAt >= sevenDaysAgo
      const status = isRecent ? '✅ 最近7天' : '❌ 超過7天'
      console.log(`${index + 1}. ${meme._id} - ${createdAt.toISOString()} ${status}`)
    })

    await client.close()
    console.log('\n✅ 檢查完成')
  } catch (error) {
    console.error('❌ 檢查失敗:', error.message)
  }
}

// 運行檢查
checkMemeDates()
