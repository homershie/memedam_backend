import mongoose from 'mongoose'
import logger from '../utils/logger.js'

/**
 * 資料庫連線配置
 */
const connectDB = async () => {
  try {
    // 設定連線選項
    const options = {
      maxPoolSize: 10, // 連線池大小
      serverSelectionTimeoutMS: 5000, // 伺服器選擇超時
      socketTimeoutMS: 45000, // Socket 超時
      bufferMaxEntries: 0, // 禁用 mongoose 緩衝
      bufferCommands: false, // 禁用命令緩衝
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }

    await mongoose.connect(process.env.MONGO_URI, options)

    // 監聽連線事件
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB 已連線')
    })

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB 連線錯誤:', err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB 連線已斷開')
    })

    // 優雅關閉
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      logger.info('MongoDB 連線已關閉')
      process.exit(0)
    })

    // 建立索引
    await createIndexes()
  } catch (err) {
    logger.error('MongoDB 連線失敗:', err)
    process.exit(1)
  }
}

/**
 * 建立資料庫索引
 */
const createIndexes = async () => {
  try {
    // 取得所有模型
    const models = mongoose.models

    // 為每個模型建立索引
    for (const [modelName, model] of Object.entries(models)) {
      await createModelIndexes(model, modelName)
    }

    logger.info('資料庫索引建立完成')
  } catch (error) {
    logger.error('建立索引失敗:', error)
  }
}

/**
 * 為特定模型建立索引
 * @param {Object} model - Mongoose 模型
 * @param {string} modelName - 模型名稱
 */
const createModelIndexes = async (model, modelName) => {
  try {
    switch (modelName) {
      case 'User':
        await model.collection.createIndex({ username: 1 }, { unique: true })
        await model.collection.createIndex({ email: 1 }, { unique: true })
        await model.collection.createIndex({ created_at: -1 })
        await model.collection.createIndex({ status: 1 })
        break

      case 'Meme':
        await model.collection.createIndex({ status: 1 })
        await model.collection.createIndex({ author_id: 1 })
        await model.collection.createIndex({ created_at: -1 })
        await model.collection.createIndex({ hot_score: -1 })
        await model.collection.createIndex({ tags_cache: 1 })
        await model.collection.createIndex({
          status: 1,
          created_at: -1,
        })
        await model.collection.createIndex({
          status: 1,
          hot_score: -1,
        })
        // 複合索引用於搜尋
        await model.collection.createIndex({
          status: 1,
          title: 'text',
          description: 'text',
        })
        break

      case 'Like':
        await model.collection.createIndex({ user_id: 1 })
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex(
          {
            user_id: 1,
            meme_id: 1,
          },
          { unique: true },
        )
        await model.collection.createIndex({ created_at: -1 })
        break

      case 'Comment':
        await model.collection.createIndex({ user_id: 1 })
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ status: 1 })
        await model.collection.createIndex({ created_at: -1 })
        await model.collection.createIndex({
          meme_id: 1,
          status: 1,
          created_at: -1,
        })
        break

      case 'Share':
        await model.collection.createIndex({ user_id: 1 })
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ created_at: -1 })
        break

      case 'View':
        await model.collection.createIndex({ user_id: 1 })
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ created_at: -1 })
        await model.collection.createIndex({
          meme_id: 1,
          created_at: -1,
        })
        break

      case 'Collection':
        await model.collection.createIndex({ user_id: 1 })
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ created_at: -1 })
        break

      case 'Follow':
        await model.collection.createIndex({ follower_id: 1 })
        await model.collection.createIndex({ following_id: 1 })
        await model.collection.createIndex(
          {
            follower_id: 1,
            following_id: 1,
          },
          { unique: true },
        )
        break

      case 'Tag':
        await model.collection.createIndex({ name: 1 }, { unique: true })
        await model.collection.createIndex({ usage_count: -1 })
        break

      case 'MemeTag':
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ tag_id: 1 })
        await model.collection.createIndex(
          {
            meme_id: 1,
            tag_id: 1,
          },
          { unique: true },
        )
        break

      case 'Notification':
        await model.collection.createIndex({ user_id: 1 })
        await model.collection.createIndex({ is_read: 1 })
        await model.collection.createIndex({ created_at: -1 })
        await model.collection.createIndex({
          user_id: 1,
          is_read: 1,
        })
        break

      case 'Report':
        await model.collection.createIndex({ reporter_id: 1 })
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ status: 1 })
        await model.collection.createIndex({ created_at: -1 })
        break

      case 'MemeVersion':
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ version: 1 })
        await model.collection.createIndex({ created_at: -1 })
        break

      case 'MemeEditProposal':
        await model.collection.createIndex({ meme_id: 1 })
        await model.collection.createIndex({ proposer_id: 1 })
        await model.collection.createIndex({ status: 1 })
        await model.collection.createIndex({ created_at: -1 })
        break

      case 'Announcement':
        await model.collection.createIndex({ status: 1 })
        await model.collection.createIndex({ created_at: -1 })
        await model.collection.createIndex({
          status: 1,
          created_at: -1,
        })
        break

      case 'Sponsor':
        await model.collection.createIndex({ status: 1 })
        await model.collection.createIndex({ created_at: -1 })
        break

      default:
        // 為其他模型建立基本索引
        await model.collection.createIndex({ created_at: -1 })
        break
    }
  } catch (error) {
    logger.error(`建立 ${modelName} 索引失敗:`, error)
  }
}

/**
 * 取得資料庫統計資訊
 */
const getDBStats = async () => {
  try {
    const db = mongoose.connection.db
    const stats = await db.stats()

    return {
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
    }
  } catch (error) {
    logger.error('取得資料庫統計失敗:', error)
    return null
  }
}

/**
 * 取得集合統計資訊
 */
const getCollectionStats = async (collectionName) => {
  try {
    const db = mongoose.connection.db
    const collection = db.collection(collectionName)
    const stats = await collection.stats()

    return {
      count: stats.count,
      size: stats.size,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize,
      indexes: stats.nindexes,
      totalIndexSize: stats.totalIndexSize,
    }
  } catch (error) {
    logger.error(`取得 ${collectionName} 統計失敗:`, error)
    return null
  }
}

export default connectDB
export { getDBStats, getCollectionStats }
